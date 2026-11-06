-- Migration 20261106000100: Restrict item deletion RLS to admin only
-- Align database RLS with PRODUCT.md and canDelete permission rule

DROP POLICY IF EXISTS items_direct_delete ON public.items;
DROP POLICY IF EXISTS items_admin_delete ON public.items;

CREATE POLICY items_admin_delete ON public.items FOR DELETE TO authenticated
  USING (private.current_app_role() = 'admin');
