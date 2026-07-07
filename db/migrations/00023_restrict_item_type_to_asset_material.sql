-- Migration 00023: Restrict item_type to the two sidebar-supported types.
-- Existing "general" rows are folded into "material" before tightening checks.

BEGIN;

UPDATE public.items
SET item_type = 'material'
WHERE item_type = 'general';

DO $$
DECLARE
  check_name text;
BEGIN
  FOR check_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'items'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%item_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.items DROP CONSTRAINT %I', check_name);
  END LOOP;
END $$;

ALTER TABLE public.items
  ADD CONSTRAINT items_item_type_asset_material_check
  CHECK (item_type IN ('material', 'asset'));

CREATE OR REPLACE FUNCTION public.import_items_bulk_tx(
  items_json json,
  creator_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_role text;
    item_row json;
    item_name_val text;
    item_type_val text;
    category_name_val text;
    location_name_val text;
    unit_name_val text;
    quantity_val int;
    status_val text;
    asset_no_val text;
    serial_no_val text;
    brand_val text;
    model_val text;
    location_id_val uuid;
    category_id_val uuid;
    unit_id_val uuid;
    responsible_person_val text;
    note_val text;
    inserted_count int := 0;
    current_row_idx int := 0;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN json_build_object('ok', false, 'error', 'Unauthorized: Please log in');
    END IF;

    SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();

    IF caller_role IS NULL OR caller_role NOT IN ('admin', 'staff') THEN
        RETURN json_build_object('ok', false, 'error', 'Forbidden: Only administrators or staff can import data');
    END IF;

    IF creator_id != auth.uid() AND caller_role != 'admin' THEN
        RETURN json_build_object('ok', false, 'error', 'Forbidden: Cannot import data on behalf of another user');
    END IF;

    FOR item_row IN SELECT json_array_elements(items_json)
    LOOP
        current_row_idx := current_row_idx + 1;

        item_name_val := item_row->>'item_name';
        item_type_val := COALESCE(item_row->>'item_type', 'asset');
        category_name_val := item_row->>'category_name';
        location_name_val := item_row->>'location_name';
        unit_name_val := item_row->>'unit_name';
        quantity_val := COALESCE((item_row->>'quantity')::int, 1);
        status_val := COALESCE(item_row->>'status', 'active');
        asset_no_val := item_row->>'asset_no';
        serial_no_val := item_row->>'serial_no';
        brand_val := item_row->>'brand';
        model_val := item_row->>'model';
        responsible_person_val := item_row->>'responsible_person';
        note_val := item_row->>'note';

        IF item_name_val IS NULL OR TRIM(item_name_val) = '' THEN
            RAISE EXCEPTION 'ชื่อสิ่งของ (item_name) ห้ามว่าง';
        END IF;

        IF item_type_val NOT IN ('asset', 'material') THEN
            RAISE EXCEPTION 'ประเภทสิ่งของ (item_type) ต้องเป็น asset หรือ material';
        END IF;

        category_id_val := NULL;
        IF category_name_val IS NOT NULL AND TRIM(category_name_val) != '' THEN
            SELECT id INTO category_id_val
            FROM public.categories
            WHERE LOWER(name) = LOWER(TRIM(category_name_val));

            IF category_id_val IS NULL THEN
                INSERT INTO public.categories (name, is_active)
                VALUES (TRIM(category_name_val), true)
                RETURNING id INTO category_id_val;
            END IF;
        END IF;

        location_id_val := NULL;
        IF location_name_val IS NOT NULL AND TRIM(location_name_val) != '' THEN
            SELECT id INTO location_id_val
            FROM public.locations
            WHERE LOWER(name) = LOWER(TRIM(location_name_val));

            IF location_id_val IS NULL THEN
                INSERT INTO public.locations (name, is_active)
                VALUES (TRIM(location_name_val), true)
                RETURNING id INTO location_id_val;
            END IF;
        END IF;

        unit_id_val := NULL;
        IF unit_name_val IS NOT NULL AND TRIM(unit_name_val) != '' THEN
            SELECT id INTO unit_id_val
            FROM public.units
            WHERE LOWER(name) = LOWER(TRIM(unit_name_val));

            IF unit_id_val IS NULL THEN
                INSERT INTO public.units (name, is_active)
                VALUES (TRIM(unit_name_val), true)
                RETURNING id INTO unit_id_val;
            END IF;
        END IF;

        BEGIN
            INSERT INTO public.items (
                item_name, item_type, category_id, quantity, unit_id,
                asset_no, serial_no, brand, model, location_id,
                responsible_person, status, note, created_by, updated_by
            ) VALUES (
                TRIM(item_name_val), item_type_val, category_id_val, quantity_val, unit_id_val,
                NULLIF(TRIM(asset_no_val), ''), NULLIF(TRIM(serial_no_val), ''),
                NULLIF(TRIM(brand_val), ''), NULLIF(TRIM(model_val), ''), location_id_val,
                NULLIF(TRIM(responsible_person_val), ''), status_val, NULLIF(TRIM(note_val), ''),
                creator_id, creator_id
            );
        EXCEPTION WHEN OTHERS THEN
            DECLARE
                error_msg text := SQLERRM;
            BEGIN
                IF error_msg LIKE '%unique_asset_no%' THEN
                    error_msg := 'เลขครุภัณฑ์ "' || COALESCE(asset_no_val, '') || '" ซ้ำกับที่มีอยู่ในระบบ';
                ELSIF error_msg LIKE '%unique_serial_no%' THEN
                    error_msg := 'Serial Number "' || COALESCE(serial_no_val, '') || '" ซ้ำกับที่มีอยู่ในระบบ';
                END IF;

                RAISE EXCEPTION 'แถวที่ %: %', (current_row_idx + 1), error_msg;
            END;
        END;

        inserted_count := inserted_count + 1;
    END LOOP;

    RETURN json_build_object('ok', true, 'count', inserted_count);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_items_bulk_tx(json, uuid) TO authenticated;

COMMIT;
