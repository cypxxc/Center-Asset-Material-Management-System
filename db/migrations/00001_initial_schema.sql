-- Initial schema migration for Office Item Registry System

-- 1. Profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null check (role in ('admin', 'staff', 'viewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- 2. Categories table
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS on categories
alter table public.categories enable row level security;

-- 3. Locations table
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

-- Enable RLS on locations
alter table public.locations enable row level security;

-- 4. Units table
create table public.units (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- Enable RLS on units
alter table public.units enable row level security;

-- 5. Items table
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
  status text not null default 'active' check (
    status in (
      'active',
      'spare',
      'damaged',
      'waiting_repair',
      'inactive',
      'disposed'
    )
  ),
  note text,
  image_url text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  deleted_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Enable RLS on items
alter table public.items enable row level security;

-- 6. Audit logs table
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

-- Enable RLS on audit_logs
alter table public.audit_logs enable row level security;

-- Database Indexes
create index idx_items_deleted_at on public.items(deleted_at);
create index idx_items_item_type on public.items(item_type);
create index idx_items_status on public.items(status);
create index idx_items_category_id on public.items(category_id);
create index idx_items_location_id on public.items(location_id);
create index idx_items_updated_at on public.items(updated_at desc);

-- Unique index for non-deleted asset numbers
create unique index unique_asset_no_not_deleted
on public.items(asset_no)
where asset_no is not null and deleted_at is null;

-- Unique index for non-deleted serial numbers
create unique index unique_serial_no_not_deleted
on public.items(serial_no)
where serial_no is not null and deleted_at is null;

-- Simple search index
create index idx_items_search
on public.items
using gin (
  to_tsvector(
    'simple',
    coalesce(item_name, '') || ' ' ||
    coalesce(asset_no, '') || ' ' ||
    coalesce(serial_no, '') || ' ' ||
    coalesce(brand, '') || ' ' ||
    coalesce(model, '') || ' ' ||
    coalesce(responsible_person, '')
  )
);

-- Sync profiles with auth.users
create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  insert into public.profiles (id, full_name, email, role, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'viewer'),
    true
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
