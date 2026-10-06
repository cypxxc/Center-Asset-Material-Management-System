-- Migration 00041: Admin DB panel maintenance hardening
-- 1. Enforce 5-second statement_timeout on exec_admin_sql to avoid runaway locks
-- 2. Update restore_database_backup to sync depreciation columns on public.items

CREATE OR REPLACE FUNCTION public.exec_admin_sql(sql_query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result_json json;
    affected_rows integer;
    cleaned_query text;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RETURN json_build_object('error', 'Forbidden: raw SQL is server-only', 'ok', false);
    END IF;

    IF sql_query IS NULL OR btrim(sql_query) = '' THEN
        RETURN json_build_object('error', 'SQL query is required', 'ok', false);
    END IF;

    -- Enforce 5-second statement timeout for sandbox safety
    PERFORM set_config('statement_timeout', '5000', true);

    -- Strip trailing semicolons and whitespace
    cleaned_query := regexp_replace(btrim(sql_query), ';+\s*$', '');

    -- Prevent statement stacking outside of DO blocks
    IF lower(cleaned_query) NOT LIKE 'do %' AND cleaned_query LIKE '%;%' THEN
        RETURN json_build_object('error', 'Multiple SQL statements are not permitted', 'ok', false);
    END IF;

    IF lower(cleaned_query) ~ '^(select|with|show|explain)\M' THEN
        SET TRANSACTION READ ONLY;
        EXECUTE 'SELECT json_agg(t) FROM (' || cleaned_query || ') t' INTO result_json;
        RETURN json_build_object('rows', COALESCE(result_json, '[]'::json), 'command', 'SELECT', 'ok', true);
    END IF;

    EXECUTE sql_query;
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RETURN json_build_object('rows', '[]'::json, 'command', 'COMMAND_OK', 'affected_rows', affected_rows, 'ok', true);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('error', 'SQL execution failed: ' || SQLERRM, 'code', SQLSTATE, 'ok', false);
END;
$$;

REVOKE ALL ON FUNCTION public.exec_admin_sql(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.exec_admin_sql(text) FROM anon;
REVOKE ALL ON FUNCTION public.exec_admin_sql(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.exec_admin_sql(text) TO service_role;

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

  INSERT INTO public.categories (id, name, description, is_active, created_at, updated_at)
  SELECT id, name, description, is_active, created_at, updated_at
  FROM jsonb_populate_recordset(NULL::public.categories, backup->'categories')
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, is_active = EXCLUDED.is_active,
    updated_at = EXCLUDED.updated_at;
  restored_tables := array_append(restored_tables, 'categories');

  INSERT INTO public.locations (id, name, building, floor, room, department, description, is_active, created_at, updated_at)
  SELECT id, name, building, floor, room, department, description, is_active, created_at, updated_at
  FROM jsonb_populate_recordset(NULL::public.locations, backup->'locations')
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, building = EXCLUDED.building, floor = EXCLUDED.floor,
    room = EXCLUDED.room, department = EXCLUDED.department, description = EXCLUDED.department,
    is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
  restored_tables := array_append(restored_tables, 'locations');

  INSERT INTO public.units (id, name, is_active, created_at, updated_at)
  SELECT id, name, is_active, created_at, updated_at
  FROM jsonb_populate_recordset(NULL::public.units, backup->'units')
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
  restored_tables := array_append(restored_tables, 'units');

  INSERT INTO public.items (
    id, item_name, item_type, category_id, quantity, unit_price, unit_id,
    asset_no, serial_no, brand, model, location_id, responsible_person, status,
    note, image_url, created_by, updated_by, deleted_by, created_at, updated_at, deleted_at,
    depreciation_enabled, depreciation_method, depreciation_cost,
    depreciation_useful_life_years, depreciation_start_basis, depreciation_start_date, depreciation_residual_value
  )
  SELECT
    id, item_name, item_type, category_id, quantity, unit_price, unit_id,
    asset_no, serial_no, brand, model, location_id, responsible_person, status,
    note, image_url, created_by, updated_by, deleted_by, created_at, updated_at, deleted_at,
    depreciation_enabled, depreciation_method, depreciation_cost,
    depreciation_useful_life_years, depreciation_start_basis, depreciation_start_date, depreciation_residual_value
  FROM jsonb_populate_recordset(NULL::public.items, backup->'items')
  ON CONFLICT (id) DO UPDATE SET
    item_name = EXCLUDED.item_name, item_type = EXCLUDED.item_type, category_id = EXCLUDED.category_id,
    quantity = EXCLUDED.quantity, unit_price = EXCLUDED.unit_price, unit_id = EXCLUDED.unit_id,
    asset_no = EXCLUDED.asset_no, serial_no = EXCLUDED.serial_no, brand = EXCLUDED.brand,
    model = EXCLUDED.model, location_id = EXCLUDED.location_id, responsible_person = EXCLUDED.responsible_person,
    status = EXCLUDED.status, note = EXCLUDED.note, image_url = EXCLUDED.image_url,
    created_by = EXCLUDED.created_by, updated_by = EXCLUDED.updated_by, deleted_by = EXCLUDED.deleted_by,
    deleted_at = EXCLUDED.deleted_at, updated_at = EXCLUDED.updated_at,
    depreciation_enabled = EXCLUDED.depreciation_enabled,
    depreciation_method = EXCLUDED.depreciation_method,
    depreciation_cost = EXCLUDED.depreciation_cost,
    depreciation_useful_life_years = EXCLUDED.depreciation_useful_life_years,
    depreciation_start_basis = EXCLUDED.depreciation_start_basis,
    depreciation_start_date = EXCLUDED.depreciation_start_date,
    depreciation_residual_value = EXCLUDED.depreciation_residual_value;
  restored_tables := array_append(restored_tables, 'items');

  INSERT INTO public.audit_logs (user_id, action, target_table, new_data)
  VALUES (auth.uid(), 'DATABASE_RESTORE', 'all', jsonb_build_object('tables_restored', restored_tables));

  RETURN json_build_object('ok', true, 'tables_restored', restored_tables);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.restore_database_backup(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_database_backup(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.restore_database_backup(jsonb) TO authenticated;
