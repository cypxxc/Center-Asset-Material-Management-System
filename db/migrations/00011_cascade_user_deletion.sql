-- Migration 00011: Cascade user deletion via SET NULL on foreign keys
-- This allows user profiles to be deleted while keeping audit trails and items references (set to NULL).

BEGIN;

-- Drop and rebuild constraints for items table
ALTER TABLE public.items 
  DROP CONSTRAINT IF EXISTS items_created_by_fkey,
  DROP CONSTRAINT IF EXISTS items_updated_by_fkey,
  DROP CONSTRAINT IF EXISTS items_deleted_by_fkey;

ALTER TABLE public.items
  ADD CONSTRAINT items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT items_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT items_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Drop and rebuild constraints for audit_logs table
ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMIT;
