-- Preserve all policy predicates, roles and grants. Evaluate the STABLE active-profile
-- lookup once per statement per predicate, rather than once per scanned row.
-- No shared cache and no change to private.current_app_role or its active check.
BEGIN;

ALTER POLICY profiles_read ON public.profiles USING (id = (SELECT auth.uid()) OR (SELECT private.current_app_role()) = 'admin');
ALTER POLICY profiles_admin_manage ON public.profiles USING ((SELECT private.current_app_role()) = 'admin') WITH CHECK ((SELECT private.current_app_role()) = 'admin');
ALTER POLICY profiles_update_own ON public.profiles USING (id = (SELECT auth.uid()) AND (SELECT private.current_app_role()) IS NOT NULL) WITH CHECK (id = (SELECT auth.uid()) AND (SELECT private.current_app_role()) IS NOT NULL);
ALTER POLICY items_read ON public.items USING ((SELECT private.current_app_role()) IS NOT NULL AND (deleted_at IS NULL OR (SELECT private.current_app_role()) IN ('admin', 'staff')));
ALTER POLICY items_create ON public.items WITH CHECK ((SELECT private.current_app_role()) IN ('admin', 'staff'));
ALTER POLICY items_update ON public.items USING ((SELECT private.current_app_role()) IN ('admin', 'staff')) WITH CHECK ((SELECT private.current_app_role()) IN ('admin', 'staff'));
ALTER POLICY items_direct_delete ON public.items USING ((SELECT private.current_app_role()) IN ('admin', 'staff'));
ALTER POLICY categories_read ON public.categories USING ((is_active AND (SELECT private.current_app_role()) IS NOT NULL) OR (SELECT private.current_app_role()) IN ('admin', 'staff'));
ALTER POLICY locations_read ON public.locations USING ((is_active AND (SELECT private.current_app_role()) IS NOT NULL) OR (SELECT private.current_app_role()) IN ('admin', 'staff'));
ALTER POLICY units_read ON public.units USING ((is_active AND (SELECT private.current_app_role()) IS NOT NULL) OR (SELECT private.current_app_role()) IN ('admin', 'staff'));
ALTER POLICY categories_admin_manage ON public.categories USING ((SELECT private.current_app_role()) IN ('admin', 'staff')) WITH CHECK ((SELECT private.current_app_role()) IN ('admin', 'staff'));
ALTER POLICY locations_admin_manage ON public.locations USING ((SELECT private.current_app_role()) IN ('admin', 'staff')) WITH CHECK ((SELECT private.current_app_role()) IN ('admin', 'staff'));
ALTER POLICY units_admin_manage ON public.units USING ((SELECT private.current_app_role()) IN ('admin', 'staff')) WITH CHECK ((SELECT private.current_app_role()) IN ('admin', 'staff'));
ALTER POLICY audit_logs_read ON public.audit_logs USING ((SELECT private.current_app_role()) = 'admin');
ALTER POLICY audit_logs_create ON public.audit_logs WITH CHECK ((SELECT private.current_app_role()) IS NOT NULL AND user_id = (SELECT auth.uid()));
ALTER POLICY asset_number_templates_read ON public.asset_number_templates USING ((SELECT private.current_app_role()) IS NOT NULL);
ALTER POLICY asset_number_templates_admin_manage ON public.asset_number_templates USING ((SELECT private.current_app_role()) = 'admin') WITH CHECK ((SELECT private.current_app_role()) = 'admin');

COMMIT;
