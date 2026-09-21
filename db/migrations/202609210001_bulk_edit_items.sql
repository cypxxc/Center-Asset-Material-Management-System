-- Atomic bulk edits retain caller RLS and existing item audit triggers.
create or replace function public.bulk_update_items_tx(p_ids uuid[], p_updates jsonb)
returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  changed public.items;
  affected integer;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id=auth.uid() and is_active and role in ('admin','staff')) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if coalesce(cardinality(p_ids),0) not between 1 and 1000 or array_position(p_ids,null) is not null then raise exception 'Invalid selection'; end if;
  if p_updates is null or jsonb_typeof(p_updates) <> 'object' or p_updates = '{}'::jsonb then raise exception 'Empty changes'; end if;
  if exists(select 1 from jsonb_each(p_updates) e where e.key not in ('location_id','category_id','unit_id','responsible_person','status') or jsonb_typeof(e.value) <> 'string') then raise exception 'Invalid field'; end if;
  if length(p_updates->>'responsible_person') > 200 then raise exception 'Responsible person too long'; end if;
  changed := jsonb_populate_record(null::public.items,p_updates);
  if p_updates ? 'status' and p_updates->>'status' not in ('active','spare','damaged','waiting_repair','inactive','disposed') then raise exception 'Invalid status'; end if;
  if p_updates ? 'location_id' then
    perform id from public.locations where id=changed.location_id and is_active;
    if not found then raise exception 'Invalid location'; end if;
  end if;
  if p_updates ? 'category_id' then
    perform id from public.categories where id=changed.category_id and is_active;
    if not found then raise exception 'Invalid category'; end if;
  end if;
  if p_updates ? 'unit_id' then
    perform id from public.units where id=changed.unit_id and is_active;
    if not found then raise exception 'Invalid unit'; end if;
  end if;
  update public.items i set
    location_id=case when p_updates ? 'location_id' then changed.location_id else i.location_id end,
    category_id=case when p_updates ? 'category_id' then changed.category_id else i.category_id end,
    unit_id=case when p_updates ? 'unit_id' then changed.unit_id else i.unit_id end,
    responsible_person=case when p_updates ? 'responsible_person' then nullif(btrim(changed.responsible_person),'') else i.responsible_person end,
    status=case when p_updates ? 'status' then changed.status else i.status end,
    updated_by=auth.uid(), updated_at=now()
  where i.id=any(p_ids) and i.deleted_at is null;
  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function public.bulk_update_items_tx(uuid[],jsonb) from public, anon;
grant execute on function public.bulk_update_items_tx(uuid[],jsonb) to authenticated;
