-- Migration 00027: keep raw SQL server-only and enforce the maintenance flag in DB.
-- The application still requires ADMIN_SQL_ENABLED=true, while the database
-- function only accepts calls made with the service-role JWT.

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
