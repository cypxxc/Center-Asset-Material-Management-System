-- Migration: Composite & Foreign Key Indexes for Filtered List Queries & Cursor Pagination
-- Accelerates filtered item pagination (type, status, category, location) and cursor tie-breakers

BEGIN;

-- 1. Default cursor pagination sort order: updated_at DESC, id DESC with deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_items_cursor_updated_at_id_desc
  ON public.items (updated_at DESC, id DESC)
  WHERE deleted_at IS NULL;

-- 2. Filtered list queries by item_type + cursor sort order
CREATE INDEX IF NOT EXISTS idx_items_type_cursor_updated_desc
  ON public.items (item_type, updated_at DESC, id DESC)
  WHERE deleted_at IS NULL;

-- 3. Filtered list queries by item_type, status, and updated_at
CREATE INDEX IF NOT EXISTS idx_items_type_status_updated_desc
  ON public.items (item_type, status, updated_at DESC, id DESC)
  WHERE deleted_at IS NULL;

-- 4. Foreign key indexes with deleted_at partial condition for filtered lists
CREATE INDEX IF NOT EXISTS idx_items_category_id_active
  ON public.items (category_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_items_location_id_active
  ON public.items (location_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_items_unit_id_active
  ON public.items (unit_id)
  WHERE deleted_at IS NULL;

COMMIT;
