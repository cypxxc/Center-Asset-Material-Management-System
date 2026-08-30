-- Performance Optimization Indexes
-- Part 1: Trigram Extension for faster partial text search (ilike)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Part 2: Composite Index for primary filtering and sorting
CREATE INDEX IF NOT EXISTS idx_items_active_filter_sort 
ON public.items (deleted_at, updated_at DESC);

-- Part 3: Composite Indexes for specific filters
CREATE INDEX IF NOT EXISTS idx_items_category_active 
ON public.items (deleted_at, category_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_items_location_active 
ON public.items (deleted_at, location_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_items_status_active 
ON public.items (deleted_at, status, updated_at DESC);

-- Part 4: GIN Index using pg_trgm for global partial match searching
CREATE INDEX IF NOT EXISTS idx_items_trgm_search ON public.items USING gin (
  (COALESCE(item_name, '') || ' ' || 
   COALESCE(asset_no, '') || ' ' || 
   COALESCE(serial_no, '') || ' ' || 
   COALESCE(brand, '') || ' ' || 
   COALESCE(model, '') || ' ' || 
   COALESCE(responsible_person, '')) gin_trgm_ops
);
