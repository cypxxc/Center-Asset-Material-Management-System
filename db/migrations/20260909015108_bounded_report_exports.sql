-- Bounded report responses and cursor-based exports. All reads retain caller RLS.
BEGIN;

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
SECURITY INVOKER
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
    i.created_at,
    i.note,
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
    CASE WHEN COALESCE(NULLIF(p_sort_by, ''), 'updated_at') = 'item_name' AND CASE WHEN p_sort_dir = 'asc' THEN 'asc' ELSE 'desc' END = 'asc' THEN item_name COLLATE "th-TH-x-icu" END ASC NULLS LAST,
    CASE WHEN COALESCE(NULLIF(p_sort_by, ''), 'updated_at') = 'item_name' AND CASE WHEN p_sort_dir = 'asc' THEN 'asc' ELSE 'desc' END = 'desc' THEN item_name COLLATE "th-TH-x-icu" END DESC NULLS LAST,
    CASE WHEN COALESCE(NULLIF(p_sort_by, ''), 'updated_at') = 'category' AND CASE WHEN p_sort_dir = 'asc' THEN 'asc' ELSE 'desc' END = 'asc' THEN category_name COLLATE "th-TH-x-icu" END ASC NULLS LAST,
    CASE WHEN COALESCE(NULLIF(p_sort_by, ''), 'updated_at') = 'category' AND CASE WHEN p_sort_dir = 'asc' THEN 'asc' ELSE 'desc' END = 'desc' THEN category_name COLLATE "th-TH-x-icu" END DESC NULLS LAST,
    CASE WHEN COALESCE(NULLIF(p_sort_by, ''), 'updated_at') = 'quantity' AND CASE WHEN p_sort_dir = 'asc' THEN 'asc' ELSE 'desc' END = 'asc' THEN quantity END ASC NULLS LAST,
    CASE WHEN COALESCE(NULLIF(p_sort_by, ''), 'updated_at') = 'quantity' AND CASE WHEN p_sort_dir = 'asc' THEN 'asc' ELSE 'desc' END = 'desc' THEN quantity END DESC NULLS LAST,
    CASE WHEN COALESCE(NULLIF(p_sort_by, ''), 'updated_at') = 'unit_price' AND CASE WHEN p_sort_dir = 'asc' THEN 'asc' ELSE 'desc' END = 'asc' THEN unit_price END ASC NULLS LAST,
    CASE WHEN COALESCE(NULLIF(p_sort_by, ''), 'updated_at') = 'unit_price' AND CASE WHEN p_sort_dir = 'asc' THEN 'asc' ELSE 'desc' END = 'desc' THEN unit_price END DESC NULLS LAST,
    CASE WHEN COALESCE(NULLIF(p_sort_by, ''), 'updated_at') = 'total_price' AND CASE WHEN p_sort_dir = 'asc' THEN 'asc' ELSE 'desc' END = 'asc' THEN COALESCE(unit_price, 0) * quantity END ASC NULLS LAST,
    CASE WHEN COALESCE(NULLIF(p_sort_by, ''), 'updated_at') = 'total_price' AND CASE WHEN p_sort_dir = 'asc' THEN 'asc' ELSE 'desc' END = 'desc' THEN COALESCE(unit_price, 0) * quantity END DESC NULLS LAST,
    CASE WHEN COALESCE(NULLIF(p_sort_by, ''), 'updated_at') = 'status' AND CASE WHEN p_sort_dir = 'asc' THEN 'asc' ELSE 'desc' END = 'asc' THEN status END ASC NULLS LAST,
    CASE WHEN COALESCE(NULLIF(p_sort_by, ''), 'updated_at') = 'status' AND CASE WHEN p_sort_dir = 'asc' THEN 'asc' ELSE 'desc' END = 'desc' THEN status END DESC NULLS LAST,
    CASE WHEN COALESCE(NULLIF(p_sort_by, ''), 'updated_at') = 'item_type' AND CASE WHEN p_sort_dir = 'asc' THEN 'asc' ELSE 'desc' END = 'asc' THEN item_type END ASC NULLS LAST,
    CASE WHEN COALESCE(NULLIF(p_sort_by, ''), 'updated_at') = 'item_type' AND CASE WHEN p_sort_dir = 'asc' THEN 'asc' ELSE 'desc' END = 'desc' THEN item_type END DESC NULLS LAST,
    CASE WHEN COALESCE(NULLIF(p_sort_by, ''), 'updated_at') = 'created_at' AND CASE WHEN p_sort_dir = 'asc' THEN 'asc' ELSE 'desc' END = 'asc' THEN created_at END ASC NULLS LAST,
    CASE WHEN COALESCE(NULLIF(p_sort_by, ''), 'updated_at') = 'created_at' AND CASE WHEN p_sort_dir = 'asc' THEN 'asc' ELSE 'desc' END = 'desc' THEN created_at END DESC NULLS LAST,
    CASE WHEN COALESCE(NULLIF(p_sort_by, ''), 'updated_at') = 'updated_at' AND CASE WHEN p_sort_dir = 'asc' THEN 'asc' ELSE 'desc' END = 'asc' THEN updated_at END ASC NULLS LAST,
    CASE WHEN COALESCE(NULLIF(p_sort_by, ''), 'updated_at') = 'updated_at' AND CASE WHEN p_sort_dir = 'asc' THEN 'asc' ELSE 'desc' END = 'desc' THEN updated_at END DESC NULLS LAST,
    CASE WHEN p_sort_by IS NOT NULL AND p_sort_by <> '' AND p_sort_by NOT IN ('item_name', 'category', 'quantity', 'unit_price', 'total_price', 'status', 'item_type', 'created_at', 'updated_at') THEN updated_at END DESC NULLS LAST,
    id ASC
),
paged AS (
  SELECT *
  FROM ordered
  LIMIT LEAST(GREATEST(COALESCE(p_page_size, 15), 1), 1000)
  OFFSET (GREATEST(p_page, 1)::bigint - 1) * LEAST(GREATEST(COALESCE(p_page_size, 15), 1), 1000)
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
  'total_pages', GREATEST(1, CEIL(totals.total_count::numeric / LEAST(GREATEST(COALESCE(p_page_size, 15), 1), 1000))::int),
  'page', GREATEST(p_page, 1),
  'audited_count', totals.audited_count,
  'overdue_audit_items', '[]'::json
)
FROM totals;
$$;


CREATE OR REPLACE FUNCTION public.get_report_export_batch(
  p_q text DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_location_id uuid DEFAULT NULL,
  p_sort_by text DEFAULT 'updated_at',
  p_sort_dir text DEFAULT 'desc',
  p_after jsonb DEFAULT NULL,
  p_batch_size int DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  sort_expr text;
  cast_type text;
  direction text := CASE WHEN p_sort_dir = 'asc' THEN 'ASC' ELSE 'DESC' END;
  comparison text;
  cursor_expr text;
  cursor_id uuid;
  batch_limit int := LEAST(GREATEST(COALESCE(p_batch_size, 500), 1), 1000);
  result jsonb;
BEGIN
  -- Only these constant expressions and types may enter the SQL string.
  CASE p_sort_by
    WHEN 'item_name' THEN sort_expr := 'i.item_name COLLATE "th-TH-x-icu"'; cast_type := 'text';
    WHEN 'category' THEN sort_expr := 'c.name COLLATE "th-TH-x-icu"'; cast_type := 'text';
    WHEN 'quantity' THEN sort_expr := 'i.quantity'; cast_type := 'numeric';
    WHEN 'unit_price' THEN sort_expr := 'i.unit_price'; cast_type := 'numeric';
    WHEN 'total_price' THEN sort_expr := 'COALESCE(i.unit_price, 0) * i.quantity'; cast_type := 'numeric';
    WHEN 'status' THEN sort_expr := 'i.status'; cast_type := 'text';
    WHEN 'item_type' THEN sort_expr := 'i.item_type'; cast_type := 'text';
    WHEN 'created_at' THEN sort_expr := 'i.created_at'; cast_type := 'timestamptz';
    ELSE sort_expr := 'i.updated_at'; cast_type := 'timestamptz';
  END CASE;
  IF p_sort_by IS NOT NULL AND p_sort_by <> '' AND p_sort_by NOT IN ('item_name','category','quantity','unit_price','total_price','status','item_type','created_at','updated_at') THEN
    direction := 'DESC';
  END IF;
  comparison := CASE WHEN direction = 'ASC' THEN '>' ELSE '<' END;
  cursor_expr := format('($6->>''value'')::%s', cast_type);
  IF p_sort_by IN ('item_name', 'category') THEN
    cursor_expr := cursor_expr || ' COLLATE "th-TH-x-icu"';
  END IF;
  IF p_after IS NOT NULL THEN
    IF jsonb_typeof(p_after) <> 'object' OR NOT (p_after ? 'id') OR NOT (p_after ? 'value')
      OR jsonb_typeof(p_after->'id') <> 'string'
      OR jsonb_typeof(p_after->'value') NOT IN ('null', 'string', 'number') THEN
      RAISE EXCEPTION 'Invalid export cursor' USING ERRCODE = '22023';
    END IF;
    cursor_id := (p_after->>'id')::uuid;
    -- Validate before scanning, including when no rows match the filters.
    EXECUTE format('SELECT ($1->>''value'')::%s', cast_type) USING p_after;
  END IF;
  EXECUTE format($query$
    WITH batch AS MATERIALIZED (
      SELECT i.id, %1$s AS sort_value,
        jsonb_build_object(
          'id', i.id, 'item_name', i.item_name, 'item_type', i.item_type,
          'quantity', i.quantity, 'unit_price', i.unit_price,
          'asset_no', i.asset_no, 'serial_no', i.serial_no,
          'brand', i.brand, 'model', i.model, 'responsible_person', i.responsible_person,
          'status', i.status, 'note', i.note, 'created_at', i.created_at, 'updated_at', i.updated_at,
          'category', CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('id',c.id,'name',c.name) END,
          'unit', CASE WHEN u.id IS NULL THEN NULL ELSE jsonb_build_object('id',u.id,'name',u.name) END,
          'location', CASE WHEN l.id IS NULL THEN NULL ELSE jsonb_build_object('id',l.id,'name',l.name) END
        ) AS item
      FROM public.items i
      LEFT JOIN public.categories c ON c.id = i.category_id
      LEFT JOIN public.units u ON u.id = i.unit_id
      LEFT JOIN public.locations l ON l.id = i.location_id
      WHERE i.deleted_at IS NULL
      AND (NULLIF($1, '') IS NULL OR i.item_name ILIKE '%%' || $1 || '%%'
        OR i.asset_no ILIKE '%%' || $1 || '%%' OR i.serial_no ILIKE '%%' || $1 || '%%'
        OR i.brand ILIKE '%%' || $1 || '%%' OR i.model ILIKE '%%' || $1 || '%%'
        OR i.responsible_person ILIKE '%%' || $1 || '%%')
      AND (NULLIF($2, '') IS NULL OR i.item_type = $2)
      AND (NULLIF($3, '') IS NULL OR i.status = $3)
      AND ($4 IS NULL OR i.category_id = $4)
      AND ($5 IS NULL OR i.location_id = $5)
      AND ($6 IS NULL
        OR (($6->>'value') IS NULL AND %1$s IS NULL AND i.id > $7)
        OR (($6->>'value') IS NOT NULL AND (
          %1$s IS NULL OR %1$s %3$s %4$s OR (%1$s = %4$s AND i.id > $7))))
      ORDER BY %1$s %2$s NULLS LAST, i.id ASC
      LIMIT $8
    ), numbered AS (
      SELECT *, row_number() OVER (ORDER BY sort_value %2$s NULLS LAST, id ASC) AS position FROM batch
    )
    SELECT jsonb_build_object(
      'items', COALESCE(jsonb_agg(item ORDER BY position), '[]'::jsonb),
      'next_cursor', CASE WHEN count(*) = $8 THEN
        (SELECT jsonb_build_object('value',sort_value,'id',id) FROM numbered ORDER BY position DESC LIMIT 1)
        ELSE NULL END)
    FROM numbered
  $query$, sort_expr, direction, comparison, cursor_expr)
  INTO result USING p_q, p_type, p_status, p_category_id, p_location_id, p_after, cursor_id, batch_limit;
  RETURN result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_report_items_page(text, text, text, uuid, uuid, text, text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_report_items_page(text, text, text, uuid, uuid, text, text, int, int) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_report_export_batch(text, text, text, uuid, uuid, text, text, jsonb, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_report_export_batch(text, text, text, uuid, uuid, text, text, jsonb, int) TO authenticated, service_role;

COMMIT;
