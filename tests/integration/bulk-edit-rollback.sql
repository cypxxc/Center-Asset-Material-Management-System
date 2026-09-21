begin;
select set_config('request.jwt.claim.sub', (select id::text from public.profiles where role='admin' and is_active limit 1), true);
select set_config('camms.test_staff', (select id::text from public.profiles where role='staff' and is_active limit 1), true);
set local role authenticated;
do $$
declare ids uuid[]; n integer; loc uuid; cat uuid; unit uuid;
begin
  select id into loc from public.locations where is_active limit 1;
  select id into cat from public.categories where is_active limit 1;
  select id into unit from public.units where is_active limit 1;
  with inserted as (
    insert into public.items(item_name,item_type,quantity,status,created_by,updated_by)
    select 'bulk-edit-rollback-'||g, 'material', 7, 'active', auth.uid(), auth.uid() from generate_series(1,500) g returning id
  ) select array_agg(id) into ids from inserted;
  perform set_config('request.jwt.claim.sub', current_setting('camms.test_staff'), true);
  n := public.bulk_update_items_tx(ids, jsonb_build_object('location_id',loc::text,'category_id',cat::text,'unit_id',unit::text,'responsible_person','verification','status','spare'));
  if n<>500 then raise exception 'Expected 500 updates, got %',n; end if;
  if (select count(*) from public.items where id=any(ids) and location_id=loc and category_id=cat and unit_id=unit and responsible_person='verification' and status='spare' and quantity=7)<>500 then raise exception 'Patch or untouched field mismatch'; end if;
  begin
    perform public.bulk_update_items_tx(ids, '{"quantity":0}'::jsonb);
    raise exception 'Invalid patch accepted';
  exception when raise_exception then
    if sqlerrm='Invalid patch accepted' then raise; end if;
  end;
  begin
    perform public.bulk_update_items_tx(ids, '{"location_id":"11111111-1111-4111-8111-111111111111","status":"damaged"}'::jsonb);
    raise exception 'Invalid reference accepted';
  exception when raise_exception then
    if sqlerrm='Invalid reference accepted' then raise; end if;
  end;
  if exists(select 1 from public.items where id=any(ids) and status<>'spare') then raise exception 'Failed patch was not atomic'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', (select id::text from public.profiles where role='viewer' and is_active limit 1), true);
set local role authenticated;
do $$ begin
  begin
    perform public.bulk_update_items_tx(array['11111111-1111-4111-8111-111111111111'::uuid], '{"status":"spare"}'::jsonb);
    raise exception 'Viewer was allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
select '500 updates verified; invalid patches and references rejected; viewer rejected; all fixture changes rolled back' as result;
