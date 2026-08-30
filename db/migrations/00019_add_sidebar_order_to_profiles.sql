-- Migration 00019: Add sidebar_order to profiles and allow users to update their own profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sidebar_order text[] DEFAULT NULL;

-- Drop existing update policy if any (only profiles_admin_manage exists for ALL)
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

-- Create policy allowing authenticated users to update their own profiles
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
