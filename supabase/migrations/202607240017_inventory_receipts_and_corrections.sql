create or replace function public.record_inventory_stock(
  p_inventory_item_id uuid,
  p_operation text,
  p_quantity numeric,
  p_note text default null,
  p_purchase_price numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.inventory_items%rowtype;
  v_delta numeric(18,6);
  v_balance numeric(18,6);
  v_kind public.movement_kind;
  v_operator_id uuid;
begin
  if p_operation not in ('opening', 'purchase', 'correction') then
    raise exception 'Operasi persediaan tidak valid';
  end if;
  if p_quantity is null or p_quantity < 0 then
    raise exception 'Jumlah tidak boleh negatif';
  end if;

  select * into v_item
  from public.inventory_items
  where id = p_inventory_item_id
    and outlet_id = public.current_outlet_id()
    and is_active
  for update;

  if not found then
    raise exception 'Bahan tidak ditemukan';
  end if;

  select id into v_operator_id
  from public.operators
  where auth_user_id = auth.uid()
    and outlet_id = v_item.outlet_id
    and is_active
  limit 1;

  if p_operation = 'purchase' then
    v_delta := p_quantity;
    v_kind := 'purchase';
  else
    v_delta := p_quantity - v_item.stock_quantity;
    v_kind := case when p_operation = 'opening' then 'adjustment'::public.movement_kind
                   else 'opname'::public.movement_kind end;
  end if;

  v_balance := v_item.stock_quantity + v_delta;
  if v_balance < 0 and not v_item.allow_negative_stock then
    raise exception 'Stok tidak boleh negatif';
  end if;

  update public.inventory_items
  set stock_quantity = v_balance,
      purchase_price = coalesce(p_purchase_price, purchase_price)
  where id = v_item.id;

  insert into public.stock_movements (
    outlet_id, inventory_item_id, kind, quantity_delta, balance_after,
    reference_type, note, operator_id
  ) values (
    v_item.outlet_id, v_item.id, v_kind, v_delta, v_balance,
    p_operation, nullif(trim(p_note), ''), v_operator_id
  );

  insert into public.activity_logs (
    outlet_id, operator_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    v_item.outlet_id, v_operator_id, 'inventory_' || p_operation,
    'inventory_item', v_item.id,
    jsonb_build_object('stock_quantity', v_item.stock_quantity),
    jsonb_build_object('stock_quantity', v_balance, 'quantity_delta', v_delta)
  );

  return jsonb_build_object(
    'inventory_item_id', v_item.id,
    'quantity_delta', v_delta,
    'balance_after', v_balance
  );
end;
$$;

revoke all on function public.record_inventory_stock(uuid,text,numeric,text,numeric) from public;
grant execute on function public.record_inventory_stock(uuid,text,numeric,text,numeric) to authenticated;
