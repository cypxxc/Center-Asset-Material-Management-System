CREATE OR REPLACE FUNCTION private.get_public_item(p_id text)
RETURNS TABLE (
  id uuid,
  item_name text,
  item_type text,
  quantity integer,
  unit_price numeric,
  asset_no text,
  serial_no text,
  brand text,
  model text,
  responsible_person text,
  status text,
  note text,
  image_url text,
  category_id uuid,
  category_name text,
  location_id uuid,
  location_name text,
  unit_id uuid,
  unit_name text,
  depreciation_enabled boolean,
  depreciation_method text,
  depreciation_cost numeric,
  depreciation_useful_life_years integer,
  depreciation_start_basis text,
  depreciation_start_date date,
  depreciation_residual_value numeric,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    i.id, i.item_name, i.item_type, i.quantity, i.unit_price, i.asset_no, i.serial_no,
    i.brand, i.model, i.responsible_person, i.status, i.note, i.image_url,
    i.category_id, c.name AS category_name,
    i.location_id, l.name AS location_name,
    i.unit_id, u.name AS unit_name,
    i.depreciation_enabled, i.depreciation_method, i.depreciation_cost, i.depreciation_useful_life_years,
    i.depreciation_start_basis, i.depreciation_start_date, i.depreciation_residual_value, i.created_at
  FROM public.items i
  LEFT JOIN public.categories c ON c.id = i.category_id
  LEFT JOIN public.locations l ON l.id = i.location_id
  LEFT JOIN public.units u ON u.id = i.unit_id
  WHERE (
    CASE 
      WHEN p_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN i.id = p_id::uuid
      ELSE (i.asset_no = p_id OR i.serial_no = p_id)
    END
  )
  AND i.deleted_at IS NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.get_public_item(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_public_item(text) TO camms_app;
