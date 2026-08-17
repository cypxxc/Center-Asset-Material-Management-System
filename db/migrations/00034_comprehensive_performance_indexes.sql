-- Migration 00034: Comprehensive Database Performance Indexes
-- Adds high-performance composite and partial indexes for audit logs, trash queries, sorted pagination, and RBAC lookups.

BEGIN;

-- 1. Audit Logs: Fast lookups for item history and user activity
CREATE INDEX IF NOT EXISTS idx_audit_logs_target 
  ON public.audit_logs (target_table, target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created 
  ON public.audit_logs (user_id, created_at DESC);

-- 2. Trash / Deleted Items: Accelerated querying for recycle bin without scanning active items
CREATE INDEX IF NOT EXISTS idx_items_trash_deleted_at 
  ON public.items (deleted_at DESC, id ASC) 
  WHERE deleted_at IS NOT NULL;

-- 3. Items Sorting & Pagination: Index-only scan support for common explorer sort columns
CREATE INDEX IF NOT EXISTS idx_items_pagination_updated 
  ON public.items (updated_at DESC, id ASC) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_items_pagination_name 
  ON public.items (item_name ASC, id ASC) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_items_pagination_qty 
  ON public.items (quantity DESC, id ASC) 
  WHERE deleted_at IS NULL;

-- 4. User Profiles: Immediate RBAC role verification and active status resolution
CREATE INDEX IF NOT EXISTS idx_profiles_role_active 
  ON public.profiles (role, is_active);

-- 5. Reference Tables: Fast dropdown & filter loading for active metadata
CREATE INDEX IF NOT EXISTS idx_categories_active_name 
  ON public.categories (name ASC) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_locations_active_name 
  ON public.locations (name ASC) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_units_active_name 
  ON public.units (name ASC) 
  WHERE is_active = true;

COMMIT;
