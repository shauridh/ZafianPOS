create or replace function public.set_owner_pin(new_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_outlet_id uuid := public.current_outlet_id();
begin
  if auth.uid() is null or v_outlet_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if new_pin !~ '^[0-9]{4,6}$' then
    raise exception 'PIN_FORMAT';
  end if;
  insert into public.owner_security (outlet_id, pin_hash)
  values (v_outlet_id, extensions.crypt(new_pin, extensions.gen_salt('bf')))
  on conflict (outlet_id) do update
    set pin_hash = excluded.pin_hash,
        failed_attempts = 0,
        locked_until = null,
        updated_at = now();
  insert into public.activity_logs (
    outlet_id, operator_id, action, entity_type
  )
  select v_outlet_id, operator.id, 'owner_pin.updated', 'owner_security'
  from public.operators operator
  where operator.auth_user_id = auth.uid() and operator.outlet_id = v_outlet_id
  limit 1;
  return true;
end
$$;

revoke all on function public.set_owner_pin(text) from public;
grant execute on function public.set_owner_pin(text) to authenticated;
