-- CAMMS final PostgreSQL baseline. Schema only; no accounts or business data.
-- Prerequisites: restricted camms_app and camms_auth roles (postgres:app:setup).
SET LOCAL check_function_bodies = false;

CREATE SCHEMA private;

CREATE SCHEMA private_auth;

CREATE SCHEMA IF NOT EXISTS public;

COMMENT ON SCHEMA public IS 'standard public schema';

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

CREATE FUNCTION private.current_app_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT role FROM public.profiles WHERE id=private.current_user_id() AND is_active=true
$$;

CREATE FUNCTION private.current_user_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
 SELECT nullif(current_setting('app.user_id',true),'')::uuid
$$;

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
  FROM public.items i
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

CREATE FUNCTION private.stamp_update() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN NEW.updated_at=now(); RETURN NEW; END;
$$;

CREATE FUNCTION private_auth.record_admin_event(actor uuid, target uuid, event_action text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
 IF actor IS DISTINCT FROM private.current_user_id() OR private.current_app_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
 INSERT INTO public.audit_logs(user_id,action,target_table,target_id) VALUES(actor,event_action,'profiles',target);
END;
$$;

CREATE FUNCTION public.prevent_stock_and_custody_tampering() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RAISE EXCEPTION 'Stock movements and asset custody logs are strictly append-only and cannot be modified or deleted.';
END;
$$;

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
  IF private.current_app_role() = 'viewer' AND NOT (
    OLD.created_by = private.current_user_id() AND OLD.status = 'pending_approval' AND NEW.status = 'cancelled'
  ) THEN RAISE EXCEPTION 'Viewer can only withdraw own pending request'; END IF;
  IF OLD.status <> 'draft' AND ROW(NEW.id,NEW.transaction_type,NEW.recipient_name,NEW.department_name,NEW.purpose,NEW.due_date,NEW.created_by,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.id,OLD.transaction_type,OLD.recipient_name,OLD.department_name,OLD.purpose,OLD.due_date,OLD.created_by,OLD.created_at) THEN
    RAISE EXCEPTION 'Request fields on document % are immutable', OLD.id;
  END IF;
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
    (OLD.status = 'confirmed' AND NEW.status = 'reversed') OR
    (OLD.status IN ('active_borrow','partially_returned') AND NEW.status IN ('partially_returned','returned','reversed'))
  ) THEN RAISE EXCEPTION 'Invalid disbursement transition: % -> %', OLD.status, NEW.status; END IF;
  IF (OLD.status IN ('reversed','rejected') OR NEW.status NOT IN ('reversed','rejected')) AND
    ROW(NEW.reversal_reason,NEW.reversed_at,NEW.reversed_by) IS DISTINCT FROM ROW(OLD.reversal_reason,OLD.reversed_at,OLD.reversed_by) THEN
    RAISE EXCEPTION 'Reversal details on document % are immutable', OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

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

CREATE FUNCTION public.validate_disbursement_item_type() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_doc_type text;
  v_doc_status text;
  v_item_type text;
  v_asset_no text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Serialize line attachment with approval/cancellation of this parent before
    -- taking the same canonical inventory advisory lock used by the application.
    SELECT transaction_type, status INTO v_doc_type, v_doc_status
      FROM public.disbursements WHERE id = NEW.disbursement_id FOR UPDATE;
    IF v_doc_status NOT IN ('draft','pending_approval') THEN
      RAISE EXCEPTION 'Cannot add lines to processed disbursement document';
    END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('camms-disbursement:' || NEW.item_id::text, 0));
    IF EXISTS (
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

  SELECT item_type, asset_no INTO v_item_type, v_asset_no FROM public.items WHERE id = NEW.item_id AND deleted_at IS NULL;
  IF v_item_type IS NULL THEN
    RAISE EXCEPTION 'Item does not exist or has been deleted';
  END IF;

  IF v_doc_type = 'material_issue' AND v_item_type != 'material' THEN
    RAISE EXCEPTION 'Document type material_issue only accepts material items';
  END IF;

  IF v_doc_type IN ('asset_handover', 'asset_borrow') THEN
    IF v_item_type != 'asset' THEN
      RAISE EXCEPTION 'Document type % only accepts asset items', v_doc_type;
    END IF;
    IF v_doc_type = 'asset_borrow' AND (v_asset_no IS NULL OR trim(v_asset_no) = '') THEN
      RAISE EXCEPTION 'Asset borrowing requires an asset with an asset_no';
    END IF;
    IF v_doc_type = 'asset_borrow' AND NEW.requested_qty != 1 THEN
      RAISE EXCEPTION 'Asset borrowing quantity must be exactly 1 per tracked asset';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;



CREATE TABLE private_auth.credentials (
    user_id uuid NOT NULL,
    password_hash text NOT NULL
);

CREATE TABLE private_auth.login_attempts (
    key text NOT NULL,
    window_started_at timestamp with time zone DEFAULT now() NOT NULL,
    attempts integer NOT NULL
);

CREATE TABLE private_auth.rate_limits (
    key text NOT NULL,
    window_started_at timestamp with time zone DEFAULT now() NOT NULL,
    count integer DEFAULT 0 NOT NULL
);

CREATE TABLE private_auth.sessions (
    token_hash text NOT NULL,
    user_id uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

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
    CONSTRAINT asset_custody_action_check CHECK ((action = ANY (ARRAY['handover'::text, 'borrow'::text, 'return'::text, 'reversal'::text]))),
    CONSTRAINT asset_custody_condition_check CHECK ((item_condition = ANY (ARRAY['normal'::text, 'damaged'::text, 'lost'::text]))),
    CONSTRAINT asset_custody_qty_check CHECK ((quantity > 0))
);

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action text NOT NULL,
    target_table text NOT NULL,
    target_id uuid,
    old_data jsonb,
    new_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    color text DEFAULT '#64748B'::text NOT NULL,
    icon text DEFAULT 'Tag'::text NOT NULL
);

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
    CONSTRAINT disbursement_items_issue_limit_check CHECK ((issued_qty <= requested_qty)),
    CONSTRAINT disbursement_items_issued_qty_check CHECK ((issued_qty >= 0)),
    CONSTRAINT disbursement_items_requested_qty_check CHECK ((requested_qty > 0)),
    CONSTRAINT disbursement_items_returned_qty_check CHECK (((returned_qty >= 0) AND (returned_qty <= issued_qty))),
    CONSTRAINT disbursement_items_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'issued'::text, 'partially_returned'::text, 'returned'::text, 'reversed'::text])))
);

CREATE TABLE public.disbursement_sequences (
    fiscal_year integer NOT NULL,
    prefix text NOT NULL,
    current_val integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.disbursements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_no text,
    fiscal_year integer,
    transaction_type text NOT NULL,
    recipient_name text NOT NULL,
    department_name text NOT NULL,
    purpose text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    due_date date,
    confirmed_at timestamp with time zone,
    confirmed_by uuid,
    reversal_reason text,
    reversed_at timestamp with time zone,
    reversed_by uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT check_due_date_on_borrow CHECK (((transaction_type <> 'asset_borrow'::text) OR (status = 'draft'::text) OR (due_date IS NOT NULL))),
    CONSTRAINT check_reversal_meta CHECK (((status <> 'reversed'::text) OR ((reversal_reason IS NOT NULL) AND (reversed_by IS NOT NULL) AND (reversed_at IS NOT NULL)))),
    CONSTRAINT disbursements_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending_approval'::text, 'confirmed'::text, 'active_borrow'::text, 'partially_returned'::text, 'returned'::text, 'reversed'::text, 'cancelled'::text, 'rejected'::text]))),
    CONSTRAINT disbursements_type_check CHECK ((transaction_type = ANY (ARRAY['material_issue'::text, 'asset_handover'::text, 'asset_borrow'::text])))
);

CREATE TABLE public.items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_name text NOT NULL,
    item_type text NOT NULL,
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
    acquired_date date,
    budget_source text,
    gfmis_number text,
    is_central boolean DEFAULT false NOT NULL,
    qualification_status text,
    CONSTRAINT items_depreciation_check CHECK (((NOT depreciation_enabled) OR COALESCE(((item_type = 'asset'::text) AND (depreciation_method = 'straight_line'::text) AND (depreciation_cost > (1)::numeric) AND (depreciation_useful_life_years > 0) AND (depreciation_start_basis = ANY (ARRAY['acquired'::text, 'available'::text, 'manual'::text])) AND (depreciation_start_date IS NOT NULL) AND (depreciation_residual_value = (1)::numeric)), false))),
    CONSTRAINT items_price_check CHECK (((unit_price IS NULL) OR (unit_price >= (0)::numeric))),
    CONSTRAINT items_qualification_status_check CHECK (((qualification_status IS NULL) OR (qualification_status = ANY (ARRAY['qualified'::text, 'below_threshold'::text])))),
    CONSTRAINT items_quantity_check CHECK ((quantity >= 0)),
    CONSTRAINT items_status_check CHECK ((status = ANY (ARRAY['active'::text, 'spare'::text, 'damaged'::text, 'waiting_repair'::text, 'inactive'::text, 'disposed'::text]))),
    CONSTRAINT items_type_check CHECK ((item_type = ANY (ARRAY['asset'::text, 'material'::text])))
);

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text NOT NULL,
    email text,
    role text DEFAULT 'viewer'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sidebar_order jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'viewer'::text])))
);

CREATE TABLE public.stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    disbursement_item_id uuid,
    delta integer NOT NULL,
    balance_after integer NOT NULL,
    movement_type text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stock_movements_balance_check CHECK ((balance_after >= 0)),
    CONSTRAINT stock_movements_type_check CHECK ((movement_type = ANY (ARRAY['issue'::text, 'reversal'::text, 'adjust_audit'::text])))
);

CREATE TABLE public.units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY private_auth.credentials
    ADD CONSTRAINT credentials_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY private_auth.login_attempts
    ADD CONSTRAINT login_attempts_pkey PRIMARY KEY (key);

ALTER TABLE ONLY private_auth.rate_limits
    ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (key);

ALTER TABLE ONLY private_auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (token_hash);

ALTER TABLE ONLY public.asset_custody_logs
    ADD CONSTRAINT asset_custody_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_unique UNIQUE (name);

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.disbursement_items
    ADD CONSTRAINT disbursement_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.disbursements
    ADD CONSTRAINT disbursements_document_no_unique UNIQUE (document_no);

ALTER TABLE ONLY public.disbursements
    ADD CONSTRAINT disbursements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_name_unique UNIQUE (name);

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);

CREATE INDEX login_attempts_window_index ON private_auth.login_attempts USING btree (window_started_at);

CREATE INDEX rate_limits_window_index ON private_auth.rate_limits USING btree (window_started_at);

CREATE INDEX sessions_expiry_index ON private_auth.sessions USING btree (expires_at);

CREATE INDEX sessions_user_index ON private_auth.sessions USING btree (user_id);

CREATE INDEX asset_custody_item_created_index ON public.asset_custody_logs USING btree (item_id, created_at);

CREATE INDEX audit_created_index ON public.audit_logs USING btree (created_at);

CREATE INDEX audit_target_index ON public.audit_logs USING btree (target_table, target_id);

CREATE INDEX disbursement_items_doc_index ON public.disbursement_items USING btree (disbursement_id);

CREATE UNIQUE INDEX disbursement_items_document_item_unique ON public.disbursement_items USING btree (disbursement_id, item_id);

CREATE INDEX disbursement_items_item_index ON public.disbursement_items USING btree (item_id);

CREATE UNIQUE INDEX disbursement_sequences_pk ON public.disbursement_sequences USING btree (fiscal_year, prefix);

CREATE INDEX disbursements_created_index ON public.disbursements USING btree (created_at);

CREATE INDEX disbursements_status_index ON public.disbursements USING btree (status);

CREATE UNIQUE INDEX items_asset_no_unique ON public.items USING btree (asset_no) WHERE ((deleted_at IS NULL) AND (asset_no IS NOT NULL));

CREATE INDEX items_category_index ON public.items USING btree (category_id);

CREATE INDEX items_is_central_index ON public.items USING btree (is_central) WHERE (deleted_at IS NULL);

CREATE INDEX items_location_index ON public.items USING btree (location_id);

CREATE INDEX items_qualification_status_index ON public.items USING btree (qualification_status) WHERE (deleted_at IS NULL);

CREATE UNIQUE INDEX items_serial_no_unique ON public.items USING btree (serial_no) WHERE ((deleted_at IS NULL) AND (serial_no IS NOT NULL));

CREATE INDEX items_type_status_index ON public.items USING btree (item_type, status);

CREATE INDEX items_updated_index ON public.items USING btree (updated_at);

CREATE UNIQUE INDEX profiles_email_unique ON public.profiles USING btree (lower(email));

CREATE INDEX stock_movements_item_created_index ON public.stock_movements USING btree (item_id, created_at);

CREATE TRIGGER categories_audit AFTER INSERT OR DELETE OR UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION private.audit_change();

CREATE TRIGGER categories_stamp BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION private.stamp_update();

CREATE TRIGGER disbursements_stamp BEFORE UPDATE ON public.disbursements FOR EACH ROW EXECUTE FUNCTION private.stamp_update();

CREATE TRIGGER items_audit AFTER INSERT OR DELETE OR UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION private.audit_change();

CREATE TRIGGER items_stamp BEFORE UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION private.stamp_update();

CREATE TRIGGER locations_audit AFTER INSERT OR DELETE OR UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION private.audit_change();

CREATE TRIGGER locations_stamp BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION private.stamp_update();

CREATE TRIGGER on_disbursement_header_protect BEFORE DELETE OR UPDATE ON public.disbursements FOR EACH ROW EXECUTE FUNCTION public.protect_disbursement_header_immutability();

CREATE TRIGGER on_disbursement_item_protect BEFORE DELETE OR UPDATE ON public.disbursement_items FOR EACH ROW EXECUTE FUNCTION public.protect_disbursement_item_immutability();

CREATE TRIGGER on_disbursement_item_validate BEFORE INSERT OR UPDATE ON public.disbursement_items FOR EACH ROW EXECUTE FUNCTION public.validate_disbursement_item_type();

CREATE TRIGGER profiles_audit AFTER INSERT OR DELETE OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.audit_change();

CREATE TRIGGER profiles_stamp BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.stamp_update();

CREATE TRIGGER trg_prevent_asset_custody_tampering BEFORE DELETE OR UPDATE ON public.asset_custody_logs FOR EACH ROW EXECUTE FUNCTION public.prevent_stock_and_custody_tampering();

CREATE TRIGGER trg_prevent_stock_movements_tampering BEFORE DELETE OR UPDATE ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION public.prevent_stock_and_custody_tampering();

CREATE TRIGGER units_audit AFTER INSERT OR DELETE OR UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION private.audit_change();

CREATE TRIGGER units_stamp BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION private.stamp_update();

ALTER TABLE ONLY private_auth.credentials
    ADD CONSTRAINT credentials_user_id_profiles_id_fk FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY private_auth.sessions
    ADD CONSTRAINT sessions_user_id_profiles_id_fk FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.asset_custody_logs
    ADD CONSTRAINT asset_custody_logs_created_by_profiles_id_fk FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.asset_custody_logs
    ADD CONSTRAINT asset_custody_logs_disbursement_item_id_disbursement_items_id_f FOREIGN KEY (disbursement_item_id) REFERENCES public.disbursement_items(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.asset_custody_logs
    ADD CONSTRAINT asset_custody_logs_item_id_items_id_fk FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_profiles_id_fk FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.disbursement_items
    ADD CONSTRAINT disbursement_items_disbursement_id_disbursements_id_fk FOREIGN KEY (disbursement_id) REFERENCES public.disbursements(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.disbursement_items
    ADD CONSTRAINT disbursement_items_item_id_items_id_fk FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.disbursements
    ADD CONSTRAINT disbursements_confirmed_by_profiles_id_fk FOREIGN KEY (confirmed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.disbursements
    ADD CONSTRAINT disbursements_created_by_profiles_id_fk FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.disbursements
    ADD CONSTRAINT disbursements_reversed_by_profiles_id_fk FOREIGN KEY (reversed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_created_by_profiles_id_fk FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_deleted_by_profiles_id_fk FOREIGN KEY (deleted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_location_id_locations_id_fk FOREIGN KEY (location_id) REFERENCES public.locations(id);

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_unit_id_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.units(id);

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_updated_by_profiles_id_fk FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_created_by_profiles_id_fk FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_disbursement_item_id_disbursement_items_id_fk FOREIGN KEY (disbursement_item_id) REFERENCES public.disbursement_items(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_item_id_items_id_fk FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE RESTRICT;

ALTER TABLE public.asset_custody_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY asset_custody_logs_insert ON public.asset_custody_logs FOR INSERT TO camms_app WITH CHECK ((private.current_app_role() = 'admin'::text));

CREATE POLICY asset_custody_logs_read ON public.asset_custody_logs FOR SELECT TO camms_app USING ((private.current_app_role() IS NOT NULL));

CREATE POLICY audit_append ON public.audit_logs FOR INSERT TO camms_app WITH CHECK (((user_id = private.current_user_id()) AND (private.current_app_role() IS NOT NULL)));

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_read ON public.audit_logs FOR SELECT TO camms_app USING (((private.current_app_role() = 'admin'::text) OR ((target_table = 'items'::text) AND (private.current_app_role() IS NOT NULL))));

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY categories_delete ON public.categories FOR DELETE TO camms_app USING ((private.current_app_role() = 'admin'::text));

CREATE POLICY categories_insert ON public.categories FOR INSERT TO camms_app WITH CHECK ((private.current_app_role() = 'admin'::text));

CREATE POLICY categories_read ON public.categories FOR SELECT TO camms_app USING (((private.current_app_role() IS NOT NULL) AND (is_active OR (private.current_app_role() = 'admin'::text))));

CREATE POLICY categories_update ON public.categories FOR UPDATE TO camms_app USING ((private.current_app_role() = 'admin'::text)) WITH CHECK ((private.current_app_role() = 'admin'::text));

ALTER TABLE public.disbursement_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY disbursement_items_delete ON public.disbursement_items FOR DELETE TO camms_app USING ((private.current_app_role() = 'admin'::text));

CREATE POLICY disbursement_items_insert ON public.disbursement_items FOR INSERT TO camms_app WITH CHECK (((private.current_app_role() = 'admin'::text) OR ((private.current_app_role() = 'viewer'::text) AND (status = 'pending'::text) AND (issued_qty = 0) AND (returned_qty = 0) AND (item_name_snapshot IS NULL) AND (asset_no_snapshot IS NULL) AND (serial_no_snapshot IS NULL) AND (brand_snapshot IS NULL) AND (model_snapshot IS NULL) AND (unit_name_snapshot IS NULL) AND (COALESCE(unit_price_snapshot, (0)::numeric) = (0)::numeric) AND (category_name_snapshot IS NULL) AND (location_name_snapshot IS NULL) AND (EXISTS ( SELECT 1
   FROM public.disbursements d
  WHERE ((d.id = disbursement_items.disbursement_id) AND (d.created_by = private.current_user_id()) AND (d.status = 'pending_approval'::text) AND (d.transaction_type = ANY (ARRAY['material_issue'::text, 'asset_handover'::text, 'asset_borrow'::text]))))))));

CREATE POLICY disbursement_items_read ON public.disbursement_items FOR SELECT TO camms_app USING ((private.current_app_role() IS NOT NULL));

CREATE POLICY disbursement_items_update ON public.disbursement_items FOR UPDATE TO camms_app USING ((private.current_app_role() = 'admin'::text)) WITH CHECK ((private.current_app_role() = 'admin'::text));

ALTER TABLE public.disbursement_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY disbursement_sequences_read ON public.disbursement_sequences FOR SELECT TO camms_app USING ((private.current_app_role() IS NOT NULL));

CREATE POLICY disbursement_sequences_write ON public.disbursement_sequences TO camms_app USING ((private.current_app_role() = 'admin'::text)) WITH CHECK ((private.current_app_role() = 'admin'::text));

ALTER TABLE public.disbursements ENABLE ROW LEVEL SECURITY;

CREATE POLICY disbursements_delete ON public.disbursements FOR DELETE TO camms_app USING ((private.current_app_role() = 'admin'::text));

CREATE POLICY disbursements_insert ON public.disbursements FOR INSERT TO camms_app WITH CHECK (((private.current_app_role() = 'admin'::text) OR ((private.current_app_role() = 'viewer'::text) AND (created_by = private.current_user_id()) AND (status = 'pending_approval'::text) AND (transaction_type = ANY (ARRAY['material_issue'::text, 'asset_handover'::text, 'asset_borrow'::text])) AND (document_no IS NULL) AND (fiscal_year IS NULL) AND (confirmed_by IS NULL) AND (confirmed_at IS NULL) AND (reversal_reason IS NULL) AND (reversed_by IS NULL) AND (reversed_at IS NULL))));

CREATE POLICY disbursements_read ON public.disbursements FOR SELECT TO camms_app USING ((private.current_app_role() IS NOT NULL));

CREATE POLICY disbursements_update ON public.disbursements FOR UPDATE TO camms_app USING (((private.current_app_role() = 'admin'::text) OR ((private.current_app_role() = 'viewer'::text) AND (created_by = private.current_user_id()) AND (status = 'pending_approval'::text)))) WITH CHECK (((private.current_app_role() = 'admin'::text) OR ((private.current_app_role() = 'viewer'::text) AND (created_by = private.current_user_id()) AND (status = 'cancelled'::text))));

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

CREATE POLICY items_delete ON public.items FOR DELETE TO camms_app USING ((private.current_app_role() = 'admin'::text));

CREATE POLICY items_insert ON public.items FOR INSERT TO camms_app WITH CHECK ((private.current_app_role() = 'admin'::text));

CREATE POLICY items_read ON public.items FOR SELECT TO camms_app USING (((private.current_app_role() IS NOT NULL) AND ((deleted_at IS NULL) OR (private.current_app_role() = 'admin'::text))));

CREATE POLICY items_update ON public.items FOR UPDATE TO camms_app USING ((private.current_app_role() = 'admin'::text)) WITH CHECK ((private.current_app_role() = 'admin'::text));

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY locations_delete ON public.locations FOR DELETE TO camms_app USING ((private.current_app_role() = 'admin'::text));

CREATE POLICY locations_insert ON public.locations FOR INSERT TO camms_app WITH CHECK ((private.current_app_role() = 'admin'::text));

CREATE POLICY locations_read ON public.locations FOR SELECT TO camms_app USING (((private.current_app_role() IS NOT NULL) AND (is_active OR (private.current_app_role() = 'admin'::text))));

CREATE POLICY locations_update ON public.locations FOR UPDATE TO camms_app USING ((private.current_app_role() = 'admin'::text)) WITH CHECK ((private.current_app_role() = 'admin'::text));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_auth ON public.profiles TO camms_auth USING (true) WITH CHECK (true);

CREATE POLICY profiles_read ON public.profiles FOR SELECT TO camms_app USING ((private.current_app_role() IS NOT NULL));

CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE TO camms_app USING (((id = private.current_user_id()) AND (private.current_app_role() IS NOT NULL))) WITH CHECK (((id = private.current_user_id()) AND (private.current_app_role() IS NOT NULL)));

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_movements_insert ON public.stock_movements FOR INSERT TO camms_app WITH CHECK ((private.current_app_role() = 'admin'::text));

CREATE POLICY stock_movements_read ON public.stock_movements FOR SELECT TO camms_app USING ((private.current_app_role() IS NOT NULL));

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

CREATE POLICY units_delete ON public.units FOR DELETE TO camms_app USING ((private.current_app_role() = 'admin'::text));

CREATE POLICY units_insert ON public.units FOR INSERT TO camms_app WITH CHECK ((private.current_app_role() = 'admin'::text));

CREATE POLICY units_read ON public.units FOR SELECT TO camms_app USING (((private.current_app_role() IS NOT NULL) AND (is_active OR (private.current_app_role() = 'admin'::text))));

CREATE POLICY units_update ON public.units FOR UPDATE TO camms_app USING ((private.current_app_role() = 'admin'::text)) WITH CHECK ((private.current_app_role() = 'admin'::text));

GRANT USAGE ON SCHEMA private TO camms_app;
GRANT USAGE ON SCHEMA private TO camms_auth;

GRANT USAGE ON SCHEMA private_auth TO camms_auth;

GRANT USAGE ON SCHEMA public TO camms_app;
GRANT USAGE ON SCHEMA public TO camms_auth;

REVOKE ALL ON FUNCTION private.audit_change() FROM PUBLIC;

REVOKE ALL ON FUNCTION private.current_app_role() FROM PUBLIC;
GRANT ALL ON FUNCTION private.current_app_role() TO camms_app;
GRANT ALL ON FUNCTION private.current_app_role() TO camms_auth;

REVOKE ALL ON FUNCTION private.current_user_id() FROM PUBLIC;
GRANT ALL ON FUNCTION private.current_user_id() TO camms_app;
GRANT ALL ON FUNCTION private.current_user_id() TO camms_auth;

REVOKE ALL ON FUNCTION private.get_public_item(p_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION private.get_public_item(p_id text) TO camms_app;

REVOKE ALL ON FUNCTION private.stamp_update() FROM PUBLIC;

REVOKE ALL ON FUNCTION private_auth.record_admin_event(actor uuid, target uuid, event_action text) FROM PUBLIC;
GRANT ALL ON FUNCTION private_auth.record_admin_event(actor uuid, target uuid, event_action text) TO camms_auth;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE private_auth.credentials TO camms_auth;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE private_auth.login_attempts TO camms_auth;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE private_auth.rate_limits TO camms_auth;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE private_auth.sessions TO camms_auth;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.asset_custody_logs TO camms_app;

GRANT SELECT,INSERT ON TABLE public.audit_logs TO camms_app;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.categories TO camms_app;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.disbursement_items TO camms_app;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.disbursement_sequences TO camms_app;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.disbursements TO camms_app;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.items TO camms_app;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.locations TO camms_app;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.profiles TO camms_auth;
GRANT SELECT ON TABLE public.profiles TO camms_app;

GRANT UPDATE(full_name) ON TABLE public.profiles TO camms_app;

GRANT UPDATE(sidebar_order) ON TABLE public.profiles TO camms_app;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.stock_movements TO camms_app;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.units TO camms_app;
