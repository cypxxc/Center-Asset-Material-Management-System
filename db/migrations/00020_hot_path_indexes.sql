-- Migration 00020: Hot path indexes for production latency.
-- These indexes target dashboard, audit, and trash/list queries that run on Vercel request paths.

CREATE INDEX IF NOT EXISTS idx_audit_logs_recent
ON public.audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_items_target_recent
ON public.audit_logs (target_table, target_id, created_at DESC)
WHERE target_table = 'items';

CREATE INDEX IF NOT EXISTS idx_items_low_stock_active_material
ON public.items (quantity ASC, updated_at DESC)
WHERE deleted_at IS NULL
  AND item_type = 'material'
  AND status NOT IN ('inactive', 'disposed');

CREATE INDEX IF NOT EXISTS idx_items_deleted_recent
ON public.items (deleted_at DESC)
WHERE deleted_at IS NOT NULL;
