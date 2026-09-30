-- Migration: Add audit_logs and items performance indexes
-- Speeds up audit log ordering, user activity tracking, item status filtering, and category/location lookups

BEGIN;

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_desc ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_items_status ON public.items (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_items_category_location ON public.items (category_id, location_id) WHERE deleted_at IS NULL;

COMMIT;
