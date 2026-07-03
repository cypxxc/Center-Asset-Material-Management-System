-- Migration 00014: Add individual GIN indexes for items searching
-- This allows PostgreSQL to run index scans on each separately queried field.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_items_trgm_name ON public.items USING GIN (item_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_items_trgm_asset_no ON public.items USING GIN (asset_no gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_items_trgm_serial_no ON public.items USING GIN (serial_no gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_items_trgm_brand ON public.items USING GIN (brand gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_items_trgm_model ON public.items USING GIN (model gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_items_trgm_responsible_person ON public.items USING GIN (responsible_person gin_trgm_ops);

COMMIT;
