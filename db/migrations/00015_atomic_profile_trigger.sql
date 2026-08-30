-- Migration 00015: Make profile trigger read role and status from auth metadata
-- This enables single-step atomic user creation.

BEGIN;

CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, is_active)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name', 
      NEW.raw_user_meta_data ->> 'name', 
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'viewer'),
    COALESCE((NEW.raw_user_meta_data ->> 'is_active')::boolean, true)
  );
  RETURN NEW;
END;
$$;

COMMIT;
