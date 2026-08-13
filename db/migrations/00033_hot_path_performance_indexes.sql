-- Migration 00033: Hot-Path Performance Indexes for Dashboard & Explorer

BEGIN;

-- 1. Low-stock materials partial composite index
CREATE INDEX IF NOT EXISTS idx_items_low_stock_material
  ON public.items (quantity ASC)
  WHERE item_type = 'material' AND deleted_at IS NULL AND quantity <= 5;

-- 2. Explorer search & filtering partial composite index
CREATE INDEX IF NOT EXISTS idx_items_explorer_search
  ON public.items (deleted_at, item_type, category_id, location_id, created_at DESC);

-- 3. Status & type aggregation partial index
CREATE INDEX IF NOT EXISTS idx_items_status_active
  ON public.items (status, item_type)
  WHERE deleted_at IS NULL;

COMMIT;
