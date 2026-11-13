-- Password-less inserts must take the same lock, otherwise a concurrent ignored
-- password-bearing insert could create credentials for the winning profile.
CREATE OR REPLACE FUNCTION private_auth.guard_profile_password_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.id::text, 0));
  IF NEW.password IS NULL OR NEW.password = '' THEN RETURN NEW; END IF;
  IF NOT pg_catalog.pg_has_role(current_user,
      (SELECT relowner FROM pg_catalog.pg_class WHERE oid = TG_RELID), 'USAGE') THEN
    RAISE EXCEPTION 'Only the profiles table owner may set passwords through this column'
      USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RAISE EXCEPTION 'Profile already exists; use UPDATE to change its password'
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;
