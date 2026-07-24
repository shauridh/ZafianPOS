create or replace function public.create_display_batch_from_output()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_outlet uuid;
begin
  if new.direction = 'output' then
    select outlet_id
      into v_outlet
      from public.production_batches
      where id = new.batch_id;

    update public.inventory_items
      set kind = 'production_output'
      where id = new.inventory_item_id
        and kind <> 'production_output';

    insert into public.display_batches (
      outlet_id,
      production_batch_id,
      inventory_item_id,
      quantity_initial,
      quantity_remaining
    )
    values (
      v_outlet,
      new.batch_id,
      new.inventory_item_id,
      new.quantity,
      new.quantity
    );
  end if;
  return new;
end
$$;

do $$
declare
  v_item record;
  v_display_quantity numeric(18,6);
  v_missing numeric(18,6);
begin
  update public.inventory_items item
    set kind = 'production_output'
    where exists (
      select 1
      from public.production_recipe_lines line
      where line.inventory_item_id = item.id
        and line.direction = 'output'
    );

  for v_item in
    select distinct item.id, item.outlet_id, item.stock_quantity
    from public.inventory_items item
    join public.production_recipe_lines line
      on line.inventory_item_id = item.id
     and line.direction = 'output'
    where item.stock_quantity > 0
  loop
    select coalesce(sum(batch.quantity_remaining), 0)
      into v_display_quantity
      from public.display_batches batch
      where batch.inventory_item_id = v_item.id
        and batch.status = 'available';

    v_missing := greatest(0, v_item.stock_quantity - v_display_quantity);
    if v_missing > 0 then
      insert into public.display_batches (
        outlet_id,
        production_batch_id,
        inventory_item_id,
        quantity_initial,
        quantity_remaining,
        produced_at,
        display_limit_minutes,
        status
      )
      values (
        v_item.outlet_id,
        null,
        v_item.id,
        v_missing,
        v_missing,
        now(),
        120,
        'available'
      );
    end if;
  end loop;
end
$$;

