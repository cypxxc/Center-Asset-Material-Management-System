-- Migration 00007: Add exec_admin_sql stored procedure for Database Control Panel
-- This function allows authenticated admin users to execute raw SQL queries.

CREATE OR REPLACE FUNCTION public.exec_admin_sql(sql_query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    caller_role text;
    result_json json;
    affected_rows integer;
BEGIN
    -- 1. Check if caller is authenticated
    IF auth.uid() IS NULL THEN
        RETURN json_build_object('error', 'Unauthorized: Please log in');
    END IF;

    -- 2. Fetch role of caller from profiles table
    SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
    
    -- 3. Enforce admin role check
    IF caller_role IS NULL OR caller_role != 'admin' THEN
        RETURN json_build_object('error', 'Forbidden: Only administrators can execute SQL');
    END IF;

    -- 4. Execute the SQL statement
    -- Check if it is a SELECT-like query or modify query
    IF lower(trim(sql_query)) LIKE 'select%' OR lower(trim(sql_query)) LIKE 'with%' OR lower(trim(sql_query)) LIKE 'show%' OR lower(trim(sql_query)) LIKE 'explain%' THEN
        EXECUTE 'SELECT json_agg(t) FROM (' || sql_query || ') t' INTO result_json;
        RETURN json_build_object(
            'rows', COALESCE(result_json, '[]'::json),
            'command', 'SELECT',
            'ok', true
        );
    ELSE
        EXECUTE sql_query;
        GET DIAGNOSTICS affected_rows = ROW_COUNT;
        RETURN json_build_object(
            'rows', '[]'::json,
            'command', 'COMMAND_OK',
            'affected_rows', affected_rows,
            'ok', true
        );
    END IF;
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'error', SQLERRM,
        'code', SQLSTATE,
        'ok', false
    );
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.exec_admin_sql(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.exec_admin_sql(text) TO service_role;
