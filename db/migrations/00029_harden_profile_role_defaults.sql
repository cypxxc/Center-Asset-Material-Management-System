-- Migration 00029: prevent self-service signup metadata from assigning roles.
-- raw_user_meta_data is user-controlled and must never drive authorization.
-- Admin-created users are assigned their requested role by the server-side
-- createAuthUser action after Auth creation completes.

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
    'viewer',
    true
  );
  RETURN NEW;
END;
$$;

COMMIT;
