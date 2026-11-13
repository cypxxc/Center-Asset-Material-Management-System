-- Write-only password input for database owners using Navicat.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
--> statement-breakpoint
ALTER TABLE public.profiles ADD COLUMN password text;
--> statement-breakpoint
COMMENT ON COLUMN public.profiles.password IS 'Owner-only password input: 6+ characters, at most 72 UTF-8 bytes. Hashed into private_auth.credentials and cleared to NULL before storage. NULL or empty keeps the existing password.';
--> statement-breakpoint
-- A BEFORE INSERT trigger creates credentials before the profile row exists.
-- The FK still enforces consistency, at transaction commit (including autocommit).
ALTER TABLE private_auth.credentials
  ALTER CONSTRAINT credentials_user_id_profiles_id_fk DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
CREATE FUNCTION private_auth.consume_profile_password() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.password IS NULL OR NEW.password = '' THEN
    NEW.password := NULL;
    RETURN NEW;
  END IF;

  -- Runtime auth has table-level INSERT/UPDATE grants, so column revokes alone
  -- cannot protect this administrative input. Require the actual owner role.
  IF NOT pg_catalog.pg_has_role(current_user,
      (SELECT relowner FROM pg_catalog.pg_class WHERE oid = TG_RELID), 'USAGE') THEN
    RAISE EXCEPTION 'Only the profiles table owner may set passwords through this column'
      USING ERRCODE = '42501';
  END IF;
  IF pg_catalog.char_length(NEW.password) < 6 OR pg_catalog.octet_length(NEW.password) > 72 THEN
    RAISE EXCEPTION 'Password requires at least 6 characters and at most 72 UTF-8 bytes'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO private_auth.credentials(user_id, password_hash)
  VALUES (NEW.id, public.crypt(NEW.password, public.gen_salt('bf', 12)))
  ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash;
  DELETE FROM private_auth.sessions WHERE user_id = NEW.id;
  NEW.password := NULL;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION private_auth.consume_profile_password() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER profiles_password_input
BEFORE INSERT OR UPDATE OF password ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private_auth.consume_profile_password();
--> statement-breakpoint
ALTER TABLE public.profiles ADD CONSTRAINT profiles_password_cleared CHECK (password IS NULL);
