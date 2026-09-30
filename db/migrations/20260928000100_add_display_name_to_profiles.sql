-- Add display_name to profiles to allow user custom display alias
-- while keeping full_name intact for admin identification and login identifier.

BEGIN;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text DEFAULT NULL;

-- Allow authenticated users to update display_name and sidebar_order.
-- full_name remains updatable for backward compatibility or admin, but authenticated users
-- update their display_name in self-service profile settings.
GRANT UPDATE (full_name, sidebar_order, display_name) ON TABLE public.profiles TO authenticated;

COMMIT;
