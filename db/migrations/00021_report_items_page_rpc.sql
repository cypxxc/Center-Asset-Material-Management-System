-- Migration 00021: Paginated report ledger RPC.
-- Keeps report page loads from transferring every matching item to Node.

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
SECURITY DEFINER
SET search_path = public
AS $$
WITH filtered AS (
  SELECT
    i.id,
    i.item_name,
    i.item_type,
    i.quantity,
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
    AND (
      CASE
        WHEN p_status = 'archive' THEN i.status IN ('inactive', 'disposed')
        WHEN NULLIF(p_status, '') IS NOT NULL THEN i.status = p_status
        ELSE i.status NOT IN ('inactive', 'disposed')
      END
    )
    AND (p_category_id IS NULL OR i.category_id = p_category_id)
    AND (p_location_id IS NULL OR i.location_id = p_location_id)
),
valued AS (
  SELECT
    *,
    CASE
      WHEN lower(item_name) LIKE '%dell%' OR lower(item_name) LIKE '%latitude%' OR lower(item_name) LIKE '%macbook%' THEN 35000
      WHEN lower(item_name) LIKE '%chair%' OR lower(item_name) LIKE '%ergonomic%' THEN 5500
      WHEN lower(item_name) LIKE '%projector%' OR lower(item_name) LIKE '%epson%' THEN 18900
      WHEN lower(item_name) LIKE '%printer%' OR lower(item_name) LIKE '%laserjet%' THEN 8900
      WHEN lower(item_name) LIKE '%ipad%' OR lower(item_name) LIKE '%tablet%' THEN 16900
      WHEN lower(COALESCE(category_name, '')) LIKE '%it%' OR lower(COALESCE(category_name, '')) LIKE '%tech%' OR lower(COALESCE(category_name, '')) LIKE '%คอม%' THEN 12000
      WHEN lower(COALESCE(category_name, '')) LIKE '%เฟอร์%' OR lower(COALESCE(category_name, '')) LIKE '%โต๊ะ%' OR lower(COALESCE(category_name, '')) LIKE '%เก้าอี้%' THEN 3000
      WHEN lower(COALESCE(category_name, '')) LIKE '%av%' THEN 9000
      ELSE 1500
    END AS unit_price
  FROM filtered
),
totals AS (
  SELECT
    COUNT(*)::int AS total_count,
    COALESCE(SUM(quantity), 0)::int AS total_quantity,
    COALESCE(SUM(unit_price * quantity), 0)::int AS total_value,
    COUNT(*) FILTER (WHERE updated_at >= now() - interval '30 days')::int AS audited_count
  FROM valued
),
ordered AS (
  SELECT *
  FROM valued
  ORDER BY
    CASE WHEN p_sort_by = 'item_name' AND p_sort_dir = 'asc' THEN item_name COLLATE "th-TH-x-icu" END ASC,
    CASE WHEN p_sort_by = 'item_name' AND p_sort_dir <> 'asc' THEN item_name COLLATE "th-TH-x-icu" END DESC,
    CASE WHEN p_sort_by = 'category' AND p_sort_dir = 'asc' THEN category_name COLLATE "th-TH-x-icu" END ASC,
    CASE WHEN p_sort_by = 'category' AND p_sort_dir <> 'asc' THEN category_name COLLATE "th-TH-x-icu" END DESC,
    CASE WHEN p_sort_by = 'quantity' AND p_sort_dir = 'asc' THEN quantity END ASC,
    CASE WHEN p_sort_by = 'quantity' AND p_sort_dir <> 'asc' THEN quantity END DESC,
    CASE WHEN p_sort_by = 'unit_price' AND p_sort_dir = 'asc' THEN unit_price END ASC,
    CASE WHEN p_sort_by = 'unit_price' AND p_sort_dir <> 'asc' THEN unit_price END DESC,
    CASE WHEN p_sort_by = 'total_price' AND p_sort_dir = 'asc' THEN unit_price * quantity END ASC,
    CASE WHEN p_sort_by = 'total_price' AND p_sort_dir <> 'asc' THEN unit_price * quantity END DESC,
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

GRANT EXECUTE ON FUNCTION public.get_report_items_page(text, text, text, uuid, uuid, text, text, int, int) TO authenticated;

COMMIT;
