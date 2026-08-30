-- Migration 00028: Audit System Hardening & Immutability Triggers
-- Prevents UPDATE/DELETE on audit_logs and adds automated auditing for core domain tables.

BEGIN;

-- 1. Function to enforce audit log immutability
CREATE OR REPLACE FUNCTION public.prevent_audit_log_tampering()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE operations are forbidden.';
END;
$$ LANGUAGE plpgsql;

-- Attach immutability trigger to audit_logs
DROP TRIGGER IF EXISTS trg_prevent_audit_log_tampering ON public.audit_logs;
CREATE TRIGGER trg_prevent_audit_log_tampering
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_tampering();

-- 2. Function to automatically audit table mutations
CREATE OR REPLACE FUNCTION public.process_audit_log_event()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_target_id TEXT;
  v_old_data JSONB;
  v_new_data JSONB;
BEGIN
  v_user_id := auth.uid();

  IF (TG_OP = 'DELETE') THEN
    v_target_id := OLD.id::TEXT;
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_target_id := NEW.id::TEXT;
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
  ELSIF (TG_OP = 'INSERT') THEN
    v_target_id := NEW.id::TEXT;
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
  END IF;

  INSERT INTO public.audit_logs (
    user_id,
    action,
    target_table,
    target_id,
    old_data,
    new_data
  ) VALUES (
    v_user_id,
    TG_OP,
    TG_TABLE_NAME,
    v_target_id,
    v_old_data,
    v_new_data
  );

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach audit triggers to core business tables
DROP TRIGGER IF EXISTS trg_audit_items ON public.items;
CREATE TRIGGER trg_audit_items
  AFTER INSERT OR UPDATE OR DELETE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.process_audit_log_event();

DROP TRIGGER IF EXISTS trg_audit_categories ON public.categories;
CREATE TRIGGER trg_audit_categories
  AFTER INSERT OR UPDATE OR DELETE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.process_audit_log_event();

DROP TRIGGER IF EXISTS trg_audit_locations ON public.locations;
CREATE TRIGGER trg_audit_locations
  AFTER INSERT OR UPDATE OR DELETE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.process_audit_log_event();

DROP TRIGGER IF EXISTS trg_audit_units ON public.units;
CREATE TRIGGER trg_audit_units
  AFTER INSERT OR UPDATE OR DELETE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.process_audit_log_event();

DROP TRIGGER IF EXISTS trg_audit_profiles ON public.profiles;
CREATE TRIGGER trg_audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.process_audit_log_event();

COMMIT;
