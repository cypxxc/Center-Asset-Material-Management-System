-- Remove the legacy trash contents and allow direct deletion by editors.
DELETE FROM public.items WHERE deleted_at IS NOT NULL;

DROP POLICY IF EXISTS items_hard_delete ON public.items;
CREATE POLICY items_direct_delete ON public.items FOR DELETE TO authenticated
  USING (private.current_app_role() IN ('admin', 'staff'));

DROP INDEX IF EXISTS public.idx_items_trash_deleted_at;
