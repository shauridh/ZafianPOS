create table public.display_batches (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  production_batch_id uuid references public.production_batches(id) on delete set null,
  inventory_item_id uuid not null references public.inventory_items(id),
  quantity_initial numeric(18,6) not null,
  quantity_remaining numeric(18,6) not null,
  produced_at timestamptz not null default now(),
  display_limit_minutes integer not null default 120,
  status text not null default 'available' check(status in ('available','empty','converted','waste'))
);
create index display_batches_fifo_idx on public.display_batches(outlet_id,inventory_item_id,status,produced_at);
alter table public.display_batches enable row level security;
create policy "outlet display batches" on public.display_batches for select using(outlet_id=public.current_outlet_id());

create or replace function public.create_display_batch_from_output()
returns trigger language plpgsql security definer set search_path=public
as $$
declare v_outlet uuid;
begin
  if new.direction='output' and exists(select 1 from public.inventory_items where id=new.inventory_item_id and kind='production_output') then
    select outlet_id into v_outlet from public.production_batches where id=new.batch_id;
    insert into public.display_batches(outlet_id,production_batch_id,inventory_item_id,quantity_initial,quantity_remaining)
    values(v_outlet,new.batch_id,new.inventory_item_id,new.quantity,new.quantity);
  end if;
  return new;
end $$;
create trigger production_output_display_batch after insert on public.production_batch_lines for each row execute function public.create_display_batch_from_output();

create or replace function public.consume_display_batches_fifo()
returns trigger language plpgsql security definer set search_path=public
as $$
declare v_needed numeric:=abs(new.quantity_delta);v_batch public.display_batches%rowtype;v_take numeric;
begin
  if new.kind<>'sale' or new.quantity_delta>=0 then return new; end if;
  for v_batch in select * from public.display_batches where outlet_id=new.outlet_id and inventory_item_id=new.inventory_item_id and status='available' order by produced_at for update
  loop
    exit when v_needed<=0;
    v_take:=least(v_needed,v_batch.quantity_remaining);
    update public.display_batches set quantity_remaining=quantity_remaining-v_take,status=case when quantity_remaining-v_take<=0 then 'empty' else 'available' end where id=v_batch.id;
    v_needed:=v_needed-v_take;
  end loop;
  return new;
end $$;
create trigger sale_fifo_display_batch after insert on public.stock_movements for each row execute function public.consume_display_batches_fifo();

create or replace function public.list_display_stock()
returns table(id uuid,item_name text,quantity_remaining numeric,produced_at timestamptz,age_minutes integer,display_limit_minutes integer,status text)
language sql stable security definer set search_path=public
as $$
  select batch.id,item.name,batch.quantity_remaining,batch.produced_at,floor(extract(epoch from(now()-batch.produced_at))/60)::integer,batch.display_limit_minutes,batch.status
  from public.display_batches batch join public.inventory_items item on item.id=batch.inventory_item_id
  where batch.outlet_id=public.current_outlet_id() and batch.status='available'
  order by batch.produced_at
$$;
revoke all on function public.list_display_stock() from public;
grant execute on function public.list_display_stock() to authenticated;
