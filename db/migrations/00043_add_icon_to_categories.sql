-- Migration: 00043_add_icon_to_categories.sql
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS icon VARCHAR(50) NOT NULL DEFAULT 'Tag';

COMMENT ON COLUMN public.categories.icon IS 'Lucide icon identifier for category (e.g. Laptop, Armchair, Tag)';

-- Update get_sidebar_stats() to include category icon
CREATE OR REPLACE FUNCTION public.get_sidebar_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    categories_json json;
    locations_json json;
    counts_json json;
BEGIN
    SELECT json_agg(t) INTO categories_json
    FROM (
        SELECT
            c.id,
            c.name,
            c.icon,
            COUNT(i.id)::int AS count
        FROM public.categories c
        LEFT JOIN public.items i ON i.category_id = c.id
            AND i.deleted_at IS NULL
            AND i.item_type = 'asset'
        WHERE c.is_active = true
        GROUP BY c.id, c.name, c.icon
        ORDER BY c.name
    ) t;

    SELECT json_agg(t) INTO locations_json
    FROM (
        SELECT
            l.id,
            l.name,
            COUNT(i.id)::int AS count
        FROM public.locations l
        LEFT JOIN public.items i ON i.location_id = l.id
            AND i.deleted_at IS NULL
        WHERE l.is_active = true
        GROUP BY l.id, l.name
        ORDER BY l.name
    ) t;

    SELECT json_build_object(
        'total_assets', count(*) FILTER (WHERE item_type = 'asset' AND deleted_at IS NULL)::int,
        'total_supplies', count(*) FILTER (WHERE item_type = 'material' AND deleted_at IS NULL)::int,
        'archive_count', 0,
        'trash_count', count(*) FILTER (WHERE deleted_at IS NOT NULL)::int
    ) INTO counts_json
    FROM public.items;

    RETURN json_build_object(
        'categories', COALESCE(categories_json, '[]'::json),
        'locations', COALESCE(locations_json, '[]'::json),
        'counts', counts_json
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_sidebar_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_sidebar_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_sidebar_stats() TO authenticated;

-- Update restore_database_backup to include icon and color in categories restoration
CREATE OR REPLACE FUNCTION public.restore_database_backup(backup jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  restored_tables text[] := ARRAY[]::text[];
BEGIN
  IF auth.uid() IS NULL OR private.current_app_role() <> 'admin' THEN
    RETURN json_build_object('ok', false, 'error', 'Forbidden: administrators only');
  END IF;

  IF backup IS NULL OR jsonb_typeof(backup) <> 'object' THEN
    RETURN json_build_object('ok', false, 'error', 'Invalid backup object');
  END IF;

  IF COALESCE(backup->'__meta'->>'version', '') <> '1' THEN
    RETURN json_build_object('ok', false, 'error', 'Unsupported backup format version');
  END IF;

  IF jsonb_typeof(backup->'categories') <> 'array'
     OR jsonb_typeof(backup->'locations') <> 'array'
     OR jsonb_typeof(backup->'units') <> 'array'
     OR jsonb_typeof(backup->'items') <> 'array' THEN
    RETURN json_build_object('ok', false, 'error', 'Backup is missing one or more required business tables');
  END IF;

  INSERT INTO public.categories (id, name, description, color, icon, is_active, created_at, updated_at)
  SELECT 
    id, 
    name, 
    description, 
    COALESCE(color, '#64748B'),
    COALESCE(icon, 'Tag'),
    is_active, 
    created_at, 
    updated_at
  FROM jsonb_populate_recordset(NULL::public.categories, backup->'categories')
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, 
    description = EXCLUDED.description, 
    color = EXCLUDED.color,
    icon = EXCLUDED.icon,
    is_active = EXCLUDED.is_active,
    updated_at = EXCLUDED.updated_at;
  restored_tables := array_append(restored_tables, 'categories');

  INSERT INTO public.locations (id, name, building, floor, room, department, description, is_active, created_at, updated_at)
  SELECT id, name, building, floor, room, department, description, is_active, created_at, updated_at
  FROM jsonb_populate_recordset(NULL::public.locations, backup->'locations')
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, building = EXCLUDED.building, floor = EXCLUDED.floor,
    room = EXCLUDED.room, department = EXCLUDED.department, description = EXCLUDED.description,
    is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
  restored_tables := array_append(restored_tables, 'locations');

  INSERT INTO public.units (id, name, is_active, created_at, updated_at)
  SELECT id, name, is_active, created_at, updated_at
  FROM jsonb_populate_recordset(NULL::public.units, backup->'units')
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
  restored_tables := array_append(restored_tables, 'units');

  INSERT INTO public.items (
    id, item_name, item_type, category_id, location_id, unit_id,
    quantity, unit_price, asset_no, serial_no, brand, model,
    responsible_person, status, note, image_url,
    created_by, updated_by, deleted_by, deleted_at,
    depreciation_enabled, depreciation_method, depreciation_cost,
    depreciation_useful_life_years, depreciation_start_basis,
    depreciation_start_date, depreciation_residual_value,
    created_at, updated_at
  )
  SELECT
    id, item_name, item_type, category_id, location_id, unit_id,
    quantity, unit_price, asset_no, serial_no, brand, model,
    responsible_person, status, note, image_url,
    created_by, updated_by, deleted_by, deleted_at,
    COALESCE(depreciation_enabled, false), depreciation_method, depreciation_cost,
    depreciation_useful_life_years, depreciation_start_basis,
    depreciation_start_date, COALESCE(depreciation_residual_value, 1),
    created_at, updated_at
  FROM jsonb_populate_recordset(NULL::public.items, backup->'items')
  ON CONFLICT (id) DO UPDATE SET
    item_name = EXCLUDED.item_name, item_type = EXCLUDED.item_type,
    category_id = EXCLUDED.category_id, location_id = EXCLUDED.location_id,
    unit_id = EXCLUDED.unit_id, quantity = EXCLUDED.quantity,
    unit_price = EXCLUDED.unit_price, asset_no = EXCLUDED.asset_no,
    serial_no = EXCLUDED.serial_no, brand = EXCLUDED.brand,
    model = EXCLUDED.model, responsible_person = EXCLUDED.responsible_person,
    status = EXCLUDED.status, note = EXCLUDED.note,
    image_url = EXCLUDED.image_url, created_by = EXCLUDED.created_by,
    updated_by = EXCLUDED.updated_by, deleted_by = EXCLUDED.deleted_by,
    deleted_at = EXCLUDED.deleted_at,
    depreciation_enabled = EXCLUDED.depreciation_enabled,
    depreciation_method = EXCLUDED.depreciation_method,
    depreciation_cost = EXCLUDED.depreciation_cost,
    depreciation_useful_life_years = EXCLUDED.depreciation_useful_life_years,
    depreciation_start_basis = EXCLUDED.depreciation_start_basis,
    depreciation_start_date = EXCLUDED.depreciation_start_date,
    depreciation_residual_value = EXCLUDED.depreciation_residual_value,
    updated_at = EXCLUDED.updated_at;
  restored_tables := array_append(restored_tables, 'items');

  RETURN json_build_object('ok', true, 'tables_restored', restored_tables);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.restore_database_backup(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.restore_database_backup(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.restore_database_backup(jsonb) TO authenticated;

INSERT INTO public.app_migrations (migration)
VALUES ('00043_add_icon_to_categories.sql')
ON CONFLICT (migration) DO NOTHING;
