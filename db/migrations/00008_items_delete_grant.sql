-- Grant DELETE on items to authenticated users so admin can hard-delete from trash.
-- Also grant UPDATE/DELETE on audit_logs for cleanup operations.

-- Step 1: Grant DELETE permission on items table
grant delete on public.items to authenticated;

-- Step 2: Add RLS policy allowing admin-only hard delete (physical delete)
-- Only items that are already soft-deleted (deleted_at IS NOT NULL) can be hard-deleted.
-- This prevents accidental permanent deletion of active items.
create policy items_hard_delete on public.items
  for delete to authenticated
  using (
    private.current_app_role() = 'admin'
    and deleted_at is not null
  );

-- Step 3: Relax items_update WITH CHECK to allow admin to set deleted_at
-- The current policy:
--   with check (private.current_app_role() = 'admin' or deleted_at is null)
-- already allows admin to soft-delete (set deleted_at). Staff cannot soft-delete.
-- No change needed here — soft delete is admin-only, which is correct.

-- Step 4: Ensure items_update USING clause allows admin to restore (set deleted_at back to null)
-- The current USING clause:
--   using (role in ('admin','staff') and (deleted_at is null or role = 'admin'))
-- already allows admin to update rows where deleted_at IS NOT NULL (for restore).
-- No change needed.
