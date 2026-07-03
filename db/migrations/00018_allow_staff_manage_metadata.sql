-- Migration 00018: Allow staff to view inactive/active metadata, manage settings, and manage item deletion/restoration
-- db/migrations/00018_allow_staff_manage_metadata.sql

-- 1. Drop existing settings metadata policies
DROP POLICY IF EXISTS categories_read ON public.categories;
DROP POLICY IF EXISTS categories_admin_manage ON public.categories;
DROP POLICY IF EXISTS categories_staff_manage ON public.categories;

DROP POLICY IF EXISTS locations_read ON public.locations;
DROP POLICY IF EXISTS locations_admin_manage ON public.locations;
DROP POLICY IF EXISTS locations_staff_manage ON public.locations;

DROP POLICY IF EXISTS units_read ON public.units;
DROP POLICY IF EXISTS units_admin_manage ON public.units;
DROP POLICY IF EXISTS units_staff_manage ON public.units;

-- 2. Re-create settings metadata policies to allow staff
-- SELECT policies
CREATE POLICY categories_read ON public.categories FOR SELECT TO authenticated
  USING ((is_active AND private.current_app_role() IS NOT NULL) OR private.current_app_role() IN ('admin', 'staff'));

CREATE POLICY locations_read ON public.locations FOR SELECT TO authenticated
  USING ((is_active AND private.current_app_role() IS NOT NULL) OR private.current_app_role() IN ('admin', 'staff'));

CREATE POLICY units_read ON public.units FOR SELECT TO authenticated
  USING ((is_active AND private.current_app_role() IS NOT NULL) OR private.current_app_role() IN ('admin', 'staff'));

-- INSERT/UPDATE/DELETE (ALL) policies
CREATE POLICY categories_staff_manage ON public.categories FOR ALL TO authenticated
  USING (private.current_app_role() IN ('admin', 'staff'))
  WITH CHECK (private.current_app_role() IN ('admin', 'staff'));

CREATE POLICY locations_staff_manage ON public.locations FOR ALL TO authenticated
  USING (private.current_app_role() IN ('admin', 'staff'))
  WITH CHECK (private.current_app_role() IN ('admin', 'staff'));

CREATE POLICY units_staff_manage ON public.units FOR ALL TO authenticated
  USING (private.current_app_role() IN ('admin', 'staff'))
  WITH CHECK (private.current_app_role() IN ('admin', 'staff'));


-- 3. Drop existing items policies that restrict soft/hard delete and view to admin
DROP POLICY IF EXISTS items_read ON public.items;
DROP POLICY IF EXISTS items_update ON public.items;
DROP POLICY IF EXISTS items_hard_delete ON public.items;

-- 4. Re-create items policies to allow staff
-- SELECT policy (allows both admin and staff to view soft-deleted items/trash)
CREATE POLICY items_read ON public.items FOR SELECT TO authenticated
  USING (private.current_app_role() IS NOT NULL AND (deleted_at IS NULL OR private.current_app_role() IN ('admin', 'staff')));

-- UPDATE policy (allows staff to soft-delete and restore)
CREATE POLICY items_update ON public.items FOR UPDATE TO authenticated
  USING (private.current_app_role() IN ('admin', 'staff'))
  WITH CHECK (private.current_app_role() IN ('admin', 'staff'));

-- DELETE policy (allows staff to hard-delete)
CREATE POLICY items_hard_delete ON public.items FOR DELETE TO authenticated
  USING (private.current_app_role() IN ('admin', 'staff') AND deleted_at IS NOT NULL);
