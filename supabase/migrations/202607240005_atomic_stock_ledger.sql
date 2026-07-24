create sequence if not exists public.production_batch_number_seq;

create or replace function public.current_outlet_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'outlet_id','')::uuid,
    (
      select operator.outlet_id
      from public.operators operator
      where operator.auth_user_id = auth.uid() and operator.is_active
      limit 1
    )
  )
$$;

create table if not exists public.production_batches (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  recipe_id uuid not null references public.production_recipes(id),
  batch_number text not null,
  multiplier numeric(18,3) not null check (multiplier > 0),
  status text not null default 'completed' check (status in ('completed','cancelled')),
  operator_id uuid references public.operators(id) on delete set null,
  completed_at timestamptz not null default now(),
  cancelled_at timestamptz,
  unique(outlet_id, batch_number)
);

create table if not exists public.production_batch_lines (
  id bigint generated always as identity primary key,
  batch_id uuid not null references public.production_batches(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id),
  direction text not null check (direction in ('input','output')),
  quantity numeric(18,6) not null check (quantity > 0),
  balance_after numeric(18,6) not null
);

create index if not exists production_batches_outlet_time_idx
  on public.production_batches(outlet_id, completed_at desc);
create index if not exists production_batch_lines_batch_idx
  on public.production_batch_lines(batch_id);

alter table public.production_batches enable row level security;
alter table public.production_batch_lines enable row level security;

create policy "outlet production batches" on public.production_batches for select
  using (outlet_id = public.current_outlet_id());
create policy "outlet production batch lines" on public.production_batch_lines for select
  using (
    exists (
      select 1 from public.production_batches batch
      where batch.id = batch_id and batch.outlet_id = public.current_outlet_id()
    )
  );

create or replace function public.complete_production_batch(
  p_recipe_id uuid,
  p_multiplier numeric,
  p_operator_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_outlet_id uuid := public.current_outlet_id();
  v_batch_id uuid;
  v_batch_number text;
  v_line record;
  v_delta numeric(18,6);
  v_balance numeric(18,6);
  v_total_output numeric(18,6) := 0;
begin
  if v_outlet_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_multiplier is null or p_multiplier <= 0 then
    raise exception 'INVALID_MULTIPLIER';
  end if;
  if not exists (
    select 1 from public.production_recipes
    where id = p_recipe_id and outlet_id = v_outlet_id and is_active
  ) then
    raise exception 'RECIPE_NOT_FOUND';
  end if;
  if p_operator_id is not null and not exists (
    select 1 from public.operators
    where id = p_operator_id and outlet_id = v_outlet_id and is_active
  ) then
    raise exception 'OPERATOR_NOT_FOUND';
  end if;

  perform 1
  from public.inventory_items item
  join public.production_recipe_lines line on line.inventory_item_id = item.id
  where line.recipe_id = p_recipe_id
  order by item.id
  for update of item;

  for v_line in
    select line.*, item.stock_quantity, item.allow_negative_stock, item.name
    from public.production_recipe_lines line
    join public.inventory_items item on item.id = line.inventory_item_id
    where line.recipe_id = p_recipe_id
    order by item.id, line.direction
  loop
    v_delta := case when v_line.direction = 'input'
      then -(v_line.quantity * p_multiplier)
      else v_line.quantity * p_multiplier
    end;
    if v_delta < 0
      and not v_line.allow_negative_stock
      and v_line.stock_quantity + v_delta < 0 then
      raise exception 'INSUFFICIENT_STOCK:%', v_line.name;
    end if;
  end loop;

  v_batch_number := 'B-' || lpad(nextval('public.production_batch_number_seq')::text, 6, '0');
  insert into public.production_batches (
    outlet_id, recipe_id, batch_number, multiplier, operator_id
  ) values (
    v_outlet_id, p_recipe_id, v_batch_number, p_multiplier, p_operator_id
  ) returning id into v_batch_id;

  for v_line in
    select line.*, item.stock_quantity
    from public.production_recipe_lines line
    join public.inventory_items item on item.id = line.inventory_item_id
    where line.recipe_id = p_recipe_id
    order by item.id, line.direction
  loop
    v_delta := case when v_line.direction = 'input'
      then -(v_line.quantity * p_multiplier)
      else v_line.quantity * p_multiplier
    end;
    update public.inventory_items
      set stock_quantity = stock_quantity + v_delta
      where id = v_line.inventory_item_id
      returning stock_quantity into v_balance;
    insert into public.stock_movements (
      outlet_id, inventory_item_id, kind, quantity_delta, balance_after,
      reference_type, reference_id, operator_id
    ) values (
      v_outlet_id, v_line.inventory_item_id,
      case when v_line.direction = 'input'
        then 'production_input'::public.movement_kind
        else 'production_output'::public.movement_kind
      end,
      v_delta, v_balance, 'production_batch', v_batch_id, p_operator_id
    );
    insert into public.production_batch_lines (
      batch_id, inventory_item_id, direction, quantity, balance_after
    ) values (
      v_batch_id, v_line.inventory_item_id, v_line.direction,
      abs(v_delta), v_balance
    );
    if v_line.direction = 'output' then
      v_total_output := v_total_output + v_delta;
    end if;
  end loop;

  insert into public.activity_logs (
    outlet_id, operator_id, action, entity_type, entity_id, after_data
  ) values (
    v_outlet_id, p_operator_id, 'production.completed', 'production_batch',
    v_batch_id, jsonb_build_object(
      'batch_number', v_batch_number,
      'recipe_id', p_recipe_id,
      'multiplier', p_multiplier,
      'total_output', v_total_output
    )
  );

  return jsonb_build_object(
    'id', v_batch_id,
    'batch_number', v_batch_number,
    'total_output', v_total_output
  );
end
$$;

revoke all on function public.complete_production_batch(uuid,numeric,uuid) from public;
grant execute on function public.complete_production_batch(uuid,numeric,uuid) to authenticated;
