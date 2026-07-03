-- Migration 00012: Database aggregations for Sidebar and Reports
-- This avoids fetching all table rows in memory to compute counts and totals.

BEGIN;

-- 1. Function for Sidebar stats
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
    -- Get active categories with asset counts (active, non-archived)
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
            AND i.status NOT IN ('inactive', 'disposed')
        WHERE c.is_active = true
        GROUP BY c.id, c.name
        ORDER BY c.name
    ) t;

    -- Get active locations with item counts (active, non-archived)
    SELECT json_agg(t) INTO locations_json
    FROM (
        SELECT 
            l.id, 
            l.name,
            COUNT(i.id)::int AS count
        FROM public.locations l
        LEFT JOIN public.items i ON i.location_id = l.id 
            AND i.deleted_at IS NULL 
            AND i.status NOT IN ('inactive', 'disposed')
        WHERE l.is_active = true
        GROUP BY l.id, l.name
        ORDER BY l.name
    ) t;

    -- Get total counts
    SELECT json_build_object(
        'total_assets', COUNT(CASE WHEN item_type = 'asset' AND status NOT IN ('inactive', 'disposed') AND deleted_at IS NULL THEN 1 END)::int,
        'total_supplies', COUNT(CASE WHEN item_type = 'material' AND status NOT IN ('inactive', 'disposed') AND deleted_at IS NULL THEN 1 END)::int,
        'archive_count', COUNT(CASE WHEN status IN ('inactive', 'disposed') AND deleted_at IS NULL THEN 1 END)::int,
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

-- 2. Function for Reports stats
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
    -- Get locations count
    SELECT COUNT(*)::int INTO location_count FROM public.locations;

    -- Get total items and quantity (active, non-archived)
    SELECT json_build_object(
        'total_items', COUNT(*)::int,
        'total_quantity', COALESCE(SUM(quantity)::int, 0)
    ) INTO totals
    FROM public.items
    WHERE deleted_at IS NULL AND status NOT IN ('inactive', 'disposed');

    -- Get type counts (active, non-archived)
    SELECT json_object_agg(item_type, json_build_object('count', cnt::int, 'qty', qty::int)) INTO type_counts
    FROM (
        SELECT 
            item_type, 
            COUNT(*) AS cnt, 
            COALESCE(SUM(quantity), 0) AS qty
        FROM public.items
        WHERE deleted_at IS NULL AND status NOT IN ('inactive', 'disposed')
        GROUP BY item_type
    ) t;

    -- Get status counts (all active items)
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

    -- Get category counts (active, non-archived)
    SELECT json_object_agg(COALESCE(c.name, 'ทั่วไป'), json_build_object('count', cnt::int, 'qty', qty::int)) INTO category_counts
    FROM (
        SELECT 
            category_id, 
            COUNT(*) AS cnt, 
            COALESCE(SUM(quantity), 0) AS qty
        FROM public.items
        WHERE deleted_at IS NULL AND status NOT IN ('inactive', 'disposed')
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

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.get_sidebar_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_report_stats() TO authenticated;

COMMIT;
