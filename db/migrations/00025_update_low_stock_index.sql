-- Migration 00025: Align low-stock index with the current non-archive item lifecycle.

DROP INDEX IF EXISTS public.idx_items_low_stock_active_material;

CREATE INDEX IF NOT EXISTS idx_items_low_stock_material
  ON public.items (quantity ASC, updated_at DESC)
  WHERE deleted_at IS NULL
    AND item_type = 'material';
