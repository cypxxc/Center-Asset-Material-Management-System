-- Promote existing staff accounts before removing staff-specific permissions.
UPDATE public.profiles SET role = 'admin', updated_at = now() WHERE role = 'staff';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'viewer'));

-- Registry permissions now belong to admins; viewers retain read access.
DROP POLICY IF EXISTS items_insert ON public.items;
DROP POLICY IF EXISTS items_update ON public.items;
CREATE POLICY items_insert ON public.items FOR INSERT TO camms_app WITH CHECK (private.current_app_role() = 'admin');
CREATE POLICY items_update ON public.items FOR UPDATE TO camms_app USING (private.current_app_role() = 'admin') WITH CHECK (private.current_app_role() = 'admin');
ALTER POLICY categories_insert ON public.categories WITH CHECK (private.current_app_role() = 'admin');
ALTER POLICY categories_update ON public.categories USING (private.current_app_role() = 'admin') WITH CHECK (private.current_app_role() = 'admin');
ALTER POLICY categories_delete ON public.categories USING (private.current_app_role() = 'admin');
ALTER POLICY locations_insert ON public.locations WITH CHECK (private.current_app_role() = 'admin');
ALTER POLICY locations_update ON public.locations USING (private.current_app_role() = 'admin') WITH CHECK (private.current_app_role() = 'admin');
ALTER POLICY locations_delete ON public.locations USING (private.current_app_role() = 'admin');
ALTER POLICY units_insert ON public.units WITH CHECK (private.current_app_role() = 'admin');
ALTER POLICY units_update ON public.units USING (private.current_app_role() = 'admin') WITH CHECK (private.current_app_role() = 'admin');
ALTER POLICY units_delete ON public.units USING (private.current_app_role() = 'admin');
ALTER POLICY categories_read ON public.categories USING (private.current_app_role() IS NOT NULL AND (is_active OR private.current_app_role() = 'admin'));
ALTER POLICY locations_read ON public.locations USING (private.current_app_role() IS NOT NULL AND (is_active OR private.current_app_role() = 'admin'));
ALTER POLICY units_read ON public.units USING (private.current_app_role() IS NOT NULL AND (is_active OR private.current_app_role() = 'admin'));
ALTER POLICY items_read ON public.items USING (private.current_app_role() IS NOT NULL AND (deleted_at IS NULL OR private.current_app_role() = 'admin'));

-- Viewers can prepare material requests. Only admins can allocate sequences and issue stock.
DROP POLICY IF EXISTS disbursement_sequences_write ON public.disbursement_sequences;
CREATE POLICY disbursement_sequences_write ON public.disbursement_sequences FOR ALL TO camms_app
  USING (private.current_app_role() = 'admin') WITH CHECK (private.current_app_role() = 'admin');
DROP POLICY IF EXISTS disbursements_write ON public.disbursements;
CREATE POLICY disbursements_write ON public.disbursements FOR ALL TO camms_app
  USING (private.current_app_role() = 'admin' OR (private.current_app_role() = 'viewer' AND transaction_type = 'material_issue' AND status = 'draft'))
  WITH CHECK (private.current_app_role() = 'admin' OR (private.current_app_role() = 'viewer' AND transaction_type = 'material_issue' AND status IN ('draft', 'pending_approval')));
DROP POLICY IF EXISTS disbursement_items_write ON public.disbursement_items;
CREATE POLICY disbursement_items_write ON public.disbursement_items FOR ALL TO camms_app
  USING (private.current_app_role() = 'admin' OR (private.current_app_role() = 'viewer' AND EXISTS (
    SELECT 1 FROM public.disbursements d WHERE d.id = disbursement_id AND d.transaction_type = 'material_issue' AND d.status = 'draft'
  )))
  WITH CHECK (private.current_app_role() = 'admin' OR (private.current_app_role() = 'viewer' AND EXISTS (
    SELECT 1 FROM public.disbursements d WHERE d.id = disbursement_id AND d.transaction_type = 'material_issue' AND d.status = 'draft'
  )));
DROP POLICY IF EXISTS stock_movements_insert ON public.stock_movements;
CREATE POLICY stock_movements_insert ON public.stock_movements FOR INSERT TO camms_app WITH CHECK (private.current_app_role() = 'admin');
DROP POLICY IF EXISTS asset_custody_logs_insert ON public.asset_custody_logs;
CREATE POLICY asset_custody_logs_insert ON public.asset_custody_logs FOR INSERT TO camms_app WITH CHECK (private.current_app_role() = 'admin');
