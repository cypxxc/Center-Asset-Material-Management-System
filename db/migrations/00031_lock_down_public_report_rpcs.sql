-- Migration 00031: prevent unauthenticated execution of SECURITY DEFINER RPCs.
-- The application calls these functions with an authenticated Supabase session.
-- Keep authenticated access, but remove PUBLIC/anon execution explicitly so
-- default PUBLIC grants cannot expose registry data through the Data API.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.get_report_items_page(text, text, text, uuid, uuid, text, text, int, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_report_items_page(text, text, text, uuid, uuid, text, text, int, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_report_items_page(text, text, text, uuid, uuid, text, text, int, int) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_report_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_report_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_report_stats() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_sidebar_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_sidebar_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_sidebar_stats() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.import_items_bulk_tx(json, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.import_items_bulk_tx(json, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.import_items_bulk_tx(json, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.restore_database_backup(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.restore_database_backup(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.restore_database_backup(jsonb) TO authenticated;

COMMIT;
