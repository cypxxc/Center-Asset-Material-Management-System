-- Migration 00030: remove explicit anonymous execution of raw SQL RPC.
-- Migration 00028 removed PUBLIC/authenticated execution, but existing
-- explicit grants for anon must be revoked separately.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.exec_admin_sql(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.exec_admin_sql(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.exec_admin_sql(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exec_admin_sql(text) TO service_role;

COMMIT;
