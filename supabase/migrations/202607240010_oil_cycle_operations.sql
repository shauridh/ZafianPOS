create or replace function public.start_oil_cycle(p_pouches numeric,p_liters numeric,p_reason text default 'initial')
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_outlet uuid:=public.current_outlet_id();v_operator uuid:=public.current_operator_id();v_id uuid;v_current uuid;
begin
  if v_outlet is null or v_operator is null then raise exception 'AUTH_REQUIRED'; end if;
  select id into v_current from public.oil_cycles where outlet_id=v_outlet and fryer_name='Deep Fryer 1' and status='active' for update;
  if found then
    update public.oil_cycles set status='replaced',replaced_at=now(),replacement_reason=p_reason where id=v_current;
    insert into public.oil_events(cycle_id,event_type,note,operator_id) values(v_current,'replacement',p_reason,v_operator);
  end if;
  insert into public.oil_cycles(outlet_id,initial_pouches,initial_liters) values(v_outlet,p_pouches,p_liters) returning id into v_id;
  return v_id;
end $$;

create or replace function public.record_oil_event(p_event_type text,p_pouches numeric default null,p_liters numeric default null,p_condition text default null,p_note text default null)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_outlet uuid:=public.current_outlet_id();v_operator uuid:=public.current_operator_id();v_cycle uuid;v_id uuid;
begin
  select id into v_cycle from public.oil_cycles where outlet_id=v_outlet and fryer_name='Deep Fryer 1' and status='active' for update;
  if not found then raise exception 'OIL_CYCLE_REQUIRED'; end if;
  if p_event_type not in ('inspection','top_up') then raise exception 'INVALID_OIL_EVENT'; end if;
  insert into public.oil_events(cycle_id,event_type,pouches,liters,condition,note,operator_id)
  values(v_cycle,p_event_type,p_pouches,p_liters,p_condition,p_note,v_operator) returning id into v_id;
  return v_id;
end $$;

create or replace function public.increment_oil_cycle_from_batch()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  if exists(select 1 from public.production_recipes where id=new.recipe_id and name ilike '%ayam%') then
    update public.oil_cycles set packs_processed=packs_processed+new.multiplier
    where outlet_id=new.outlet_id and fryer_name='Deep Fryer 1' and status='active';
  end if;
  return new;
end $$;
create trigger production_batch_oil_usage after insert on public.production_batches for each row execute function public.increment_oil_cycle_from_batch();

revoke all on function public.start_oil_cycle(numeric,numeric,text),public.record_oil_event(text,numeric,numeric,text,text) from public;
grant execute on function public.start_oil_cycle(numeric,numeric,text),public.record_oil_event(text,numeric,numeric,text,text) to authenticated;
