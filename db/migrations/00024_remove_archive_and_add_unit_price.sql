-- Migration 00024: Remove archive semantics and store explicit item unit prices.

BEGIN;

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS unit_price numeric(12,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'items_unit_price_non_negative_check'
  ) THEN
    ALTER TABLE public.items
      ADD CONSTRAINT items_unit_price_non_negative_check
      CHECK (unit_price IS NULL OR unit_price >= 0);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_sidebar_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
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
            COUNT(i.id)::int AS count
        FROM public.categories c
        LEFT JOIN public.items i ON i.category_id = c.id
            AND i.deleted_at IS NULL
            AND i.item_type = 'asset'
        WHERE c.is_active = true
        GROUP BY c.id, c.name
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
        'total_assets', COUNT(CASE WHEN item_type = 'asset' AND deleted_at IS NULL THEN 1 END)::int,
        'total_supplies', COUNT(CASE WHEN item_type = 'material' AND deleted_at IS NULL THEN 1 END)::int,
        'archive_count', 0,
        'trash_count', COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END)::int
    ) INTO counts_json
    FROM public.items;

    RETURN json_build_object(
        'categories', COALESCE(categories_json, '[]'::json),
        'locations', COALESCE(locations_json, '[]'::json),
        'counts', counts_json
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_report_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    type_counts json;
    status_counts json;
    category_counts json;
    totals json;
    location_count int;
BEGIN
    SELECT COUNT(*)::int INTO location_count FROM public.locations;

    SELECT json_build_object(
        'total_items', COUNT(*)::int,
        'total_quantity', COALESCE(SUM(quantity)::int, 0)
    ) INTO totals
    FROM public.items
    WHERE deleted_at IS NULL;

    SELECT json_object_agg(item_type, json_build_object('count', cnt::int, 'qty', qty::int)) INTO type_counts
    FROM (
        SELECT
            item_type,
            COUNT(*) AS cnt,
            COALESCE(SUM(quantity), 0) AS qty
        FROM public.items
        WHERE deleted_at IS NULL
        GROUP BY item_type
    ) t;

    SELECT json_object_agg(status, json_build_object('count', cnt::int, 'qty', qty::int)) INTO status_counts
    FROM (
        SELECT
            status,
            COUNT(*) AS cnt,
            COALESCE(SUM(quantity), 0) AS qty
        FROM public.items
        WHERE deleted_at IS NULL
        GROUP BY status
    ) t;

    SELECT json_object_agg(COALESCE(c.name, 'ทั่วไป'), json_build_object('count', cnt::int, 'qty', qty::int)) INTO category_counts
    FROM (
        SELECT
            category_id,
            COUNT(*) AS cnt,
            COALESCE(SUM(quantity), 0) AS qty
        FROM public.items
        WHERE deleted_at IS NULL
        GROUP BY category_id
    ) i
    LEFT JOIN public.categories c ON c.id = i.category_id;

    RETURN json_build_object(
        'total_items', COALESCE((totals->>'total_items')::int, 0),
        'total_quantity', COALESCE((totals->>'total_quantity')::int, 0),
        'type_counts', COALESCE(type_counts, '{}'::json),
        'status_counts', COALESCE(status_counts, '{}'::json),
        'category_counts', COALESCE(category_counts, '{}'::json),
        'location_count', location_count
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_report_items_page(
  p_q text DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_location_id uuid DEFAULT NULL,
  p_sort_by text DEFAULT 'updated_at',
  p_sort_dir text DEFAULT 'desc',
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 15
)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
WITH filtered AS (
  SELECT
    i.id,
    i.item_name,
    i.item_type,
    i.quantity,
    i.unit_price,
    i.asset_no,
    i.serial_no,
    i.brand,
    i.model,
    i.responsible_person,
    i.status,
    i.updated_at,
    c.id AS category_id,
    c.name AS category_name,
    u.id AS unit_id,
    u.name AS unit_name,
    l.id AS location_id,
    l.name AS location_name
  FROM public.items i
  LEFT JOIN public.categories c ON c.id = i.category_id
  LEFT JOIN public.units u ON u.id = i.unit_id
  LEFT JOIN public.locations l ON l.id = i.location_id
  WHERE i.deleted_at IS NULL
    AND (
      NULLIF(p_q, '') IS NULL
      OR i.item_name ILIKE '%' || p_q || '%'
      OR i.asset_no ILIKE '%' || p_q || '%'
      OR i.serial_no ILIKE '%' || p_q || '%'
      OR i.brand ILIKE '%' || p_q || '%'
      OR i.model ILIKE '%' || p_q || '%'
      OR i.responsible_person ILIKE '%' || p_q || '%'
    )
    AND (NULLIF(p_type, '') IS NULL OR i.item_type = p_type)
    AND (NULLIF(p_status, '') IS NULL OR i.status = p_status)
    AND (p_category_id IS NULL OR i.category_id = p_category_id)
    AND (p_location_id IS NULL OR i.location_id = p_location_id)
),
totals AS (
  SELECT
    COUNT(*)::int AS total_count,
    COALESCE(SUM(quantity), 0)::int AS total_quantity,
    COALESCE(SUM(COALESCE(unit_price, 0) * quantity), 0)::numeric AS total_value,
    COUNT(*) FILTER (WHERE updated_at >= now() - interval '30 days')::int AS audited_count
  FROM filtered
),
ordered AS (
  SELECT *
  FROM filtered
  ORDER BY
    CASE WHEN p_sort_by = 'item_name' AND p_sort_dir = 'asc' THEN item_name COLLATE "th-TH-x-icu" END ASC,
    CASE WHEN p_sort_by = 'item_name' AND p_sort_dir <> 'asc' THEN item_name COLLATE "th-TH-x-icu" END DESC,
    CASE WHEN p_sort_by = 'category' AND p_sort_dir = 'asc' THEN category_name COLLATE "th-TH-x-icu" END ASC,
    CASE WHEN p_sort_by = 'category' AND p_sort_dir <> 'asc' THEN category_name COLLATE "th-TH-x-icu" END DESC,
    CASE WHEN p_sort_by = 'quantity' AND p_sort_dir = 'asc' THEN quantity END ASC,
    CASE WHEN p_sort_by = 'quantity' AND p_sort_dir <> 'asc' THEN quantity END DESC,
    CASE WHEN p_sort_by = 'unit_price' AND p_sort_dir = 'asc' THEN unit_price END ASC,
    CASE WHEN p_sort_by = 'unit_price' AND p_sort_dir <> 'asc' THEN unit_price END DESC,
    CASE WHEN p_sort_by = 'total_price' AND p_sort_dir = 'asc' THEN COALESCE(unit_price, 0) * quantity END ASC,
    CASE WHEN p_sort_by = 'total_price' AND p_sort_dir <> 'asc' THEN COALESCE(unit_price, 0) * quantity END DESC,
    CASE WHEN (p_sort_by IS NULL OR p_sort_by = '' OR p_sort_by = 'updated_at') AND p_sort_dir = 'asc' THEN updated_at END ASC,
    CASE WHEN (p_sort_by IS NULL OR p_sort_by = '' OR p_sort_by = 'updated_at') AND p_sort_dir <> 'asc' THEN updated_at END DESC,
    updated_at DESC
),
paged AS (
  SELECT *
  FROM ordered
  LIMIT GREATEST(p_page_size, 1)
  OFFSET (GREATEST(p_page, 1) - 1) * GREATEST(p_page_size, 1)
),
overdue AS (
  SELECT *
  FROM ordered
  WHERE status IN ('damaged', 'waiting_repair')
)
SELECT json_build_object(
  'items', COALESCE((
    SELECT json_agg(json_build_object(
      'id', id,
      'item_name', item_name,
      'item_type', item_type,
      'quantity', quantity,
      'unit_price', unit_price,
      'asset_no', asset_no,
      'serial_no', serial_no,
      'brand', brand,
      'model', model,
      'responsible_person', responsible_person,
      'status', status,
      'updated_at', updated_at,
      'category', CASE WHEN category_id IS NULL THEN NULL ELSE json_build_object('id', category_id, 'name', category_name) END,
      'unit', CASE WHEN unit_id IS NULL THEN NULL ELSE json_build_object('id', unit_id, 'name', unit_name) END,
      'location', CASE WHEN location_id IS NULL THEN NULL ELSE json_build_object('id', location_id, 'name', location_name) END
    ))
    FROM paged
  ), '[]'::json),
  'total_count', totals.total_count,
  'total_quantity', totals.total_quantity,
  'total_value', totals.total_value,
  'total_pages', GREATEST(1, CEIL(totals.total_count::numeric / GREATEST(p_page_size, 1))::int),
  'page', GREATEST(p_page, 1),
  'audited_count', totals.audited_count,
  'overdue_audit_items', COALESCE((
    SELECT json_agg(json_build_object(
      'id', id,
      'item_name', item_name,
      'item_type', item_type,
      'quantity', quantity,
      'unit_price', unit_price,
      'asset_no', asset_no,
      'serial_no', serial_no,
      'brand', brand,
      'model', model,
      'responsible_person', responsible_person,
      'status', status,
      'updated_at', updated_at,
      'category', CASE WHEN category_id IS NULL THEN NULL ELSE json_build_object('id', category_id, 'name', category_name) END,
      'unit', CASE WHEN unit_id IS NULL THEN NULL ELSE json_build_object('id', unit_id, 'name', unit_name) END,
      'location', CASE WHEN location_id IS NULL THEN NULL ELSE json_build_object('id', location_id, 'name', location_name) END
    ))
    FROM overdue
  ), '[]'::json)
)
FROM totals;
$$;

GRANT EXECUTE ON FUNCTION public.get_sidebar_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_report_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_report_items_page(text, text, text, uuid, uuid, text, text, int, int) TO authenticated;

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

        IF unit_price_val IS NOT NULL AND unit_price_val < 0 THEN
            RAISE EXCEPTION 'ราคาต่อหน่วย (unit_price) ต้องไม่ติดลบ';
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
                item_name, item_type, category_id, quantity, unit_price, unit_id,
                asset_no, serial_no, brand, model, location_id,
                responsible_person, status, note, created_by, updated_by
            ) VALUES (
                TRIM(item_name_val), item_type_val, category_id_val, quantity_val, unit_price_val, unit_id_val,
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
