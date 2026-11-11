-- Viewers may prepare material requests; only admins can allocate sequences and issue stock.
ALTER TABLE public.disbursements DROP CONSTRAINT IF EXISTS disbursements_status_check;
ALTER TABLE public.disbursements ADD CONSTRAINT disbursements_status_check
  CHECK (status IN ('draft', 'pending_approval', 'confirmed', 'active_borrow', 'partially_returned', 'returned', 'reversed', 'cancelled', 'rejected'));

DROP POLICY IF EXISTS disbursement_sequences_write ON public.disbursement_sequences;
CREATE POLICY disbursement_sequences_write ON public.disbursement_sequences FOR ALL TO camms_app
  USING (private.current_app_role() = 'admin') WITH CHECK (private.current_app_role() = 'admin');
DROP POLICY IF EXISTS disbursements_write ON public.disbursements;
CREATE POLICY disbursements_write ON public.disbursements FOR ALL TO camms_app
  USING (private.current_app_role() = 'admin' OR (private.current_app_role() = 'viewer' AND transaction_type = 'material_issue' AND status = 'draft'))
  WITH CHECK (private.current_app_role() = 'admin' OR (private.current_app_role() = 'viewer' AND transaction_type = 'material_issue' AND status IN ('draft', 'pending_approval')));
DROP POLICY IF EXISTS disbursement_items_write ON public.disbursement_items;
CREATE POLICY disbursement_items_insert ON public.disbursement_items FOR INSERT TO camms_app
  WITH CHECK (private.current_app_role() = 'admin' OR (private.current_app_role() = 'viewer' AND EXISTS (
    SELECT 1 FROM public.disbursements d WHERE d.id = disbursement_id AND d.transaction_type = 'material_issue' AND d.status = 'pending_approval'
  )));
CREATE POLICY disbursement_items_update ON public.disbursement_items FOR UPDATE TO camms_app
  USING (private.current_app_role() = 'admin') WITH CHECK (private.current_app_role() = 'admin');
CREATE POLICY disbursement_items_delete ON public.disbursement_items FOR DELETE TO camms_app
  USING (private.current_app_role() = 'admin');
DROP POLICY IF EXISTS stock_movements_insert ON public.stock_movements;
CREATE POLICY stock_movements_insert ON public.stock_movements FOR INSERT TO camms_app WITH CHECK (private.current_app_role() = 'admin');
DROP POLICY IF EXISTS asset_custody_logs_insert ON public.asset_custody_logs;
CREATE POLICY asset_custody_logs_insert ON public.asset_custody_logs FOR INSERT TO camms_app WITH CHECK (private.current_app_role() = 'admin');
