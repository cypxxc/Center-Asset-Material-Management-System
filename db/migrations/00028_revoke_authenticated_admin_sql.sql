-- Migration 00028: remove direct authenticated access after the hardened
-- service-role-only function from 00027 is installed.

REVOKE EXECUTE ON FUNCTION public.exec_admin_sql(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.exec_admin_sql(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.exec_admin_sql(text) TO service_role;
