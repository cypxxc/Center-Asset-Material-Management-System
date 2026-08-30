-- Migration: Create RLS policies for all tables in Office Item Registry
-- 00003_rls_policies.sql

-- 1. Helper functions to avoid RLS recursion and manage role checks
create or replace function public.get_my_role()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role text;
  active boolean;
begin
  if auth.uid() is null then
    return null;
  end if;
  select role, is_active into user_role, active from public.profiles where id = auth.uid();
  if not coalesce(active, false) then
    return null;
  end if;
  return user_role;
end;
$$;

-- 2. Policies for PROFILES
create policy "Allow authenticated users to view profiles"
  on public.profiles for select
  to authenticated
  using (public.get_my_role() is not null);

create policy "Allow admin to manage profiles"
  on public.profiles for all
  to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- 3. Policies for CATEGORIES
create policy "Allow authenticated users to view active categories"
  on public.categories for select
  to authenticated
  using (
    (is_active = true and public.get_my_role() is not null)
    or public.get_my_role() = 'admin'
  );

create policy "Allow admin to manage categories"
  on public.categories for all
  to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- 4. Policies for LOCATIONS
create policy "Allow authenticated users to view active locations"
  on public.locations for select
  to authenticated
  using (
    (is_active = true and public.get_my_role() is not null)
    or public.get_my_role() = 'admin'
  );

create policy "Allow admin to manage locations"
  on public.locations for all
  to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- 5. Policies for UNITS
create policy "Allow authenticated users to view active units"
  on public.units for select
  to authenticated
  using (
    (is_active = true and public.get_my_role() is not null)
    or public.get_my_role() = 'admin'
  );

create policy "Allow admin to manage units"
  on public.units for all
  to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- 6. Policies for ITEMS
create policy "Allow authenticated users to view active items"
  on public.items for select
  to authenticated
  using (
    (deleted_at is null and public.get_my_role() is not null)
    or public.get_my_role() = 'admin'
  );

create policy "Allow staff and admin to insert items"
  on public.items for insert
  to authenticated
  with check (public.get_my_role() in ('admin', 'staff'));

create policy "Allow staff and admin to update items"
  on public.items for update
  to authenticated
  using (public.get_my_role() in ('admin', 'staff'))
  with check (public.get_my_role() in ('admin', 'staff'));

create policy "Allow admin to soft delete items"
  on public.items for delete
  to authenticated
  using (public.get_my_role() = 'admin');

-- 7. Policies for AUDIT LOGS
create policy "Allow admin to view audit logs"
  on public.audit_logs for select
  to authenticated
  using (public.get_my_role() = 'admin');

create policy "Allow authenticated users to create audit logs"
  on public.audit_logs for insert
  to authenticated
  with check (public.get_my_role() is not null);
