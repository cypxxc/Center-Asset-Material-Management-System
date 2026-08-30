-- Migration 00022: Allow staff operational admin permissions while keeping admin-only user/DB management
-- db/migrations/00022_restrict_staff_permissions.sql

-- 1. Drop the metadata policies that allowed staff, plus any older admin-only
-- policies so this migration is safe across partially migrated environments.
DROP POLICY IF EXISTS categories_admin_manage ON public.categories;
DROP POLICY IF EXISTS categories_staff_manage ON public.categories;
DROP POLICY IF EXISTS locations_admin_manage ON public.locations;
DROP POLICY IF EXISTS locations_staff_manage ON public.locations;
DROP POLICY IF EXISTS units_admin_manage ON public.units;
DROP POLICY IF EXISTS units_staff_manage ON public.units;
DROP POLICY IF EXISTS items_hard_delete ON public.items;

-- 2. Re-create settings metadata policies to allow operational managers
CREATE POLICY categories_admin_manage ON public.categories FOR ALL TO authenticated
  USING (private.current_app_role() IN ('admin', 'staff'))
  WITH CHECK (private.current_app_role() IN ('admin', 'staff'));

CREATE POLICY locations_admin_manage ON public.locations FOR ALL TO authenticated
  USING (private.current_app_role() IN ('admin', 'staff'))
  WITH CHECK (private.current_app_role() IN ('admin', 'staff'));

CREATE POLICY units_admin_manage ON public.units FOR ALL TO authenticated
  USING (private.current_app_role() IN ('admin', 'staff'))
  WITH CHECK (private.current_app_role() IN ('admin', 'staff'));

-- 3. Re-create items hard delete policy to allow operational managers
CREATE POLICY items_hard_delete ON public.items FOR DELETE TO authenticated
  USING (private.current_app_role() IN ('admin', 'staff') AND deleted_at IS NOT NULL);
