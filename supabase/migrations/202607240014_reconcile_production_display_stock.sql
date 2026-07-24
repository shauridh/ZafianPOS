update public.inventory_items item
set kind = 'production_output'
where exists (
  select 1
  from public.production_recipe_lines line
  where line.inventory_item_id = item.id
    and line.direction = 'output'
);

update public.inventory_items item
set kind = 'raw_material'
where exists (
  select 1
  from public.production_recipe_lines line
  where line.inventory_item_id = item.id
    and line.direction = 'input'
)
and not exists (
  select 1
  from public.production_recipe_lines line
  where line.inventory_item_id = item.id
    and line.direction = 'output'
);

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
select
  item.outlet_id,
  null,
  item.id,
  item.stock_quantity,
  item.stock_quantity,
  now(),
  120,
  'available'
from public.inventory_items item
where item.kind = 'production_output'
  and item.stock_quantity > 0
  and not exists (
    select 1
    from public.display_batches batch
    where batch.inventory_item_id = item.id
      and batch.status = 'available'
  );

