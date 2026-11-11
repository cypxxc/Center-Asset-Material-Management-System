ALTER TABLE public.items ADD COLUMN IF NOT EXISTS qualification_status text;
COMMENT ON COLUMN public.items.qualification_status IS 'Equipment qualification status; independent from item_type.';
DO $$ BEGIN
  ALTER TABLE public.items ADD CONSTRAINT items_qualification_status_check
    CHECK (qualification_status IS NULL OR qualification_status IN ('qualified', 'below_threshold'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS items_qualification_status_index
  ON public.items (qualification_status)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.import_items_bulk_tx(
  items_json json,
  creator_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    caller_role text;
    item_row json;
    item_name_val text;
    item_type_val text;
    qualification_status_val text;
    category_name_val text;
    location_name_val text;
    unit_name_val text;
    quantity_val int;
    unit_price_val numeric(12,2);
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
    IF (SELECT auth.uid()) IS NULL THEN
        RETURN json_build_object('ok', false, 'error', 'Unauthorized: Please log in');
    END IF;

    SELECT profile.role
    INTO caller_role
    FROM public.profiles AS profile
    WHERE profile.id = (SELECT auth.uid())
      AND profile.is_active = true;

    IF caller_role IS NULL OR caller_role NOT IN ('admin', 'staff') THEN
        RETURN json_build_object('ok', false, 'error', 'Forbidden: Only active administrators or staff can import data');
    END IF;

    IF creator_id IS DISTINCT FROM (SELECT auth.uid()) AND caller_role <> 'admin' THEN
        RETURN json_build_object('ok', false, 'error', 'Forbidden: Cannot import data on behalf of another user');
    END IF;

    FOR item_row IN SELECT json_array_elements(items_json)
    LOOP
        current_row_idx := current_row_idx + 1;

        item_name_val := item_row->>'item_name';
        item_type_val := COALESCE(item_row->>'item_type', 'asset');
        qualification_status_val := NULLIF(item_row->>'qualification_status', '');
        category_name_val := item_row->>'category_name';
        location_name_val := item_row->>'location_name';
        unit_name_val := item_row->>'unit_name';
        quantity_val := COALESCE((item_row->>'quantity')::int, 1);
        unit_price_val := NULLIF(item_row->>'unit_price', '')::numeric;
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

        IF qualification_status_val IS NOT NULL AND qualification_status_val NOT IN ('qualified', 'below_threshold') THEN
            RAISE EXCEPTION 'qualification_status must be qualified or below_threshold';
        END IF;

        IF unit_price_val IS NOT NULL AND unit_price_val < 0 THEN
            RAISE EXCEPTION 'ราคาต่อหน่วย (unit_price) ต้องไม่ติดลบ';
        END IF;

        category_id_val := NULL;
        IF category_name_val IS NOT NULL AND TRIM(category_name_val) <> '' THEN
            SELECT category.id
            INTO category_id_val
            FROM public.categories AS category
            WHERE LOWER(category.name) = LOWER(TRIM(category_name_val));

            IF category_id_val IS NULL THEN
                INSERT INTO public.categories (name, is_active)
                VALUES (TRIM(category_name_val), true)
                RETURNING id INTO category_id_val;
            END IF;
        END IF;

        location_id_val := NULL;
        IF location_name_val IS NOT NULL AND TRIM(location_name_val) <> '' THEN
            SELECT location.id
            INTO location_id_val
            FROM public.locations AS location
            WHERE LOWER(location.name) = LOWER(TRIM(location_name_val));

            IF location_id_val IS NULL THEN
                INSERT INTO public.locations (name, is_active)
                VALUES (TRIM(location_name_val), true)
                RETURNING id INTO location_id_val;
            END IF;
        END IF;

        unit_id_val := NULL;
        IF unit_name_val IS NOT NULL AND TRIM(unit_name_val) <> '' THEN
            SELECT unit.id
            INTO unit_id_val
            FROM public.units AS unit
            WHERE LOWER(unit.name) = LOWER(TRIM(unit_name_val));

            IF unit_id_val IS NULL THEN
                INSERT INTO public.units (name, is_active)
                VALUES (TRIM(unit_name_val), true)
                RETURNING id INTO unit_id_val;
            END IF;
        END IF;

        BEGIN
            INSERT INTO public.items (
                item_name, item_type, qualification_status, category_id, quantity, unit_price, unit_id,
                asset_no, serial_no, brand, model, location_id,
                responsible_person, status, note, created_by, updated_by
            ) VALUES (
                TRIM(item_name_val), item_type_val, qualification_status_val, category_id_val, quantity_val, unit_price_val, unit_id_val,
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

REVOKE EXECUTE ON FUNCTION public.import_items_bulk_tx(json, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_items_bulk_tx(json, uuid) TO authenticated;
