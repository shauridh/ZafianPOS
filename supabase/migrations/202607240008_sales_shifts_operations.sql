create type public.shift_status as enum ('open','closed');
create type public.payment_method as enum ('cash','qris','gofood','grabfood','shopeefood');
create type public.sale_status as enum ('completed','cancelled','refunded');

create table public.cash_shifts (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  operator_id uuid not null references public.operators(id),
  status public.shift_status not null default 'open',
  opening_cash numeric(14,2) not null check (opening_cash >= 350000),
  expected_cash numeric(14,2) not null,
  closing_cash numeric(14,2),
  difference numeric(14,2),
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);
create unique index one_open_shift_per_outlet_idx on public.cash_shifts(outlet_id) where status='open';

create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  shift_id uuid not null references public.cash_shifts(id),
  operator_id uuid references public.operators(id),
  direction text not null check (direction in ('in','out')),
  amount numeric(14,2) not null check (amount > 0),
  category text not null,
  note text,
  approved_by_owner boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  shift_id uuid not null references public.cash_shifts(id),
  operator_id uuid references public.operators(id),
  receipt_number text not null,
  channel text not null check (channel in ('takeaway','dine_in','online_food')),
  online_provider text check (online_provider in ('gofood','grabfood','shopeefood')),
  customer_name text,
  payment_method public.payment_method not null,
  subtotal numeric(14,2) not null,
  discount numeric(14,2) not null default 0,
  total numeric(14,2) not null,
  cash_received numeric(14,2),
  cash_change numeric(14,2),
  status public.sale_status not null default 'completed',
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  unique(outlet_id, receipt_number)
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text not null,
  chicken_cut text,
  quantity numeric(18,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null,
  line_total numeric(14,2) not null
);

create table public.oil_cycles (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  fryer_name text not null default 'Deep Fryer 1',
  started_at timestamptz not null default now(),
  initial_pouches numeric(10,3) not null default 7,
  initial_liters numeric(10,3) not null default 14,
  packs_processed numeric(18,3) not null default 0,
  status text not null default 'active' check (status in ('active','replaced')),
  replaced_at timestamptz,
  replacement_reason text
);
create unique index one_active_oil_cycle_idx on public.oil_cycles(outlet_id,fryer_name) where status='active';

create table public.oil_events (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.oil_cycles(id) on delete cascade,
  event_type text not null check (event_type in ('inspection','top_up','replacement')),
  pouches numeric(10,3),
  liters numeric(10,3),
  condition text,
  note text,
  operator_id uuid references public.operators(id),
  created_at timestamptz not null default now()
);

do $$
declare table_name text;
begin
  foreach table_name in array array['cash_shifts','cash_movements','sales','sale_items','oil_cycles','oil_events']
  loop execute format('alter table public.%I enable row level security',table_name); end loop;
end $$;

create policy "outlet shifts" on public.cash_shifts for select using (outlet_id=public.current_outlet_id());
create policy "outlet cash movements" on public.cash_movements for select using (outlet_id=public.current_outlet_id());
create policy "outlet sales" on public.sales for select using (outlet_id=public.current_outlet_id());
create policy "outlet sale items" on public.sale_items for select using (
  exists(select 1 from public.sales sale where sale.id=sale_id and sale.outlet_id=public.current_outlet_id())
);
create policy "outlet oil cycles" on public.oil_cycles for select using (outlet_id=public.current_outlet_id());
create policy "outlet oil events" on public.oil_events for select using (
  exists(select 1 from public.oil_cycles cycle where cycle.id=cycle_id and cycle.outlet_id=public.current_outlet_id())
);

create or replace function public.current_operator_id()
returns uuid language sql stable security definer set search_path=public
as $$ select id from public.operators where auth_user_id=auth.uid() and outlet_id=public.current_outlet_id() and is_active limit 1 $$;

create or replace function public.open_cash_shift(p_opening_cash numeric default 350000)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_id uuid; v_outlet uuid:=public.current_outlet_id(); v_operator uuid:=public.current_operator_id();
begin
  if v_outlet is null or v_operator is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_opening_cash < 350000 then raise exception 'OPENING_CASH_MINIMUM'; end if;
  insert into public.cash_shifts(outlet_id,operator_id,opening_cash,expected_cash)
  values(v_outlet,v_operator,p_opening_cash,p_opening_cash) returning id into v_id;
  return v_id;
end $$;

create or replace function public.record_cash_movement(p_direction text,p_amount numeric,p_category text,p_note text default null,p_owner_pin text default null)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_id uuid; v_outlet uuid:=public.current_outlet_id(); v_operator uuid:=public.current_operator_id(); v_shift public.cash_shifts%rowtype; v_approved boolean:=false;
begin
  select * into v_shift from public.cash_shifts where outlet_id=v_outlet and status='open' for update;
  if not found then raise exception 'SHIFT_REQUIRED'; end if;
  if p_direction not in ('in','out') or p_amount<=0 then raise exception 'INVALID_CASH_MOVEMENT'; end if;
  if p_direction='out' and (v_shift.expected_cash-p_amount<350000 or p_amount>=50000) then
    v_approved:=public.verify_owner_pin(coalesce(p_owner_pin,''));
    if not v_approved then raise exception 'OWNER_PIN_REQUIRED'; end if;
  end if;
  update public.cash_shifts set expected_cash=expected_cash+(case when p_direction='in' then p_amount else -p_amount end) where id=v_shift.id;
  insert into public.cash_movements(outlet_id,shift_id,operator_id,direction,amount,category,note,approved_by_owner)
  values(v_outlet,v_shift.id,v_operator,p_direction,p_amount,p_category,p_note,v_approved) returning id into v_id;
  return v_id;
end $$;

create or replace function public.close_cash_shift(p_closing_cash numeric,p_owner_pin text default null)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare v_outlet uuid:=public.current_outlet_id(); v_shift public.cash_shifts%rowtype; v_difference numeric; v_approved boolean:=false;
begin
  select * into v_shift from public.cash_shifts where outlet_id=v_outlet and status='open' for update;
  if not found then raise exception 'SHIFT_REQUIRED'; end if;
  v_difference:=p_closing_cash-v_shift.expected_cash;
  if abs(v_difference)>10000 then
    v_approved:=public.verify_owner_pin(coalesce(p_owner_pin,''));
    if not v_approved then raise exception 'OWNER_PIN_REQUIRED'; end if;
  end if;
  update public.cash_shifts set status='closed',closing_cash=p_closing_cash,difference=v_difference,closed_at=now() where id=v_shift.id;
  return jsonb_build_object('id',v_shift.id,'expected_cash',v_shift.expected_cash,'closing_cash',p_closing_cash,'difference',v_difference);
end $$;

revoke all on function public.open_cash_shift(numeric), public.record_cash_movement(text,numeric,text,text,text), public.close_cash_shift(numeric,text) from public;
grant execute on function public.open_cash_shift(numeric), public.record_cash_movement(text,numeric,text,text,text), public.close_cash_shift(numeric,text) to authenticated;
