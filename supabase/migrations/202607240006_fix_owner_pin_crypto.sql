create or replace function public.verify_owner_pin(candidate text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  sec public.owner_security%rowtype;
begin
  select * into sec
  from public.owner_security
  where outlet_id = public.current_outlet_id()
  for update;
  if not found then return false; end if;
  if sec.locked_until is not null and sec.locked_until > now() then return false; end if;
  if sec.pin_hash = extensions.crypt(candidate, sec.pin_hash) then
    update public.owner_security
      set failed_attempts = 0, locked_until = null
      where outlet_id = sec.outlet_id;
    return true;
  end if;
  update public.owner_security
    set failed_attempts = failed_attempts + 1,
        locked_until = case
          when failed_attempts + 1 >= 5 then now() + interval '5 minutes'
          else null
        end
    where outlet_id = sec.outlet_id;
  return false;
end
$$;

revoke all on function public.verify_owner_pin(text) from public;
grant execute on function public.verify_owner_pin(text) to authenticated;
