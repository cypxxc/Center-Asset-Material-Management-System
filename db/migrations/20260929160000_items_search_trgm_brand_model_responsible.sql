-- Migration: Add Trigram GIN Indexes for brand, model, and responsible_person
-- Completes index-scan coverage for multi-column ILIKE item searches

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_items_trgm_brand ON public.items USING gin (brand gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_items_trgm_model ON public.items USING gin (model gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_items_trgm_responsible_person ON public.items USING gin (responsible_person gin_trgm_ops);

COMMIT;
