-- Migration 00022: Restrict staff permissions on metadata and hard deletes
-- db/migrations/00022_restrict_staff_permissions.sql

-- 1. Drop the metadata policies that allowed staff
DROP POLICY IF EXISTS categories_staff_manage ON public.categories;
DROP POLICY IF EXISTS locations_staff_manage ON public.locations;
DROP POLICY IF EXISTS units_staff_manage ON public.units;
DROP POLICY IF EXISTS items_hard_delete ON public.items;

-- 2. Re-create settings metadata policies to allow ONLY admin
CREATE POLICY categories_admin_manage ON public.categories FOR ALL TO authenticated
  USING (private.current_app_role() = 'admin')
  WITH CHECK (private.current_app_role() = 'admin');

CREATE POLICY locations_admin_manage ON public.locations FOR ALL TO authenticated
  USING (private.current_app_role() = 'admin')
  WITH CHECK (private.current_app_role() = 'admin');

CREATE POLICY units_admin_manage ON public.units FOR ALL TO authenticated
  USING (private.current_app_role() = 'admin')
  WITH CHECK (private.current_app_role() = 'admin');

-- 3. Re-create items hard delete policy to allow ONLY admin
CREATE POLICY items_hard_delete ON public.items FOR DELETE TO authenticated
  USING (private.current_app_role() = 'admin' AND deleted_at IS NOT NULL);
