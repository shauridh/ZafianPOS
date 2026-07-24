create or replace function public.cancel_sale(p_sale_id uuid,p_owner_pin text,p_reason text)
returns boolean language plpgsql security definer set search_path=public
as $$
declare v_outlet uuid:=public.current_outlet_id();v_operator uuid:=public.current_operator_id();v_sale public.sales%rowtype;v_movement record;v_balance numeric;
begin
  if not public.verify_owner_pin(p_owner_pin) then raise exception 'OWNER_PIN_REQUIRED'; end if;
  select * into v_sale from public.sales where id=p_sale_id and outlet_id=v_outlet for update;
  if not found then raise exception 'SALE_NOT_FOUND'; end if;
  if v_sale.status<>'completed' then raise exception 'SALE_NOT_COMPLETED'; end if;
  for v_movement in select inventory_item_id,abs(quantity_delta) quantity from public.stock_movements where reference_type='sale' and reference_id=p_sale_id and kind='sale'
  loop
    update public.inventory_items set stock_quantity=stock_quantity+v_movement.quantity where id=v_movement.inventory_item_id returning stock_quantity into v_balance;
    insert into public.stock_movements(outlet_id,inventory_item_id,kind,quantity_delta,balance_after,reference_type,reference_id,note,operator_id)
    values(v_outlet,v_movement.inventory_item_id,'refund',v_movement.quantity,v_balance,'sale_cancellation',p_sale_id,p_reason,v_operator);
  end loop;
  if v_sale.payment_method='cash' then update public.cash_shifts set expected_cash=expected_cash-v_sale.total where id=v_sale.shift_id and status='open'; end if;
  update public.sales set status='cancelled',cancelled_at=now() where id=p_sale_id;
  insert into public.activity_logs(outlet_id,operator_id,action,entity_type,entity_id,after_data) values(v_outlet,v_operator,'sale.cancelled','sale',p_sale_id,jsonb_build_object('reason',p_reason,'total',v_sale.total));
  return true;
end $$;
revoke all on function public.cancel_sale(uuid,text,text) from public;
grant execute on function public.cancel_sale(uuid,text,text) to authenticated;
