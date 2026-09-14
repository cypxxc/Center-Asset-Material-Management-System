-- Preserve the final registry operational permissions: staff manage metadata;
-- account administration remains admin-only. Viewers see active references/live items.
ALTER POLICY categories_delete ON public.categories USING (private.current_app_role() IN ('admin','staff'));
ALTER POLICY locations_delete ON public.locations USING (private.current_app_role() IN ('admin','staff'));
ALTER POLICY units_delete ON public.units USING (private.current_app_role() IN ('admin','staff'));
ALTER POLICY categories_read ON public.categories USING (private.current_app_role() IS NOT NULL AND (is_active OR private.current_app_role() IN ('admin','staff')));
ALTER POLICY locations_read ON public.locations USING (private.current_app_role() IS NOT NULL AND (is_active OR private.current_app_role() IN ('admin','staff')));
ALTER POLICY units_read ON public.units USING (private.current_app_role() IS NOT NULL AND (is_active OR private.current_app_role() IN ('admin','staff')));
ALTER POLICY items_read ON public.items USING (private.current_app_role() IS NOT NULL AND (deleted_at IS NULL OR private.current_app_role() IN ('admin','staff')));
