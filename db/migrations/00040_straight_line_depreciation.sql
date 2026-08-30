ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS depreciation_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS depreciation_method text,
  ADD COLUMN IF NOT EXISTS depreciation_cost numeric(12,2),
  ADD COLUMN IF NOT EXISTS depreciation_useful_life_years integer,
  ADD COLUMN IF NOT EXISTS depreciation_start_basis text,
  ADD COLUMN IF NOT EXISTS depreciation_start_date date,
  ADD COLUMN IF NOT EXISTS depreciation_residual_value numeric(12,2) NOT NULL DEFAULT 1.00;

ALTER TABLE public.items
  DROP CONSTRAINT IF EXISTS items_depreciation_valid_check;

ALTER TABLE public.items
  ADD CONSTRAINT items_depreciation_valid_check CHECK (
    NOT depreciation_enabled OR (
      item_type = 'asset'
      AND depreciation_method = 'straight_line'
      AND depreciation_cost > 1.00
      AND depreciation_useful_life_years > 0
      AND depreciation_start_basis IN ('acquired', 'available', 'manual')
      AND depreciation_start_date IS NOT NULL
      AND depreciation_residual_value = 1.00
    )
  );

COMMENT ON COLUMN public.items.depreciation_residual_value IS 'Fixed residual value for Thai government asset registers.';
