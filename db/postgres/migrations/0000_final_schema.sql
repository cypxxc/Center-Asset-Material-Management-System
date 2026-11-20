-- CAMMS final PostgreSQL baseline. Schema only; no accounts or business data.
-- Consolidated baseline for clean database deployment.
-- Prerequisites: restricted camms_app and camms_auth roles (postgres:app:setup).
SET LOCAL check_function_bodies = false;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

CREATE SCHEMA IF NOT EXISTS private;

CREATE SCHEMA IF NOT EXISTS private_auth;

CREATE SCHEMA IF NOT EXISTS public;

COMMENT ON SCHEMA public IS 'standard public schema';

-- Core Utility Functions
CREATE FUNCTION private.current_user_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
 SELECT nullif(current_setting('app.user_id',true),'')::uuid
$$;

CREATE FUNCTION private.current_app_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT role FROM public.profiles WHERE id=private.current_user_id() AND is_active=true
$$;

CREATE FUNCTION private.stamp_update() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN NEW.updated_at=now(); RETURN NEW; END;
$$;

CREATE FUNCTION public.prevent_stock_and_custody_tampering() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RAISE EXCEPTION 'Stock movements and asset custody logs are strictly append-only and cannot be modified or deleted.';
END;
$$;

-- Table: public.profiles
CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text NOT NULL,
    email text,
    password text,
    role text DEFAULT 'user'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sidebar_order jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profiles_pkey PRIMARY KEY (id),
    CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'user')),
    CONSTRAINT profiles_password_cleared CHECK (password IS NULL)
);

COMMENT ON COLUMN public.profiles.password IS 'Owner-only password input: 6+ characters, at most 72 UTF-8 bytes. Hashed into private_auth.credentials and cleared to NULL before storage. NULL or empty keeps the existing password.';

CREATE UNIQUE INDEX profiles_email_unique ON public.profiles USING btree (lower(email));

-- Table: private_auth.credentials
CREATE TABLE private_auth.credentials (
    user_id uuid NOT NULL,
    password_hash text NOT NULL,
    CONSTRAINT credentials_pkey PRIMARY KEY (user_id),
    CONSTRAINT credentials_user_id_profiles_id_fk FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
);

-- Table: private_auth.sessions
CREATE TABLE private_auth.sessions (
    token_hash text NOT NULL,
    user_id uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sessions_pkey PRIMARY KEY (token_hash),
    CONSTRAINT sessions_user_id_profiles_id_fk FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

CREATE INDEX sessions_user_index ON private_auth.sessions USING btree (user_id);
CREATE INDEX sessions_expiry_index ON private_auth.sessions USING btree (expires_at);

-- Table: private_auth.login_attempts
CREATE TABLE private_auth.login_attempts (
    key text NOT NULL,
    window_started_at timestamp with time zone DEFAULT now() NOT NULL,
    attempts integer NOT NULL,
    CONSTRAINT login_attempts_pkey PRIMARY KEY (key)
);

CREATE INDEX login_attempts_window_index ON private_auth.login_attempts USING btree (window_started_at);

-- Table: private_auth.rate_limits
CREATE TABLE private_auth.rate_limits (
    key text NOT NULL,
    window_started_at timestamp with time zone DEFAULT now() NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    CONSTRAINT rate_limits_pkey PRIMARY KEY (key)
);

CREATE INDEX rate_limits_window_index ON private_auth.rate_limits USING btree (window_started_at);

-- Table: private_auth.consumed_tokens
CREATE TABLE private_auth.consumed_tokens (
    issuer text NOT NULL,
    jti text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT consumed_tokens_pkey PRIMARY KEY (issuer, jti)
);

CREATE INDEX consumed_tokens_expiry_index ON private_auth.consumed_tokens USING btree (expires_at);

-- Table: public.user_sso_identities
CREATE TABLE public.user_sso_identities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    issuer text NOT NULL,
    subject text NOT NULL,
    email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_sso_identities_pkey PRIMARY KEY (id),
    CONSTRAINT user_sso_identities_user_id_profiles_id_fk FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX user_sso_identities_issuer_subject_unique ON public.user_sso_identities USING btree (issuer, subject);
CREATE INDEX user_sso_identities_user_id_index ON public.user_sso_identities USING btree (user_id);

-- Profile Password Functions & Triggers
CREATE FUNCTION private_auth.consume_profile_password() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.password IS NULL OR NEW.password = '' THEN
    NEW.password := NULL;
    RETURN NEW;
  END IF;

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

CREATE FUNCTION private_auth.guard_profile_password_insert() RETURNS trigger
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

CREATE TRIGGER profiles_password_conflict_guard
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private_auth.guard_profile_password_insert();

CREATE TRIGGER profiles_password_input
BEFORE INSERT OR UPDATE OF password ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private_auth.consume_profile_password();

CREATE TRIGGER profiles_stamp
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private.stamp_update();

-- Table: public.categories
CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    item_type text DEFAULT 'asset'::text NOT NULL,
    description text,
    color text DEFAULT '#64748B'::text NOT NULL,
    icon text DEFAULT 'Tag'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT categories_pkey PRIMARY KEY (id),
    CONSTRAINT categories_item_type_check CHECK (item_type IN ('asset', 'material'))
);

CREATE UNIQUE INDEX categories_name_type_unique ON public.categories USING btree (name, item_type);
CREATE UNIQUE INDEX categories_id_type_unique ON public.categories USING btree (id, item_type);

CREATE TRIGGER categories_stamp
BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION private.stamp_update();

-- Table: public.locations
CREATE TABLE public.locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    building text,
    floor text,
    room text,
    department text,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT locations_pkey PRIMARY KEY (id)
);

CREATE TRIGGER locations_stamp
BEFORE UPDATE ON public.locations
FOR EACH ROW EXECUTE FUNCTION private.stamp_update();

-- Table: public.units
CREATE TABLE public.units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT units_pkey PRIMARY KEY (id),
    CONSTRAINT units_name_unique UNIQUE (name)
);

CREATE TRIGGER units_stamp
BEFORE UPDATE ON public.units
FOR EACH ROW EXECUTE FUNCTION private.stamp_update();

-- Table: public.inventory_registry
CREATE TABLE public.inventory_registry (
    id uuid NOT NULL,
    item_type text NOT NULL,
    CONSTRAINT inventory_registry_pkey PRIMARY KEY (id),
    CONSTRAINT inventory_registry_type_check CHECK (item_type IN ('asset', 'material'))
);

CREATE UNIQUE INDEX inventory_registry_id_type_unique ON public.inventory_registry USING btree (id, item_type);

-- Inventory Identity Trigger Function
CREATE FUNCTION private.inventory_identity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO public.inventory_registry(id,item_type) VALUES(NEW.id,NEW.item_type);
  RETURN NEW;
 ELSIF TG_OP='UPDATE' THEN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.item_type IS DISTINCT FROM OLD.item_type THEN RAISE EXCEPTION 'Inventory identity and type cannot change'; END IF;
  RETURN NEW;
 ELSE
  DELETE FROM public.inventory_registry WHERE id=OLD.id;
  RETURN OLD;
 END IF;
END $$;

-- Table: public.items (Assets)
CREATE TABLE public.items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_name text NOT NULL,
    item_type text NOT NULL,
    qualification_status text,
    category_id uuid,
    location_id uuid,
    unit_id uuid,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric(12,2),
    asset_no text,
    serial_no text,
    brand text,
    model text,
    responsible_person text,
    status text DEFAULT 'active'::text NOT NULL,
    note text,
    image_url text,
    is_central boolean DEFAULT false NOT NULL,
    budget_source text,
    gfmis_number text,
    acquired_date date,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    depreciation_enabled boolean DEFAULT false NOT NULL,
    depreciation_method text,
    depreciation_cost numeric(12,2),
    depreciation_useful_life_years integer,
    depreciation_start_basis text,
    depreciation_start_date date,
    depreciation_residual_value numeric(12,2) DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    register_sequence text,
    asset_prefix text,
    register_accumulated_depreciation numeric(14,2),
    register_book_value numeric(14,2),
    register_as_of date,
    CONSTRAINT items_pkey PRIMARY KEY (id),
    CONSTRAINT items_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id),
    CONSTRAINT items_category_type_fk FOREIGN KEY (category_id, item_type) REFERENCES public.categories(id, item_type),
    CONSTRAINT items_location_id_locations_id_fk FOREIGN KEY (location_id) REFERENCES public.locations(id),
    CONSTRAINT items_unit_id_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.units(id),
    CONSTRAINT items_created_by_profiles_id_fk FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT items_updated_by_profiles_id_fk FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT items_deleted_by_profiles_id_fk FOREIGN KEY (deleted_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT items_register_amounts_check CHECK (register_book_value IS NULL OR register_book_value >= 0),
    CONSTRAINT items_type_check CHECK (item_type = 'asset'),
    CONSTRAINT items_qualification_status_check CHECK (qualification_status IS NULL OR qualification_status IN ('qualified', 'below_threshold')),
    CONSTRAINT items_status_check CHECK (status IN ('active', 'spare', 'damaged', 'waiting_repair', 'inactive', 'disposed')),
    CONSTRAINT items_quantity_check CHECK (quantity >= 0),
    CONSTRAINT items_price_check CHECK (unit_price IS NULL OR unit_price >= 0),
    CONSTRAINT items_depreciation_check CHECK (NOT depreciation_enabled OR COALESCE((item_type = 'asset' AND depreciation_method = 'straight_line' AND depreciation_cost > 1 AND depreciation_useful_life_years > 0 AND depreciation_start_basis IN ('acquired', 'available', 'manual') AND depreciation_start_date IS NOT NULL AND depreciation_residual_value = 1), false))
);

CREATE UNIQUE INDEX items_asset_no_unique ON public.items USING btree (asset_no) WHERE (deleted_at IS NULL AND asset_no IS NOT NULL);
CREATE UNIQUE INDEX items_serial_no_unique ON public.items USING btree (serial_no) WHERE (deleted_at IS NULL AND serial_no IS NOT NULL);
CREATE INDEX items_qualification_status_index ON public.items USING btree (qualification_status) WHERE (deleted_at IS NULL);
CREATE INDEX items_is_central_index ON public.items USING btree (is_central) WHERE (deleted_at IS NULL);
CREATE INDEX items_category_index ON public.items USING btree (category_id);
CREATE INDEX items_location_index ON public.items USING btree (location_id);
CREATE INDEX items_type_status_index ON public.items USING btree (item_type, status);
CREATE INDEX items_updated_index ON public.items USING btree (updated_at);

CREATE TRIGGER items_identity
BEFORE INSERT OR UPDATE ON public.items
FOR EACH ROW EXECUTE FUNCTION private.inventory_identity();

CREATE TRIGGER items_identity_delete
AFTER DELETE ON public.items
FOR EACH ROW EXECUTE FUNCTION private.inventory_identity();

CREATE TRIGGER items_stamp
BEFORE UPDATE ON public.items
FOR EACH ROW EXECUTE FUNCTION private.stamp_update();

-- Table: public.materials (Supplies)
CREATE TABLE public.materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_name text NOT NULL,
    item_type text NOT NULL,
    qualification_status text,
    category_id uuid,
    location_id uuid,
    unit_id uuid,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric(12,2),
    asset_no text,
    serial_no text,
    brand text,
    model text,
    responsible_person text,
    status text DEFAULT 'active'::text NOT NULL,
    note text,
    image_url text,
    is_central boolean DEFAULT false NOT NULL,
    budget_source text,
    gfmis_number text,
    acquired_date date,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    depreciation_enabled boolean DEFAULT false NOT NULL,
    depreciation_method text,
    depreciation_cost numeric(12,2),
    depreciation_useful_life_years integer,
    depreciation_start_basis text,
    depreciation_start_date date,
    depreciation_residual_value numeric(12,2) DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata_version bigint DEFAULT 1 NOT NULL,
    stock_version bigint DEFAULT 1 NOT NULL,
    specification text,
    commodity_code text,
    minimum_quantity integer,
    maximum_quantity integer,
    fiscal_year integer,
    balance_as_of date,
    opening_quantity integer,
    opening_amount numeric(14,2),
    received_quantity integer,
    received_amount numeric(14,2),
    issued_quantity integer,
    issued_amount numeric(14,2),
    balance_amount numeric(14,2),
    CONSTRAINT materials_pkey PRIMARY KEY (id),
    CONSTRAINT materials_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id),
    CONSTRAINT materials_category_type_fk FOREIGN KEY (category_id, item_type) REFERENCES public.categories(id, item_type),
    CONSTRAINT materials_location_id_locations_id_fk FOREIGN KEY (location_id) REFERENCES public.locations(id),
    CONSTRAINT materials_unit_id_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.units(id),
    CONSTRAINT materials_created_by_profiles_id_fk FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT materials_updated_by_profiles_id_fk FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT materials_deleted_by_profiles_id_fk FOREIGN KEY (deleted_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT materials_type_check CHECK (item_type = 'material'),
    CONSTRAINT materials_quantity_check CHECK (quantity >= 0),
    CONSTRAINT materials_price_check CHECK (unit_price IS NULL OR unit_price >= 0),
    CONSTRAINT materials_depreciation_check CHECK (NOT depreciation_enabled),
    CONSTRAINT materials_status_check CHECK (status IN ('active', 'spare', 'damaged', 'waiting_repair', 'inactive', 'disposed')),
    CONSTRAINT materials_ledger_check CHECK (coalesce(minimum_quantity,0)>=0 and coalesce(maximum_quantity,0)>=0 and coalesce(opening_quantity,0)>=0 and coalesce(received_quantity,0)>=0 and coalesce(issued_quantity,0)>=0 and coalesce(opening_amount,0)>=0 and coalesce(received_amount,0)>=0 and coalesce(issued_amount,0)>=0 and coalesce(balance_amount,0)>=0)
);

CREATE INDEX materials_updated_index ON public.materials USING btree (updated_at);
CREATE INDEX materials_category_index ON public.materials USING btree (category_id);
CREATE INDEX materials_location_index ON public.materials USING btree (location_id);

CREATE TRIGGER materials_identity
BEFORE INSERT OR UPDATE ON public.materials
FOR EACH ROW EXECUTE FUNCTION private.inventory_identity();

CREATE TRIGGER materials_identity_delete
AFTER DELETE ON public.materials
FOR EACH ROW EXECUTE FUNCTION private.inventory_identity();

CREATE TRIGGER materials_stamp
BEFORE UPDATE ON public.materials
FOR EACH ROW EXECUTE FUNCTION private.stamp_update();

CREATE FUNCTION private.material_always_central() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN NEW.is_central := true; RETURN NEW; END $$;

CREATE TRIGGER material_always_central
BEFORE INSERT OR UPDATE ON public.materials
FOR EACH ROW EXECUTE FUNCTION private.material_always_central();

CREATE FUNCTION private.version_material_changes() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  NEW.metadata_version := OLD.metadata_version;
  NEW.stock_version := OLD.stock_version;
  IF (to_jsonb(NEW)-ARRAY['quantity','updated_at','updated_by','metadata_version','stock_version'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['quantity','updated_at','updated_by','metadata_version','stock_version']) THEN
    NEW.metadata_version := OLD.metadata_version+1;
  END IF;
  IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN NEW.stock_version := OLD.stock_version+1; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER version_material_changes
BEFORE UPDATE ON public.materials
FOR EACH ROW EXECUTE FUNCTION private.version_material_changes();

-- View: public.inventory_items (Unified Read-only View)
CREATE VIEW public.inventory_items WITH (security_invoker=true) AS
SELECT "id","item_name","item_type","qualification_status","category_id","location_id","unit_id","quantity","unit_price","asset_no","serial_no","brand","model","responsible_person","status","note","image_url","is_central","budget_source","gfmis_number","acquired_date","created_by","updated_by","deleted_by","deleted_at","depreciation_enabled","depreciation_method","depreciation_cost","depreciation_useful_life_years","depreciation_start_basis","depreciation_start_date","depreciation_residual_value","created_at","updated_at",register_sequence,asset_prefix,register_accumulated_depreciation,register_book_value,register_as_of FROM public.items UNION ALL SELECT "id","item_name","item_type","qualification_status","category_id","location_id","unit_id","quantity","unit_price","asset_no","serial_no","brand","model","responsible_person","status","note","image_url","is_central","budget_source","gfmis_number","acquired_date","created_by","updated_by","deleted_by","deleted_at","depreciation_enabled","depreciation_method","depreciation_cost","depreciation_useful_life_years","depreciation_start_basis","depreciation_start_date","depreciation_residual_value","created_at","updated_at",NULL::text AS register_sequence,NULL::text AS asset_prefix,NULL::numeric AS register_accumulated_depreciation,NULL::numeric AS register_book_value,NULL::date AS register_as_of FROM public.materials;

-- Function: private.get_public_item
CREATE FUNCTION private.get_public_item(p_id text) RETURNS TABLE(id uuid, item_name text, item_type text, quantity integer, unit_price numeric, asset_no text, serial_no text, brand text, model text, responsible_person text, status text, note text, image_url text, category_id uuid, category_name text, location_id uuid, location_name text, unit_id uuid, unit_name text, depreciation_enabled boolean, depreciation_method text, depreciation_cost numeric, depreciation_useful_life_years integer, depreciation_start_basis text, depreciation_start_date date, depreciation_residual_value numeric, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
  SELECT 
    i.id, i.item_name, i.item_type, i.quantity, i.unit_price, i.asset_no, i.serial_no,
    i.brand, i.model, i.responsible_person, i.status, i.note, i.image_url,
    i.category_id, c.name AS category_name,
    i.location_id, l.name AS location_name,
    i.unit_id, u.name AS unit_name,
    i.depreciation_enabled, i.depreciation_method, i.depreciation_cost, i.depreciation_useful_life_years,
    i.depreciation_start_basis, i.depreciation_start_date, i.depreciation_residual_value, i.created_at
  FROM public.inventory_items i
  LEFT JOIN public.categories c ON c.id = i.category_id
  LEFT JOIN public.locations l ON l.id = i.location_id
  LEFT JOIN public.units u ON u.id = i.unit_id
  WHERE (
    CASE 
      WHEN p_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN i.id = p_id::uuid
      ELSE (i.asset_no = p_id OR i.serial_no = p_id)
    END
  )
  AND i.deleted_at IS NULL
  LIMIT 1;
$_$;

-- Function: private.is_public_item_image
CREATE FUNCTION private.is_public_item_image(p_url text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
  SELECT EXISTS (
    SELECT 1 FROM public.inventory_items i
    WHERE i.image_url = p_url AND i.deleted_at IS NULL
  );
$_$;

-- Table: public.audit_logs
CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action text NOT NULL,
    target_table text NOT NULL,
    target_id uuid,
    old_data jsonb,
    new_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
    CONSTRAINT audit_logs_user_id_profiles_id_fk FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX audit_created_index ON public.audit_logs USING btree (created_at);
CREATE INDEX audit_target_index ON public.audit_logs USING btree (target_table, target_id);

CREATE FUNCTION private.audit_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid := private.current_user_id();
BEGIN
 INSERT INTO public.audit_logs(user_id,action,target_table,target_id,old_data,new_data)
 VALUES(actor, lower(TG_OP),TG_TABLE_NAME,coalesce(NEW.id,OLD.id),CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) END,CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) END);
 PERFORM pg_notify('camms_changes',TG_TABLE_NAME);
 RETURN coalesce(NEW,OLD);
END;
$$;

CREATE FUNCTION private.audit_material_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.audit_logs(user_id,action,target_table,target_id,old_data,new_data)
 VALUES(private.current_user_id(),lower(TG_OP),'materials',coalesce(NEW.id,OLD.id),CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) END,CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) END);
 PERFORM pg_notify('camms_changes','items');
 RETURN coalesce(NEW,OLD);
END $$;

CREATE FUNCTION private_auth.record_admin_event(actor uuid, target uuid, event_action text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
 IF actor IS DISTINCT FROM private.current_user_id() OR private.current_app_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
 INSERT INTO public.audit_logs(user_id,action,target_table,target_id) VALUES(actor,event_action,'profiles',target);
END;
$$;

CREATE TRIGGER categories_audit AFTER INSERT OR DELETE OR UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION private.audit_change();
CREATE TRIGGER locations_audit AFTER INSERT OR DELETE OR UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION private.audit_change();
CREATE TRIGGER units_audit AFTER INSERT OR DELETE OR UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION private.audit_change();
CREATE TRIGGER profiles_audit AFTER INSERT OR DELETE OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.audit_change();
CREATE TRIGGER items_audit AFTER INSERT OR DELETE OR UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION private.audit_change();
CREATE TRIGGER materials_audit AFTER INSERT OR DELETE OR UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION private.audit_material_change();

-- Table: public.disbursement_sequences
CREATE TABLE public.disbursement_sequences (
    fiscal_year integer NOT NULL,
    prefix text NOT NULL,
    current_val integer DEFAULT 0 NOT NULL
);

CREATE UNIQUE INDEX disbursement_sequences_pk ON public.disbursement_sequences USING btree (fiscal_year, prefix);

-- Table: public.request_batches
CREATE TABLE public.request_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_by uuid NOT NULL,
    request_key uuid NOT NULL,
    payload_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT request_batches_pkey PRIMARY KEY (id),
    CONSTRAINT request_batches_created_by_profiles_id_fk FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

CREATE UNIQUE INDEX request_batches_creator_key_unique ON public.request_batches USING btree (created_by, request_key);

CREATE TRIGGER request_batches_immutable
BEFORE UPDATE OR DELETE ON public.request_batches
FOR EACH ROW EXECUTE FUNCTION public.prevent_stock_and_custody_tampering();

-- Table: public.disbursements
CREATE TABLE public.disbursements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_batch_id uuid,
    document_no text,
    fiscal_year integer,
    transaction_type text NOT NULL,
    recipient_name text NOT NULL,
    department_name text NOT NULL,
    purpose text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    due_date date,
    submitted_at timestamp with time zone,
    handed_over_at timestamp with time zone,
    handed_over_by uuid,
    confirmed_at timestamp with time zone,
    confirmed_by uuid,
    reversal_reason text,
    reversed_at timestamp with time zone,
    reversed_by uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT disbursements_pkey PRIMARY KEY (id),
    CONSTRAINT disbursements_document_no_unique UNIQUE (document_no),
    CONSTRAINT disbursements_request_batch_id_request_batches_id_fk FOREIGN KEY (request_batch_id) REFERENCES public.request_batches(id),
    CONSTRAINT disbursements_handed_over_by_profiles_id_fk FOREIGN KEY (handed_over_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT disbursements_confirmed_by_profiles_id_fk FOREIGN KEY (confirmed_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT disbursements_reversed_by_profiles_id_fk FOREIGN KEY (reversed_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT disbursements_created_by_profiles_id_fk FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT disbursements_type_check CHECK (transaction_type IN ('material_issue', 'asset_handover', 'asset_borrow')),
    CONSTRAINT disbursements_status_check CHECK (status IN ('draft', 'pending_approval', 'confirmed', 'active_borrow', 'partially_returned', 'returned', 'reversed', 'cancelled', 'rejected')),
    CONSTRAINT disbursements_handover_time_check CHECK (handed_over_at IS NOT NULL OR handed_over_by IS NULL),
    CONSTRAINT check_due_date_on_borrow CHECK (transaction_type <> 'asset_borrow' OR status = 'draft' OR due_date IS NOT NULL),
    CONSTRAINT check_reversal_meta CHECK (status <> 'reversed' OR (reversal_reason IS NOT NULL AND reversed_by IS NOT NULL AND reversed_at IS NOT NULL))
);

CREATE INDEX disbursements_batch_index ON public.disbursements USING btree (request_batch_id) WHERE (request_batch_id IS NOT NULL);
CREATE INDEX disbursements_status_index ON public.disbursements USING btree (status);
CREATE INDEX disbursements_created_index ON public.disbursements USING btree (created_at);

-- Table: public.disbursement_items
CREATE TABLE public.disbursement_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    disbursement_id uuid NOT NULL,
    item_id uuid NOT NULL,
    requested_qty integer NOT NULL,
    issued_qty integer DEFAULT 0 NOT NULL,
    returned_qty integer DEFAULT 0 NOT NULL,
    item_name_snapshot text,
    asset_no_snapshot text,
    serial_no_snapshot text,
    brand_snapshot text,
    model_snapshot text,
    unit_name_snapshot text,
    unit_price_snapshot numeric(12,2) DEFAULT 0,
    category_name_snapshot text,
    location_name_snapshot text,
    status text DEFAULT 'pending'::text NOT NULL,
    CONSTRAINT disbursement_items_pkey PRIMARY KEY (id),
    CONSTRAINT disbursement_items_disbursement_id_disbursements_id_fk FOREIGN KEY (disbursement_id) REFERENCES public.disbursements(id) ON DELETE RESTRICT,
    CONSTRAINT disbursement_items_item_id_inventory_registry_id_fk FOREIGN KEY (item_id) REFERENCES public.inventory_registry(id) ON DELETE RESTRICT,
    CONSTRAINT disbursement_items_requested_qty_check CHECK (requested_qty > 0),
    CONSTRAINT disbursement_items_issued_qty_check CHECK (issued_qty >= 0),
    CONSTRAINT disbursement_items_issue_limit_check CHECK (issued_qty <= requested_qty),
    CONSTRAINT disbursement_items_returned_qty_check CHECK (returned_qty >= 0 AND returned_qty <= issued_qty),
    CONSTRAINT disbursement_items_status_check CHECK (status IN ('pending', 'issued', 'partially_returned', 'returned', 'reversed'))
);

CREATE INDEX disbursement_items_doc_index ON public.disbursement_items USING btree (disbursement_id);
CREATE INDEX disbursement_items_item_index ON public.disbursement_items USING btree (item_id);
CREATE UNIQUE INDEX disbursement_items_document_item_unique ON public.disbursement_items USING btree (disbursement_id, item_id);

-- Table: public.material_stock_documents
CREATE TABLE public.material_stock_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    kind text NOT NULL,
    request_key uuid NOT NULL,
    created_by uuid,
    payload_hash text NOT NULL,
    quantity integer NOT NULL,
    accepted_quantity integer DEFAULT 0 NOT NULL,
    delta integer NOT NULL,
    reason text NOT NULL,
    reference text NOT NULL,
    disbursement_item_id uuid,
    opening_balance bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT material_stock_documents_pkey PRIMARY KEY (id),
    CONSTRAINT material_stock_documents_item_id_inventory_registry_id_fk FOREIGN KEY (item_id) REFERENCES public.inventory_registry(id) ON DELETE RESTRICT,
    CONSTRAINT material_stock_documents_created_by_profiles_id_fk FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT material_stock_documents_disbursement_item_id_disbursement_items_id_fk FOREIGN KEY (disbursement_item_id) REFERENCES public.disbursement_items(id) ON DELETE RESTRICT,
    CONSTRAINT material_stock_documents_kind_check CHECK (kind IN ('receipt', 'count', 'return', 'opening')),
    CONSTRAINT material_stock_documents_quantity_check CHECK (quantity >= 0),
    CONSTRAINT material_stock_documents_accepted_check CHECK (accepted_quantity >= 0 AND accepted_quantity <= quantity),
    CONSTRAINT material_stock_documents_reason_check CHECK (length(btrim(reason)) > 0),
    CONSTRAINT material_stock_documents_reference_check CHECK (length(btrim(reference)) > 0),
    CONSTRAINT material_stock_documents_return_check CHECK ((kind = 'return') = (disbursement_item_id IS NOT NULL)),
    CONSTRAINT material_stock_documents_opening_check CHECK ((kind = 'opening') = (opening_balance IS NOT NULL))
);

CREATE UNIQUE INDEX material_stock_documents_creator_key_unique ON public.material_stock_documents USING btree (created_by, request_key);
CREATE UNIQUE INDEX material_stock_opening_unique ON public.material_stock_documents USING btree (item_id) WHERE (kind = 'opening');
CREATE INDEX material_stock_documents_item_created ON public.material_stock_documents USING btree (item_id, created_at);

-- Table: public.stock_movements
CREATE TABLE public.stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    disbursement_item_id uuid,
    stock_document_id uuid,
    delta integer NOT NULL,
    balance_after integer NOT NULL,
    movement_type text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stock_movements_pkey PRIMARY KEY (id),
    CONSTRAINT stock_movements_item_id_inventory_registry_id_fk FOREIGN KEY (item_id) REFERENCES public.inventory_registry(id) ON DELETE RESTRICT,
    CONSTRAINT stock_movements_disbursement_item_id_disbursement_items_id_fk FOREIGN KEY (disbursement_item_id) REFERENCES public.disbursement_items(id) ON DELETE RESTRICT,
    CONSTRAINT stock_movements_stock_document_id_material_stock_documents_id_fk FOREIGN KEY (stock_document_id) REFERENCES public.material_stock_documents(id) ON DELETE RESTRICT,
    CONSTRAINT stock_movements_created_by_profiles_id_fk FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT stock_movements_balance_check CHECK (balance_after >= 0),
    CONSTRAINT stock_movements_type_check CHECK (movement_type IN ('issue', 'reversal', 'adjust_audit', 'receipt', 'material_return'))
);

CREATE UNIQUE INDEX stock_movements_document_unique ON public.stock_movements USING btree (stock_document_id) WHERE (stock_document_id IS NOT NULL);
CREATE INDEX stock_movements_item_created_index ON public.stock_movements USING btree (item_id, created_at);

-- Table: public.asset_custody_logs
CREATE TABLE public.asset_custody_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    disbursement_item_id uuid NOT NULL,
    action text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    from_responsible text,
    to_responsible text,
    item_condition text DEFAULT 'normal'::text NOT NULL,
    note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT asset_custody_logs_pkey PRIMARY KEY (id),
    CONSTRAINT asset_custody_logs_item_id_items_id_fk FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE RESTRICT,
    CONSTRAINT asset_custody_logs_disbursement_item_id_disbursement_items_id_f FOREIGN KEY (disbursement_item_id) REFERENCES public.disbursement_items(id) ON DELETE RESTRICT,
    CONSTRAINT asset_custody_logs_created_by_profiles_id_fk FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT asset_custody_action_check CHECK (action IN ('handover', 'borrow', 'return', 'reversal')),
    CONSTRAINT asset_custody_condition_check CHECK (item_condition IN ('normal', 'damaged', 'lost')),
    CONSTRAINT asset_custody_qty_check CHECK (quantity > 0)
);

CREATE INDEX asset_custody_item_created_index ON public.asset_custody_logs USING btree (item_id, created_at);

-- Disbursement & Stock Triggers
CREATE TRIGGER trg_prevent_stock_movements_tampering
BEFORE DELETE OR UPDATE ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.prevent_stock_and_custody_tampering();

CREATE TRIGGER trg_prevent_asset_custody_tampering
BEFORE DELETE OR UPDATE ON public.asset_custody_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_stock_and_custody_tampering();

CREATE FUNCTION private.protect_material_stock_document() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'Stock documents are immutable'; END $$;

CREATE TRIGGER protect_material_stock_document
BEFORE UPDATE OR DELETE ON public.material_stock_documents
FOR EACH ROW EXECUTE FUNCTION private.protect_material_stock_document();

CREATE FUNCTION private.open_material_stock_ledger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF private.current_app_role() IS NULL THEN RETURN NEW; END IF;
  IF private.current_app_role()<>'admin' THEN RAISE EXCEPTION 'Only admins may open material stock'; END IF;
  INSERT INTO public.material_stock_documents(item_id,kind,request_key,created_by,payload_hash,quantity,delta,reason,reference,opening_balance)
  VALUES(NEW.id,'opening',pg_catalog.gen_random_uuid(),private.current_user_id(),'new-material-opening',NEW.quantity,0,
    'ยอดตั้งต้นเมื่อขึ้นทะเบียนวัสดุ','REGISTER-'||NEW.id::text,NEW.quantity);
  RETURN NEW;
END $$;

CREATE TRIGGER zz_open_material_stock_ledger
AFTER INSERT ON public.materials
FOR EACH ROW EXECUTE FUNCTION private.open_material_stock_ledger();

CREATE FUNCTION private.protect_request_batch_link() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.request_batch_id IS DISTINCT FROM OLD.request_batch_id THEN
   RAISE EXCEPTION 'Request batch link is immutable';
 END IF;
 IF TG_OP='INSERT' AND NEW.request_batch_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM public.request_batches b WHERE b.id=NEW.request_batch_id AND b.created_by=NEW.created_by
 ) THEN RAISE EXCEPTION 'Invalid request batch owner'; END IF;
 RETURN NEW;
END; $$;

CREATE TRIGGER disbursement_request_batch_link
BEFORE INSERT OR UPDATE ON public.disbursements
FOR EACH ROW EXECUTE FUNCTION private.protect_request_batch_link();

CREATE FUNCTION private.protect_disbursement_tracking() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.submitted_at IS DISTINCT FROM OLD.submitted_at AND NOT (
   OLD.status='draft' AND NEW.status='pending_approval' AND OLD.submitted_at IS NULL AND NEW.submitted_at IS NOT NULL
 ) THEN RAISE EXCEPTION 'Submission timestamp is immutable'; END IF;
 IF ROW(NEW.handed_over_at,NEW.handed_over_by) IS DISTINCT FROM ROW(OLD.handed_over_at,OLD.handed_over_by) THEN
   IF OLD.handed_over_at IS NOT NULL OR private.current_app_role() IS DISTINCT FROM 'admin' OR
     NEW.handed_over_by IS DISTINCT FROM private.current_user_id() OR NEW.handed_over_at IS NULL OR
     NEW.confirmed_at IS NULL OR NEW.handed_over_at < NEW.confirmed_at OR
     NOT ((NEW.transaction_type IN ('material_issue','asset_handover') AND NEW.status='confirmed') OR (NEW.transaction_type='asset_borrow' AND NEW.status='active_borrow'))
   THEN RAISE EXCEPTION 'Invalid physical receipt event'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER protect_disbursement_tracking
BEFORE UPDATE ON public.disbursements
FOR EACH ROW EXECUTE FUNCTION private.protect_disbursement_tracking();

CREATE FUNCTION public.protect_disbursement_header_immutability() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE approving boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status NOT IN ('draft','cancelled') THEN
      RAISE EXCEPTION 'Cannot delete non-draft disbursement document % (status: %)', OLD.id, OLD.status;
    END IF;
    RETURN OLD;
  END IF;
  approving := OLD.status IN ('draft','pending_approval') AND
    NEW.status = CASE WHEN OLD.transaction_type = 'asset_borrow' THEN 'active_borrow' ELSE 'confirmed' END;
  IF private.current_app_role() = 'user' AND NOT (
    OLD.created_by = private.current_user_id() AND OLD.status = 'pending_approval' AND NEW.status = 'cancelled'
  ) THEN RAISE EXCEPTION 'User can only withdraw own pending request'; END IF;
  IF OLD.status <> 'draft' AND ROW(NEW.id,NEW.transaction_type,NEW.recipient_name,NEW.department_name,NEW.purpose,NEW.created_by,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.id,OLD.transaction_type,OLD.recipient_name,OLD.department_name,OLD.purpose,OLD.created_by,OLD.created_at) THEN
    RAISE EXCEPTION 'Request fields on document % are immutable', OLD.id;
  END IF;
  IF NEW.due_date IS DISTINCT FROM OLD.due_date AND OLD.status <> 'draft' AND NOT (
    approving AND OLD.transaction_type = 'asset_borrow' AND NEW.due_date IS NOT NULL AND
    NEW.due_date >= (current_timestamp AT TIME ZONE 'Asia/Bangkok')::date AND
    NEW.due_date >= (OLD.created_at AT TIME ZONE 'Asia/Bangkok')::date
  ) THEN RAISE EXCEPTION 'Return date can only change with explicit valid borrowing approval'; END IF;
  IF approving THEN
    IF NEW.document_no IS NULL OR NEW.fiscal_year IS NULL OR NEW.confirmed_at IS NULL OR NEW.confirmed_by IS NULL THEN
      RAISE EXCEPTION 'Approval metadata is required';
    END IF;
  ELSIF ROW(NEW.document_no,NEW.fiscal_year,NEW.confirmed_at,NEW.confirmed_by)
    IS DISTINCT FROM ROW(OLD.document_no,OLD.fiscal_year,OLD.confirmed_at,OLD.confirmed_by) THEN
    RAISE EXCEPTION 'Approval metadata on document % is immutable', OLD.id;
  END IF;
  IF OLD.status <> NEW.status AND NOT (
    (OLD.status = 'draft' AND (NEW.status IN ('pending_approval','cancelled') OR approving)) OR
    (OLD.status = 'pending_approval' AND (NEW.status IN ('cancelled','rejected') OR approving)) OR
    (OLD.status = 'confirmed' AND (NEW.status = 'reversed' OR (OLD.transaction_type='material_issue' AND NEW.status IN ('partially_returned','returned')))) OR
    (OLD.status IN ('active_borrow','partially_returned') AND NEW.status IN ('partially_returned','returned','reversed'))
  ) THEN RAISE EXCEPTION 'Invalid disbursement transition: % -> %', OLD.status, NEW.status; END IF;
  IF (OLD.status IN ('reversed','rejected') OR NEW.status NOT IN ('reversed','rejected')) AND
    ROW(NEW.reversal_reason,NEW.reversed_at,NEW.reversed_by) IS DISTINCT FROM ROW(OLD.reversal_reason,OLD.reversed_at,OLD.reversed_by) THEN
    RAISE EXCEPTION 'Reversal details on document % are immutable', OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_disbursement_header_protect
BEFORE DELETE OR UPDATE ON public.disbursements
FOR EACH ROW EXECUTE FUNCTION public.protect_disbursement_header_immutability();

CREATE TRIGGER disbursements_stamp
BEFORE UPDATE ON public.disbursements
FOR EACH ROW EXECUTE FUNCTION private.stamp_update();

CREATE FUNCTION public.protect_disbursement_item_immutability() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status != 'pending' THEN
      RAISE EXCEPTION 'Cannot delete processed disbursement item % (status: %)', OLD.id, OLD.status;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status != 'pending' THEN
      IF NEW.id != OLD.id
         OR NEW.disbursement_id != OLD.disbursement_id
         OR NEW.item_id != OLD.item_id
         OR NEW.requested_qty != OLD.requested_qty
         OR NEW.issued_qty != OLD.issued_qty
         OR NEW.item_name_snapshot != OLD.item_name_snapshot
         OR NEW.asset_no_snapshot != OLD.asset_no_snapshot
         OR NEW.serial_no_snapshot != OLD.serial_no_snapshot
         OR NEW.brand_snapshot != OLD.brand_snapshot
         OR NEW.model_snapshot != OLD.model_snapshot
         OR NEW.unit_name_snapshot != OLD.unit_name_snapshot
         OR NEW.unit_price_snapshot != OLD.unit_price_snapshot
         OR NEW.category_name_snapshot != OLD.category_name_snapshot
         OR NEW.location_name_snapshot != OLD.location_name_snapshot THEN
        RAISE EXCEPTION 'Confirmed snapshot attributes on disbursement item % are immutable', OLD.id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_disbursement_item_protect
BEFORE DELETE OR UPDATE ON public.disbursement_items
FOR EACH ROW EXECUTE FUNCTION public.protect_disbursement_item_immutability();

CREATE FUNCTION public.validate_disbursement_item_type() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_doc_type text;
  v_doc_status text;
  v_item_type text;
  v_asset_no text;
  v_stock integer;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.requested_qty IS DISTINCT FROM OLD.requested_qty OR NEW.item_id IS DISTINCT FROM OLD.item_id OR NEW.disbursement_id IS DISTINCT FROM OLD.disbursement_id THEN
    -- Serialize line attachment with approval/cancellation of this parent before
    -- taking the same canonical inventory advisory lock used by the application.
    SELECT transaction_type, status INTO v_doc_type, v_doc_status
      FROM public.disbursements WHERE id = NEW.disbursement_id FOR UPDATE;
    IF v_doc_status NOT IN ('draft','pending_approval') THEN
      RAISE EXCEPTION 'Cannot add lines to processed disbursement document';
    END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('camms-disbursement:' || NEW.item_id::text, 0));
    IF v_doc_type = 'material_issue' OR EXISTS (SELECT 1 FROM public.materials WHERE id=NEW.item_id) THEN
      SELECT quantity INTO v_stock FROM public.materials WHERE id=NEW.item_id AND deleted_at IS NULL;
      IF private.current_app_role() IS NOT NULL AND v_doc_status = 'pending_approval' AND (v_stock IS NULL OR NEW.requested_qty<1 OR NEW.requested_qty>v_stock) THEN
        RAISE EXCEPTION 'จำนวนวัสดุพร้อมจ่ายไม่เพียงพอ';
      END IF;
    ELSIF EXISTS (
      SELECT 1 FROM public.disbursement_items di
      JOIN public.disbursements d ON d.id = di.disbursement_id
      WHERE di.item_id = NEW.item_id AND d.id <> NEW.disbursement_id
        AND d.status IN ('pending_approval','active_borrow','partially_returned')
        AND di.status NOT IN ('returned','reversed')
    ) THEN RAISE EXCEPTION 'Item already has a pending or active reservation'; END IF;
  ELSE
    SELECT transaction_type INTO v_doc_type FROM public.disbursements WHERE id = NEW.disbursement_id;
  END IF;
  IF v_doc_type IS NULL THEN
    RAISE EXCEPTION 'Parent disbursement document does not exist';
  END IF;

  SELECT item_type, asset_no INTO v_item_type, v_asset_no FROM public.inventory_items WHERE id = NEW.item_id AND deleted_at IS NULL;
  IF v_item_type IS NULL THEN
    RAISE EXCEPTION 'Item does not exist or has been deleted';
  END IF;

  IF v_doc_type = 'material_issue' AND v_item_type != 'material' THEN
    RAISE EXCEPTION 'Document type material_issue only accepts material items';
  END IF;

  IF v_doc_type IN ('asset_handover', 'asset_borrow') THEN
    IF v_doc_type = 'asset_handover' AND v_item_type != 'asset' THEN
      RAISE EXCEPTION 'Document type % only accepts asset items', v_doc_type;
    END IF;
    IF v_doc_type = 'asset_borrow' AND v_item_type = 'asset' AND (v_asset_no IS NULL OR trim(v_asset_no) = '') THEN
      RAISE EXCEPTION 'Asset borrowing requires an asset with an asset_no';
    END IF;
    IF v_doc_type = 'asset_borrow' AND v_item_type = 'asset' AND NEW.requested_qty != 1 THEN
      RAISE EXCEPTION 'Asset borrowing quantity must be exactly 1 per tracked asset';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_disbursement_item_validate
BEFORE INSERT OR UPDATE ON public.disbursement_items
FOR EACH ROW EXECUTE FUNCTION public.validate_disbursement_item_type();

CREATE FUNCTION private.debit_pending_material_line() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_doc public.disbursements%ROWTYPE; v_balance integer; v_actor uuid;
BEGIN
  SELECT * INTO v_doc FROM public.disbursements WHERE id=NEW.disbursement_id FOR UPDATE;
  IF v_doc.transaction_type NOT IN ('material_issue','asset_borrow') OR v_doc.status<>'pending_approval' THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.materials WHERE id=NEW.item_id) THEN RETURN NEW; END IF;
  v_actor := private.current_user_id();
  IF private.current_app_role() IS NULL THEN RETURN NEW; END IF;
  IF private.current_app_role()<>'admin' AND (private.current_app_role()<>'user' OR v_doc.created_by IS DISTINCT FROM v_actor) THEN
    RAISE EXCEPTION 'ไม่มีสิทธิ์ตัดสต็อกคำขอนี้';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('camms-disbursement:'||NEW.item_id::text,0));
  UPDATE public.materials SET quantity=quantity-NEW.requested_qty,updated_at=now()
    WHERE id=NEW.item_id AND deleted_at IS NULL AND status IN ('active','spare') AND quantity>=NEW.requested_qty
    RETURNING quantity INTO v_balance;
  IF NOT FOUND THEN RAISE EXCEPTION 'จำนวนวัสดุคงเหลือไม่เพียงพอหรือไม่พร้อมเบิก'; END IF;
  INSERT INTO public.stock_movements(item_id,disbursement_item_id,delta,balance_after,movement_type,created_by)
    VALUES(NEW.item_id,NEW.id,-NEW.requested_qty,v_balance,'issue',v_actor);
  RETURN NEW;
END $$;

CREATE TRIGGER debit_pending_material_line
AFTER INSERT ON public.disbursement_items
FOR EACH ROW EXECUTE FUNCTION private.debit_pending_material_line();

CREATE FUNCTION private.restore_pending_material_stock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_line record; v_balance integer; v_actor uuid;
BEGIN
  IF OLD.transaction_type NOT IN ('material_issue','asset_borrow') OR OLD.status<>'pending_approval'
    OR NEW.status NOT IN ('cancelled','rejected') THEN RETURN NEW; END IF;
  v_actor := private.current_user_id();
  IF private.current_app_role() IS NULL THEN RETURN NEW; END IF;
  IF private.current_app_role()<>'admin' AND (private.current_app_role()<>'user' OR OLD.created_by IS DISTINCT FROM v_actor OR NEW.status<>'cancelled') THEN
    RAISE EXCEPTION 'ไม่มีสิทธิ์คืนสต็อกคำขอนี้';
  END IF;
  FOR v_line IN SELECT item_id FROM public.disbursement_items WHERE disbursement_id=NEW.id ORDER BY item_id LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('camms-disbursement:'||v_line.item_id::text,0));
  END LOOP;
  FOR v_line IN
    SELECT di.id,di.item_id,coalesce(sum(sm.delta),0) AS net
    FROM public.disbursement_items di LEFT JOIN public.stock_movements sm
      ON sm.disbursement_item_id=di.id AND sm.movement_type IN ('issue','reversal')
    WHERE di.disbursement_id=NEW.id GROUP BY di.id,di.item_id ORDER BY di.item_id
  LOOP
    IF v_line.net<0 THEN
      UPDATE public.materials SET quantity=quantity-v_line.net,updated_at=now()
        WHERE id=v_line.item_id RETURNING quantity INTO v_balance;
      IF NOT FOUND THEN RAISE EXCEPTION 'ไม่พบวัสดุสำหรับคืนสต็อก'; END IF;
      INSERT INTO public.stock_movements(item_id,disbursement_item_id,delta,balance_after,movement_type,created_by)
        VALUES(v_line.item_id,v_line.id,-v_line.net,v_balance,'reversal',v_actor);
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER restore_pending_material_stock
AFTER UPDATE OF status ON public.disbursements
FOR EACH ROW EXECUTE FUNCTION private.restore_pending_material_stock();

-- Row Level Security & Policies
ALTER TABLE public.asset_custody_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY asset_custody_logs_insert ON public.asset_custody_logs FOR INSERT TO camms_app WITH CHECK (private.current_app_role() = 'admin'::text);
CREATE POLICY asset_custody_logs_read ON public.asset_custody_logs FOR SELECT TO camms_app USING (private.current_app_role() IS NOT NULL);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_append ON public.audit_logs FOR INSERT TO camms_app WITH CHECK ((user_id = private.current_user_id()) AND (private.current_app_role() IS NOT NULL));
CREATE POLICY audit_read ON public.audit_logs FOR SELECT TO camms_app USING (private.current_app_role() = 'admin'::text OR (target_table IN ('items', 'materials') AND private.current_app_role() IS NOT NULL));

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY categories_delete ON public.categories FOR DELETE TO camms_app USING (private.current_app_role() = 'admin'::text);
CREATE POLICY categories_insert ON public.categories FOR INSERT TO camms_app WITH CHECK (private.current_app_role() = 'admin'::text);
CREATE POLICY categories_read ON public.categories FOR SELECT TO camms_app USING (private.current_app_role() IS NOT NULL AND (is_active OR private.current_app_role() = 'admin'::text));
CREATE POLICY categories_update ON public.categories FOR UPDATE TO camms_app USING (private.current_app_role() = 'admin'::text) WITH CHECK (private.current_app_role() = 'admin'::text);

ALTER TABLE public.disbursement_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY disbursement_items_delete ON public.disbursement_items FOR DELETE TO camms_app USING (private.current_app_role() = 'admin'::text);
CREATE POLICY disbursement_items_read ON public.disbursement_items FOR SELECT TO camms_app USING (private.current_app_role() IS NOT NULL);
CREATE POLICY disbursement_items_update ON public.disbursement_items FOR UPDATE TO camms_app USING (private.current_app_role() = 'admin'::text) WITH CHECK (private.current_app_role() = 'admin'::text);
CREATE POLICY disbursement_items_insert ON public.disbursement_items FOR INSERT TO camms_app WITH CHECK (((private.current_app_role() = 'admin'::text) OR ((private.current_app_role() = 'user'::text) AND (status = 'pending'::text) AND (issued_qty = 0) AND (returned_qty = 0) AND (item_name_snapshot IS NULL) AND (asset_no_snapshot IS NULL) AND (serial_no_snapshot IS NULL) AND (brand_snapshot IS NULL) AND (model_snapshot IS NULL) AND (unit_name_snapshot IS NULL) AND (COALESCE(unit_price_snapshot, (0)::numeric) = (0)::numeric) AND (category_name_snapshot IS NULL) AND (location_name_snapshot IS NULL) AND (EXISTS ( SELECT 1
   FROM public.disbursements d
  WHERE ((d.id = disbursement_items.disbursement_id) AND (d.created_by = private.current_user_id()) AND (d.status = 'pending_approval'::text) AND (d.transaction_type = ANY (ARRAY['material_issue'::text, 'asset_handover'::text, 'asset_borrow'::text]))))))));

ALTER TABLE public.disbursement_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY disbursement_sequences_read ON public.disbursement_sequences FOR SELECT TO camms_app USING (private.current_app_role() IS NOT NULL);
CREATE POLICY disbursement_sequences_write ON public.disbursement_sequences TO camms_app USING (private.current_app_role() = 'admin'::text) WITH CHECK (private.current_app_role() = 'admin'::text);

ALTER TABLE public.disbursements ENABLE ROW LEVEL SECURITY;
CREATE POLICY disbursements_delete ON public.disbursements FOR DELETE TO camms_app USING (private.current_app_role() = 'admin'::text);
CREATE POLICY disbursements_read ON public.disbursements FOR SELECT TO camms_app USING (private.current_app_role() IS NOT NULL);
CREATE POLICY disbursements_insert ON public.disbursements FOR INSERT TO camms_app WITH CHECK (((private.current_app_role() = 'admin'::text) OR ((private.current_app_role() = 'user'::text) AND (created_by = private.current_user_id()) AND (status = 'pending_approval'::text) AND (transaction_type = ANY (ARRAY['material_issue'::text, 'asset_handover'::text, 'asset_borrow'::text])) AND (document_no IS NULL) AND (fiscal_year IS NULL) AND (confirmed_by IS NULL) AND (confirmed_at IS NULL) AND (reversal_reason IS NULL) AND (reversed_by IS NULL) AND (reversed_at IS NULL))));
CREATE POLICY disbursements_update ON public.disbursements FOR UPDATE TO camms_app USING (((private.current_app_role() = 'admin'::text) OR ((private.current_app_role() = 'user'::text) AND (created_by = private.current_user_id()) AND (status = 'pending_approval'::text)))) WITH CHECK (((private.current_app_role() = 'admin'::text) OR ((private.current_app_role() = 'user'::text) AND (created_by = private.current_user_id()) AND (status = 'cancelled'::text))));

ALTER TABLE public.inventory_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_registry_read ON public.inventory_registry FOR SELECT TO camms_app USING (private.current_app_role() IS NOT NULL);

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY items_delete ON public.items FOR DELETE TO camms_app USING (private.current_app_role() = 'admin'::text);
CREATE POLICY items_insert ON public.items FOR INSERT TO camms_app WITH CHECK (private.current_app_role() = 'admin'::text);
CREATE POLICY items_read ON public.items FOR SELECT TO camms_app USING (private.current_app_role() IS NOT NULL AND ((deleted_at IS NULL) OR (private.current_app_role() = 'admin'::text)));
CREATE POLICY items_update ON public.items FOR UPDATE TO camms_app USING (private.current_app_role() = 'admin'::text) WITH CHECK (private.current_app_role() = 'admin'::text);

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY locations_delete ON public.locations FOR DELETE TO camms_app USING (private.current_app_role() = 'admin'::text);
CREATE POLICY locations_insert ON public.locations FOR INSERT TO camms_app WITH CHECK (private.current_app_role() = 'admin'::text);
CREATE POLICY locations_read ON public.locations FOR SELECT TO camms_app USING (private.current_app_role() IS NOT NULL AND (is_active OR (private.current_app_role() = 'admin'::text)));
CREATE POLICY locations_update ON public.locations FOR UPDATE TO camms_app USING (private.current_app_role() = 'admin'::text) WITH CHECK (private.current_app_role() = 'admin'::text);

ALTER TABLE public.material_stock_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_stock_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY material_stock_documents_read ON public.material_stock_documents FOR SELECT TO camms_app USING (private.current_app_role() IS NOT NULL);
CREATE POLICY material_stock_documents_insert ON public.material_stock_documents FOR INSERT TO camms_app WITH CHECK (private.current_app_role() = 'admin'::text AND created_by = private.current_user_id());

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY materials_delete ON public.materials FOR DELETE TO camms_app USING (private.current_app_role() = 'admin'::text);
CREATE POLICY materials_insert ON public.materials FOR INSERT TO camms_app WITH CHECK (private.current_app_role() = 'admin'::text);
CREATE POLICY materials_read ON public.materials FOR SELECT TO camms_app USING (private.current_app_role() IS NOT NULL AND (deleted_at IS NULL OR private.current_app_role() = 'admin'::text));
CREATE POLICY materials_update ON public.materials FOR UPDATE TO camms_app USING (private.current_app_role() = 'admin'::text) WITH CHECK (private.current_app_role() = 'admin'::text);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_auth ON public.profiles TO camms_auth USING (true) WITH CHECK (true);
CREATE POLICY profiles_read ON public.profiles FOR SELECT TO camms_app USING (private.current_app_role() IS NOT NULL);
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE TO camms_app USING (id = private.current_user_id() AND private.current_app_role() IS NOT NULL) WITH CHECK (id = private.current_user_id() AND private.current_app_role() IS NOT NULL);

ALTER TABLE public.request_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY request_batches_read ON public.request_batches FOR SELECT TO camms_app USING (private.current_app_role() = 'admin'::text OR (private.current_app_role() = 'user'::text AND created_by = private.current_user_id()));
CREATE POLICY request_batches_insert ON public.request_batches FOR INSERT TO camms_app WITH CHECK (private.current_app_role() IS NOT NULL AND created_by = private.current_user_id());

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY stock_movements_insert ON public.stock_movements FOR INSERT TO camms_app WITH CHECK (private.current_app_role() = 'admin'::text);
CREATE POLICY stock_movements_read ON public.stock_movements FOR SELECT TO camms_app USING (private.current_app_role() IS NOT NULL);

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE POLICY units_delete ON public.units FOR DELETE TO camms_app USING (private.current_app_role() = 'admin'::text);
CREATE POLICY units_insert ON public.units FOR INSERT TO camms_app WITH CHECK (private.current_app_role() = 'admin'::text);
CREATE POLICY units_read ON public.units FOR SELECT TO camms_app USING (private.current_app_role() IS NOT NULL AND (is_active OR (private.current_app_role() = 'admin'::text)));
CREATE POLICY units_update ON public.units FOR UPDATE TO camms_app USING (private.current_app_role() = 'admin'::text) WITH CHECK (private.current_app_role() = 'admin'::text);

-- Grants & Revokes
GRANT USAGE ON SCHEMA private TO camms_app;
GRANT USAGE ON SCHEMA private TO camms_auth;
GRANT USAGE ON SCHEMA private_auth TO camms_auth;
GRANT USAGE ON SCHEMA public TO camms_app;
GRANT USAGE ON SCHEMA public TO camms_auth;

REVOKE ALL ON FUNCTION private.audit_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.audit_material_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.current_app_role() FROM PUBLIC;
GRANT ALL ON FUNCTION private.current_app_role() TO camms_app;
GRANT ALL ON FUNCTION private.current_app_role() TO camms_auth;

REVOKE ALL ON FUNCTION private.current_user_id() FROM PUBLIC;
GRANT ALL ON FUNCTION private.current_user_id() TO camms_app;
GRANT ALL ON FUNCTION private.current_user_id() TO camms_auth;

REVOKE ALL ON FUNCTION private.get_public_item(text) FROM PUBLIC;
GRANT ALL ON FUNCTION private.get_public_item(text) TO camms_app;

REVOKE ALL ON FUNCTION private.is_public_item_image(text) FROM PUBLIC;
GRANT ALL ON FUNCTION private.is_public_item_image(text) TO camms_app;

REVOKE ALL ON FUNCTION private.stamp_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.inventory_identity() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.version_material_changes() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.protect_material_stock_document() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.open_material_stock_ledger() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.material_always_central() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.protect_request_batch_link() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.protect_disbursement_tracking() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.debit_pending_material_line() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.restore_pending_material_stock() FROM PUBLIC;

REVOKE ALL ON FUNCTION private_auth.record_admin_event(uuid, uuid, text) FROM PUBLIC;
GRANT ALL ON FUNCTION private_auth.record_admin_event(uuid, uuid, text) TO camms_auth;

REVOKE ALL ON FUNCTION private_auth.consume_profile_password() FROM PUBLIC;
REVOKE ALL ON FUNCTION private_auth.guard_profile_password_insert() FROM PUBLIC;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE private_auth.credentials TO camms_auth;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE private_auth.login_attempts TO camms_auth;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE private_auth.rate_limits TO camms_auth;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE private_auth.sessions TO camms_auth;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE private_auth.consumed_tokens TO camms_auth;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.asset_custody_logs TO camms_app;
GRANT SELECT,INSERT ON TABLE public.audit_logs TO camms_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.categories TO camms_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.disbursement_items TO camms_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.disbursement_sequences TO camms_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.disbursements TO camms_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.items TO camms_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.materials TO camms_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.locations TO camms_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.units TO camms_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.stock_movements TO camms_app;
GRANT SELECT ON TABLE public.inventory_registry TO camms_app;
GRANT SELECT ON public.inventory_items TO camms_app;
GRANT SELECT,INSERT ON public.material_stock_documents TO camms_app;
GRANT SELECT,INSERT ON public.request_batches TO camms_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.user_sso_identities TO camms_auth;
GRANT SELECT ON TABLE public.user_sso_identities TO camms_app;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.profiles TO camms_auth;
GRANT SELECT ON TABLE public.profiles TO camms_app;
GRANT UPDATE(full_name) ON TABLE public.profiles TO camms_app;
GRANT UPDATE(sidebar_order) ON TABLE public.profiles TO camms_app;
