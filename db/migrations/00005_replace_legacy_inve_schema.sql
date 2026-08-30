-- Replace the empty legacy inve schema with the Registry-S data model.
-- Approved by the project owner on 2026-06-26.

begin;

drop table if exists public.error_logs cascade;
drop table if exists public.activity_logs cascade;
drop table if exists public.item_images cascade;
drop table if exists public.item_sequences cascade;
drop table if exists public.items cascade;
drop table if exists public.categories cascade;
drop table if exists public.users cascade;
drop type if exists public.item_type cascade;
drop type if exists public.log_severity cascade;

create schema if not exists private;
revoke all on schema private from public;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role text not null check (role in ('admin', 'staff', 'viewer')) default 'viewer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  building text,
  floor text,
  room text,
  department text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  item_type text not null check (item_type in ('material', 'asset', 'general')),
  category_id uuid references public.categories(id),
  quantity integer not null default 1 check (quantity >= 0),
  unit_id uuid references public.units(id),
  asset_no text,
  serial_no text,
  brand text,
  model text,
  location_id uuid references public.locations(id),
  responsible_person text,
  status text not null default 'active' check (status in ('active', 'spare', 'damaged', 'waiting_repair', 'inactive', 'disposed')),
  note text,
  image_url text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  deleted_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  action text not null,
  target_table text not null,
  target_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index idx_items_deleted_at on public.items(deleted_at);
create index idx_items_item_type on public.items(item_type);
create index idx_items_status on public.items(status);
create index idx_items_category_id on public.items(category_id);
create index idx_items_unit_id on public.items(unit_id);
create index idx_items_location_id on public.items(location_id);
create index idx_items_updated_at on public.items(updated_at desc);
create unique index unique_asset_no_not_deleted on public.items(asset_no) where asset_no is not null and deleted_at is null;
create unique index unique_serial_no_not_deleted on public.items(serial_no) where serial_no is not null and deleted_at is null;
create index idx_items_search on public.items using gin (to_tsvector('simple', coalesce(item_name, '') || ' ' || coalesce(asset_no, '') || ' ' || coalesce(serial_no, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(model, '') || ' ' || coalesce(responsible_person, '')));

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger categories_set_updated_at before update on public.categories for each row execute function private.set_updated_at();
create trigger locations_set_updated_at before update on public.locations for each row execute function private.set_updated_at();
create trigger units_set_updated_at before update on public.units for each row execute function private.set_updated_at();
create trigger items_set_updated_at before update on public.items for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  insert into public.profiles (id, full_name, email, role, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    'viewer',
    true
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

create or replace function private.current_app_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role
  from public.profiles
  where id = (select auth.uid())
    and is_active = true;
$$;

revoke all on function private.set_updated_at() from public;
revoke all on function private.handle_new_user() from public;
revoke all on function private.current_app_role() from public;
grant usage on schema private to authenticated, supabase_auth_admin;
grant execute on function private.handle_new_user() to supabase_auth_admin;
grant execute on function private.current_app_role() to authenticated;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.locations enable row level security;
alter table public.units enable row level security;
alter table public.items enable row level security;
alter table public.audit_logs enable row level security;

revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select on public.profiles, public.categories, public.locations, public.units, public.items to authenticated;
grant insert, update on public.items to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant all on public.profiles, public.categories, public.locations, public.units, public.items, public.audit_logs to service_role;

create policy profiles_read on public.profiles for select to authenticated using (id = (select auth.uid()) or private.current_app_role() = 'admin');
create policy profiles_admin_manage on public.profiles for all to authenticated using (private.current_app_role() = 'admin') with check (private.current_app_role() = 'admin');

create policy categories_read on public.categories for select to authenticated using ((is_active and private.current_app_role() is not null) or private.current_app_role() = 'admin');
create policy categories_admin_manage on public.categories for all to authenticated using (private.current_app_role() = 'admin') with check (private.current_app_role() = 'admin');

create policy locations_read on public.locations for select to authenticated using ((is_active and private.current_app_role() is not null) or private.current_app_role() = 'admin');
create policy locations_admin_manage on public.locations for all to authenticated using (private.current_app_role() = 'admin') with check (private.current_app_role() = 'admin');

create policy units_read on public.units for select to authenticated using ((is_active and private.current_app_role() is not null) or private.current_app_role() = 'admin');
create policy units_admin_manage on public.units for all to authenticated using (private.current_app_role() = 'admin') with check (private.current_app_role() = 'admin');

create policy items_read on public.items for select to authenticated using (private.current_app_role() is not null and (deleted_at is null or private.current_app_role() = 'admin'));
create policy items_create on public.items for insert to authenticated with check (private.current_app_role() in ('admin', 'staff'));
create policy items_update on public.items for update to authenticated using (private.current_app_role() in ('admin', 'staff') and (deleted_at is null or private.current_app_role() = 'admin')) with check (private.current_app_role() = 'admin' or deleted_at is null);

create policy audit_logs_read on public.audit_logs for select to authenticated using (private.current_app_role() = 'admin');
create policy audit_logs_create on public.audit_logs for insert to authenticated with check (private.current_app_role() is not null);

insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists registry_item_images_read on storage.objects;
drop policy if exists registry_item_images_upload on storage.objects;
drop policy if exists registry_item_images_update on storage.objects;
drop policy if exists registry_item_images_delete on storage.objects;

create policy registry_item_images_read on storage.objects for select to authenticated using (bucket_id = 'item-images' and private.current_app_role() is not null);
create policy registry_item_images_upload on storage.objects for insert to authenticated with check (bucket_id = 'item-images' and private.current_app_role() in ('admin', 'staff'));
create policy registry_item_images_update on storage.objects for update to authenticated using (bucket_id = 'item-images' and private.current_app_role() in ('admin', 'staff')) with check (bucket_id = 'item-images' and private.current_app_role() in ('admin', 'staff'));
create policy registry_item_images_delete on storage.objects for delete to authenticated using (bucket_id = 'item-images' and private.current_app_role() = 'admin');

commit;
