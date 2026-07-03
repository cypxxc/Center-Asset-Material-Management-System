-- Migration 00010: Fix audit log RLS policy
-- This prevents users from inserting audit log rows that spoof another user's ID.

BEGIN;

DROP POLICY IF EXISTS audit_logs_create ON public.audit_logs;

CREATE POLICY audit_logs_create ON public.audit_logs 
  FOR INSERT TO authenticated 
  WITH CHECK (
    private.current_app_role() IS NOT NULL 
    AND user_id = auth.uid()
  );

COMMIT;
