do $$
declare
  v_outlet constant uuid := '00000000-0000-0000-0000-000000000001';
begin
  if not exists (select 1 from public.outlets where id = v_outlet) then
    raise exception 'UAT reset aborted: target outlet does not exist';
  end if;

  if not exists (
    select 1 from public.operators
    where outlet_id = v_outlet and is_active
  ) then
    raise exception 'UAT reset aborted: no active operator would remain';
  end if;

  delete from public.display_batches
  where outlet_id = v_outlet;

  delete from public.stock_movements
  where outlet_id = v_outlet;

  delete from public.production_batch_lines
  where batch_id in (
    select id from public.production_batches where outlet_id = v_outlet
  );

  delete from public.production_batches
  where outlet_id = v_outlet;

  delete from public.production_recipe_lines
  where recipe_id in (
    select id from public.production_recipes where outlet_id = v_outlet
  );

  delete from public.production_recipes
  where outlet_id = v_outlet;

  delete from public.sale_items
  where sale_id in (
    select id from public.sales where outlet_id = v_outlet
  );

  delete from public.sales
  where outlet_id = v_outlet;

  delete from public.cash_movements
  where outlet_id = v_outlet;

  delete from public.cash_shifts
  where outlet_id = v_outlet;

  delete from public.oil_events
  where cycle_id in (
    select id from public.oil_cycles where outlet_id = v_outlet
  );

  delete from public.oil_cycles
  where outlet_id = v_outlet;

  delete from public.product_components
  where product_id in (
    select id from public.products where outlet_id = v_outlet
  );

  delete from public.products
  where outlet_id = v_outlet;

  delete from public.menu_categories
  where outlet_id = v_outlet;

  delete from public.inventory_items
  where outlet_id = v_outlet;

  delete from public.archive_runs
  where outlet_id = v_outlet;

  delete from public.activity_logs
  where outlet_id = v_outlet;

  if exists (
    select 1
    from (
      select outlet_id from public.inventory_items
      union all select outlet_id from public.products
      union all select outlet_id from public.production_recipes
      union all select outlet_id from public.production_batches
      union all select outlet_id from public.display_batches
      union all select outlet_id from public.stock_movements
      union all select outlet_id from public.cash_shifts
      union all select outlet_id from public.cash_movements
      union all select outlet_id from public.sales
      union all select outlet_id from public.oil_cycles
      union all select outlet_id from public.menu_categories
      union all select outlet_id from public.activity_logs
      union all select outlet_id from public.archive_runs
    ) operational
    where operational.outlet_id = v_outlet
  ) then
    raise exception 'UAT reset verification failed: operational rows remain';
  end if;

  if not exists (
    select 1 from public.outlets where id = v_outlet
  ) or not exists (
    select 1 from public.business_settings where outlet_id = v_outlet
  ) or not exists (
    select 1 from public.operators
    where outlet_id = v_outlet and is_active
  ) then
    raise exception 'UAT reset verification failed: protected access data missing';
  end if;
end;
$$;
