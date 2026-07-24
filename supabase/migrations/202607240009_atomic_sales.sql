create sequence if not exists public.sale_receipt_number_seq;

create or replace function public.complete_sale(
  p_channel text,
  p_online_provider text,
  p_customer_name text,
  p_payment_method public.payment_method,
  p_discount numeric,
  p_cash_received numeric,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_outlet uuid:=public.current_outlet_id();
  v_operator uuid:=public.current_operator_id();
  v_shift public.cash_shifts%rowtype;
  v_sale_id uuid;
  v_receipt text;
  v_subtotal numeric(14,2):=0;
  v_total numeric(14,2);
  v_item jsonb;
  v_product public.products%rowtype;
  v_component record;
  v_delta numeric(18,6);
  v_balance numeric(18,6);
begin
  if v_outlet is null or v_operator is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_shift from public.cash_shifts where outlet_id=v_outlet and status='open' for update;
  if not found then raise exception 'SHIFT_REQUIRED'; end if;
  if p_channel not in ('takeaway','dine_in','online_food') then raise exception 'INVALID_CHANNEL'; end if;
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb))=0 then raise exception 'EMPTY_CART'; end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if (v_item->>'quantity')::numeric<=0 or (v_item->>'unit_price')::numeric<0 then raise exception 'INVALID_ITEM'; end if;
    v_subtotal:=v_subtotal+((v_item->>'quantity')::numeric*(v_item->>'unit_price')::numeric);
  end loop;
  v_total:=greatest(0,v_subtotal-coalesce(p_discount,0));
  if p_payment_method='cash' and coalesce(p_cash_received,0)<v_total then raise exception 'INSUFFICIENT_PAYMENT'; end if;

  v_receipt:='A-'||lpad(nextval('public.sale_receipt_number_seq')::text,6,'0');
  insert into public.sales(outlet_id,shift_id,operator_id,receipt_number,channel,online_provider,customer_name,payment_method,subtotal,discount,total,cash_received,cash_change)
  values(v_outlet,v_shift.id,v_operator,v_receipt,p_channel,nullif(p_online_provider,''),nullif(p_customer_name,''),p_payment_method,v_subtotal,coalesce(p_discount,0),v_total,
    case when p_payment_method='cash' then p_cash_received else null end,
    case when p_payment_method='cash' then p_cash_received-v_total else null end)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.sale_items(sale_id,product_id,product_name,chicken_cut,quantity,unit_price,line_total)
    values(v_sale_id,nullif(v_item->>'product_id','')::uuid,v_item->>'name',nullif(v_item->>'chicken_cut',''),(v_item->>'quantity')::numeric,(v_item->>'unit_price')::numeric,(v_item->>'quantity')::numeric*(v_item->>'unit_price')::numeric);
    if nullif(v_item->>'product_id','') is not null then
      select * into v_product from public.products where id=(v_item->>'product_id')::uuid and outlet_id=v_outlet;
      for v_component in
        select component.*, inventory.stock_quantity, inventory.allow_negative_stock, inventory.name
        from public.product_components component
        join public.inventory_items inventory on inventory.id=component.inventory_item_id
        where component.product_id=v_product.id
        order by inventory.id for update of inventory
      loop
        v_delta:=-(v_component.quantity*(v_item->>'quantity')::numeric);
        if not v_component.allow_negative_stock and v_component.stock_quantity+v_delta<0 then raise exception 'INSUFFICIENT_STOCK:%',v_component.name; end if;
        update public.inventory_items set stock_quantity=stock_quantity+v_delta where id=v_component.inventory_item_id returning stock_quantity into v_balance;
        insert into public.stock_movements(outlet_id,inventory_item_id,kind,quantity_delta,balance_after,reference_type,reference_id,operator_id)
        values(v_outlet,v_component.inventory_item_id,'sale',v_delta,v_balance,'sale',v_sale_id,v_operator);
      end loop;
    end if;
  end loop;

  if p_payment_method='cash' then update public.cash_shifts set expected_cash=expected_cash+v_total where id=v_shift.id; end if;
  insert into public.activity_logs(outlet_id,operator_id,action,entity_type,entity_id,after_data)
  values(v_outlet,v_operator,'sale.completed','sale',v_sale_id,jsonb_build_object('receipt_number',v_receipt,'total',v_total,'payment_method',p_payment_method));
  return jsonb_build_object('id',v_sale_id,'receipt_number',v_receipt,'subtotal',v_subtotal,'total',v_total,'change',case when p_payment_method='cash' then p_cash_received-v_total else 0 end);
end $$;

revoke all on function public.complete_sale(text,text,text,public.payment_method,numeric,numeric,jsonb) from public;
grant execute on function public.complete_sale(text,text,text,public.payment_method,numeric,numeric,jsonb) to authenticated;
