-- Migration 00026: Restore a complete backup in one database transaction.
-- The function is admin-only and SECURITY DEFINER so RLS cannot create
-- a partially restored backup across the six registry tables.

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

  IF jsonb_typeof(backup->'profiles') <> 'array'
     OR jsonb_typeof(backup->'categories') <> 'array'
     OR jsonb_typeof(backup->'locations') <> 'array'
     OR jsonb_typeof(backup->'units') <> 'array'
     OR jsonb_typeof(backup->'items') <> 'array'
     OR jsonb_typeof(backup->'audit_logs') <> 'array' THEN
    RETURN json_build_object('ok', false, 'error', 'Backup is missing one or more required tables');
  END IF;

  INSERT INTO public.profiles (id, full_name, email, role, is_active, created_at, updated_at)
  SELECT id, full_name, email, role, is_active, created_at, updated_at
  FROM jsonb_populate_recordset(NULL::public.profiles, backup->'profiles')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name, email = EXCLUDED.email, role = EXCLUDED.role,
    is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
  restored_tables := array_append(restored_tables, 'profiles');

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
    room = EXCLUDED.room, department = EXCLUDED.department, description = EXCLUDED.description,
    is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
  restored_tables := array_append(restored_tables, 'locations');

  INSERT INTO public.units (id, name, is_active, created_at, updated_at)
  SELECT id, name, is_active, created_at, updated_at
  FROM jsonb_populate_recordset(NULL::public.units, backup->'units')
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
  restored_tables := array_append(restored_tables, 'units');

  INSERT INTO public.items (id, item_name, item_type, category_id, quantity, unit_price, unit_id, asset_no, serial_no, brand, model, location_id, responsible_person, status, note, image_url, created_by, updated_by, deleted_by, created_at, updated_at, deleted_at)
  SELECT id, item_name, item_type, category_id, quantity, unit_price, unit_id, asset_no, serial_no, brand, model, location_id, responsible_person, status, note, image_url, created_by, updated_by, deleted_by, created_at, updated_at, deleted_at
  FROM jsonb_populate_recordset(NULL::public.items, backup->'items')
  ON CONFLICT (id) DO UPDATE SET
    item_name = EXCLUDED.item_name, item_type = EXCLUDED.item_type, category_id = EXCLUDED.category_id,
    quantity = EXCLUDED.quantity, unit_price = EXCLUDED.unit_price, unit_id = EXCLUDED.unit_id,
    asset_no = EXCLUDED.asset_no, serial_no = EXCLUDED.serial_no, brand = EXCLUDED.brand,
    model = EXCLUDED.model, location_id = EXCLUDED.location_id, responsible_person = EXCLUDED.responsible_person,
    status = EXCLUDED.status, note = EXCLUDED.note, image_url = EXCLUDED.image_url,
    created_by = EXCLUDED.created_by, updated_by = EXCLUDED.updated_by, deleted_by = EXCLUDED.deleted_by,
    deleted_at = EXCLUDED.deleted_at, updated_at = EXCLUDED.updated_at;
  restored_tables := array_append(restored_tables, 'items');

  INSERT INTO public.audit_logs (id, user_id, action, target_table, target_id, old_data, new_data, created_at)
  SELECT id, user_id, action, target_table, target_id, old_data, new_data, created_at
  FROM jsonb_populate_recordset(NULL::public.audit_logs, backup->'audit_logs')
  ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.user_id, action = EXCLUDED.action, target_table = EXCLUDED.target_table,
    target_id = EXCLUDED.target_id, old_data = EXCLUDED.old_data, new_data = EXCLUDED.new_data,
    created_at = EXCLUDED.created_at;
  restored_tables := array_append(restored_tables, 'audit_logs');

  INSERT INTO public.audit_logs (user_id, action, target_table, new_data)
  VALUES (auth.uid(), 'DATABASE_RESTORE', 'all', jsonb_build_object('tables_restored', restored_tables));

  RETURN json_build_object('ok', true, 'tables_restored', restored_tables);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.restore_database_backup(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_database_backup(jsonb) TO authenticated;
