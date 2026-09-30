-- Migration: Performance Trigram Indexes & Cursor Pagination Composite Index
-- Accelerates item search via pg_trgm and enables index-only scans for cursor pagination

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_items_trgm_name_fast ON public.items USING gin (item_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_items_trgm_asset_no_fast ON public.items USING gin (asset_no gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_items_trgm_serial_no_fast ON public.items USING gin (serial_no gin_trgm_ops);

-- Composite index for cursor pagination on updated_at descending with id tie-breaker
CREATE INDEX IF NOT EXISTS idx_items_pagination_updated_desc ON public.items (updated_at DESC, id DESC) WHERE deleted_at IS NULL;

COMMIT;
