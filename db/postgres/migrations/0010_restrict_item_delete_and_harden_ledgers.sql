-- 1. Restrict items deletion strictly to admin in Docker PostgreSQL
DROP POLICY IF EXISTS items_write ON public.items;
CREATE POLICY items_insert ON public.items FOR INSERT TO camms_app
  WITH CHECK (private.current_app_role() IN ('admin', 'staff'));
CREATE POLICY items_update ON public.items FOR UPDATE TO camms_app
  USING (private.current_app_role() IN ('admin', 'staff'))
  WITH CHECK (private.current_app_role() IN ('admin', 'staff'));
CREATE POLICY items_delete ON public.items FOR DELETE TO camms_app
  USING (private.current_app_role() = 'admin');

-- 2. Restrict stock_movements and asset_custody_logs to INSERT only (SELECT remains in stock_movements_read / asset_custody_logs_read)
DROP POLICY IF EXISTS stock_movements_write ON public.stock_movements;
CREATE POLICY stock_movements_insert ON public.stock_movements FOR INSERT TO camms_app
  WITH CHECK (private.current_app_role() IN ('admin', 'staff'));

DROP POLICY IF EXISTS asset_custody_logs_write ON public.asset_custody_logs;
CREATE POLICY asset_custody_logs_insert ON public.asset_custody_logs FOR INSERT TO camms_app
  WITH CHECK (private.current_app_role() IN ('admin', 'staff'));

-- 3. Immutability trigger functions to prevent direct UPDATE or DELETE
CREATE OR REPLACE FUNCTION public.prevent_stock_and_custody_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Stock movements and asset custody logs are strictly append-only and cannot be modified or deleted.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_stock_movements_tampering ON public.stock_movements;
CREATE TRIGGER trg_prevent_stock_movements_tampering
  BEFORE UPDATE OR DELETE ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_stock_and_custody_tampering();

DROP TRIGGER IF EXISTS trg_prevent_asset_custody_tampering ON public.asset_custody_logs;
CREATE TRIGGER trg_prevent_asset_custody_tampering
  BEFORE UPDATE OR DELETE ON public.asset_custody_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_stock_and_custody_tampering();
