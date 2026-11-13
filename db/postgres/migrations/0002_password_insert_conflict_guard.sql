-- BEFORE triggers run before INSERT ... ON CONFLICT resolves duplicates.
-- Refuse password-bearing duplicate IDs before credentials can be changed.
CREATE FUNCTION private_auth.guard_profile_password_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.password IS NULL OR NEW.password = '' THEN RETURN NEW; END IF;
  IF NOT pg_catalog.pg_has_role(current_user,
      (SELECT relowner FROM pg_catalog.pg_class WHERE oid = TG_RELID), 'USAGE') THEN
    RAISE EXCEPTION 'Only the profiles table owner may set passwords through this column'
      USING ERRCODE = '42501';
  END IF;
  -- Serialize same-ID inserts, including concurrent skip-duplicate imports.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.id::text, 0));
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RAISE EXCEPTION 'Profile already exists; use UPDATE to change its password'
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION private_auth.guard_profile_password_insert() FROM PUBLIC;
--> statement-breakpoint
-- PostgreSQL executes same-kind triggers in name order, before password_input.
CREATE TRIGGER profiles_password_conflict_guard
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private_auth.guard_profile_password_insert();
