-- Migration 00029: prevent self-service signup metadata from assigning roles.
-- raw_user_meta_data is user-controlled and must never drive authorization.
-- Admin-created users are assigned their requested role by the server-side
-- createAuthUser action after Auth creation completes.

BEGIN;

CREATE TABLE IF NOT EXISTS public.app_migrations (
  migration text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_migrations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.app_migrations TO service_role;

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

INSERT INTO public.app_migrations (migration)
VALUES
  ('00026_atomic_database_restore.sql'),
  ('00027_lock_down_admin_sql.sql'),
  ('00028_revoke_authenticated_admin_sql.sql'),
  ('00029_harden_profile_role_defaults.sql')
ON CONFLICT (migration) DO NOTHING;

COMMIT;
