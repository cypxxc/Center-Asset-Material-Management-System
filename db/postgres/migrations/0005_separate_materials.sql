CREATE TABLE "inventory_registry" (
	"id" uuid PRIMARY KEY NOT NULL,
	"item_type" text NOT NULL,
	CONSTRAINT "inventory_registry_type_check" CHECK ("inventory_registry"."item_type" in ('asset','material'))
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_name" text NOT NULL,
	"item_type" text NOT NULL,
	"qualification_status" text,
	"category_id" uuid,
	"location_id" uuid,
	"unit_id" uuid,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(12, 2),
	"asset_no" text,
	"serial_no" text,
	"brand" text,
	"model" text,
	"responsible_person" text,
	"status" text DEFAULT 'active' NOT NULL,
	"note" text,
	"image_url" text,
	"is_central" boolean DEFAULT false NOT NULL,
	"budget_source" text,
	"gfmis_number" text,
	"acquired_date" date,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"deleted_at" timestamp with time zone,
	"depreciation_enabled" boolean DEFAULT false NOT NULL,
	"depreciation_method" text,
	"depreciation_cost" numeric(12, 2),
	"depreciation_useful_life_years" integer,
	"depreciation_start_basis" text,
	"depreciation_start_date" date,
	"depreciation_residual_value" numeric(12, 2) DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"specification" text,
	"commodity_code" text,
	"minimum_quantity" integer,
	"maximum_quantity" integer,
	"fiscal_year" integer,
	"balance_as_of" date,
	"opening_quantity" integer,
	"opening_amount" numeric(14, 2),
	"received_quantity" integer,
	"received_amount" numeric(14, 2),
	"issued_quantity" integer,
	"issued_amount" numeric(14, 2),
	"balance_amount" numeric(14, 2),
	CONSTRAINT "materials_type_check" CHECK ("materials"."item_type" = 'material'),
	CONSTRAINT "materials_quantity_check" CHECK ("materials"."quantity" >= 0),
	CONSTRAINT "materials_price_check" CHECK ("materials"."unit_price" is null or "materials"."unit_price" >= 0),
	CONSTRAINT "materials_depreciation_check" CHECK (not "materials"."depreciation_enabled"),
	CONSTRAINT "materials_status_check" CHECK ("materials"."status" in ('active','spare','damaged','waiting_repair','inactive','disposed')),
	CONSTRAINT "materials_ledger_check" CHECK (coalesce("materials"."minimum_quantity",0)>=0 and coalesce("materials"."maximum_quantity",0)>=0 and coalesce("materials"."opening_quantity",0)>=0 and coalesce("materials"."received_quantity",0)>=0 and coalesce("materials"."issued_quantity",0)>=0 and coalesce("materials"."opening_amount",0)>=0 and coalesce("materials"."received_amount",0)>=0 and coalesce("materials"."issued_amount",0)>=0 and coalesce("materials"."balance_amount",0)>=0)
);
--> statement-breakpoint
ALTER TABLE "items" DROP CONSTRAINT "items_type_check";--> statement-breakpoint
ALTER TABLE "disbursement_items" DROP CONSTRAINT "disbursement_items_item_id_items_id_fk";
--> statement-breakpoint
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_item_id_items_id_fk";
--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_deleted_by_profiles_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_registry_id_type_unique" ON "inventory_registry" USING btree ("id","item_type");--> statement-breakpoint
CREATE INDEX "materials_updated_index" ON "materials" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "materials_category_index" ON "materials" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "materials_location_index" ON "materials" USING btree ("location_id");--> statement-breakpoint

-- Lock both ownership and historical references for an atomic cutover.
LOCK TABLE public.items, public.disbursement_items, public.stock_movements IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.asset_custody_logs c JOIN public.items i ON i.id=c.item_id WHERE i.item_type='material') THEN
  RAISE EXCEPTION 'Material custody history requires manual reconciliation before separation';
 END IF;
END $$;
INSERT INTO public.inventory_registry(id,item_type) SELECT id,item_type FROM public.items;
INSERT INTO public.materials ("id","item_name","item_type","qualification_status","category_id","location_id","unit_id","quantity","unit_price","asset_no","serial_no","brand","model","responsible_person","status","note","image_url","is_central","budget_source","gfmis_number","acquired_date","created_by","updated_by","deleted_by","deleted_at","depreciation_enabled","depreciation_method","depreciation_cost","depreciation_useful_life_years","depreciation_start_basis","depreciation_start_date","depreciation_residual_value","created_at","updated_at") SELECT "id","item_name","item_type","qualification_status","category_id","location_id","unit_id","quantity","unit_price","asset_no","serial_no","brand","model","responsible_person","status","note","image_url","is_central","budget_source","gfmis_number","acquired_date","created_by","updated_by","deleted_by","deleted_at","depreciation_enabled","depreciation_method","depreciation_cost","depreciation_useful_life_years","depreciation_start_basis","depreciation_start_date","depreciation_residual_value","created_at","updated_at" FROM public.items WHERE item_type='material';
ALTER TABLE public.items DISABLE TRIGGER items_audit;
DELETE FROM public.items WHERE item_type='material';
ALTER TABLE public.items ENABLE TRIGGER items_audit;

-- Earlier ledger imports preserved these fields in their provenance note.
-- Keep the original note intact, and promote valid values to searchable columns.
DO $$
DECLARE material_row record; metadata jsonb;
BEGIN
 FOR material_row IN SELECT id,note FROM public.materials WHERE note LIKE '{%' LOOP
  BEGIN
   metadata := material_row.note::jsonb;
   UPDATE public.materials SET
    specification = metadata->'source_fields'->>'specification',
    commodity_code = metadata->'source_fields'->>'commodity_code',
    minimum_quantity = nullif(metadata->'source_fields'->>'minimum','')::integer,
    maximum_quantity = nullif(metadata->'source_fields'->>'maximum','')::integer,
    fiscal_year = substring(metadata->>'source_key' from 'CAMMS-MATERIAL-([0-9]{4}):')::integer,
    balance_as_of = nullif(metadata->>'as_of','')::date
   WHERE id=material_row.id;
  EXCEPTION WHEN data_exception OR check_violation THEN
   -- Ordinary free-text notes are not required to be provenance JSON.
   NULL;
  END;
 END LOOP;
END $$;

ALTER TABLE "disbursement_items" ADD CONSTRAINT "disbursement_items_item_id_inventory_registry_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_registry"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_inventory_registry_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_registry"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_type_check" CHECK ("items"."item_type" = 'asset');
--> statement-breakpoint
CREATE VIEW public.inventory_items WITH (security_invoker=true) AS
 SELECT "id","item_name","item_type","qualification_status","category_id","location_id","unit_id","quantity","unit_price","asset_no","serial_no","brand","model","responsible_person","status","note","image_url","is_central","budget_source","gfmis_number","acquired_date","created_by","updated_by","deleted_by","deleted_at","depreciation_enabled","depreciation_method","depreciation_cost","depreciation_useful_life_years","depreciation_start_basis","depreciation_start_date","depreciation_residual_value","created_at","updated_at" FROM public.items UNION ALL SELECT "id","item_name","item_type","qualification_status","category_id","location_id","unit_id","quantity","unit_price","asset_no","serial_no","brand","model","responsible_person","status","note","image_url","is_central","budget_source","gfmis_number","acquired_date","created_by","updated_by","deleted_by","deleted_at","depreciation_enabled","depreciation_method","depreciation_cost","depreciation_useful_life_years","depreciation_start_basis","depreciation_start_date","depreciation_residual_value","created_at","updated_at" FROM public.materials;
GRANT SELECT ON public.inventory_items TO camms_app;
ALTER TABLE public.inventory_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_registry_read ON public.inventory_registry FOR SELECT TO camms_app USING(private.current_app_role() IS NOT NULL);
GRANT SELECT ON public.inventory_registry TO camms_app;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY materials_read ON public.materials FOR SELECT TO camms_app USING(private.current_app_role() IS NOT NULL AND (deleted_at IS NULL OR private.current_app_role()='admin'));
CREATE POLICY materials_insert ON public.materials FOR INSERT TO camms_app WITH CHECK(private.current_app_role()='admin');
CREATE POLICY materials_update ON public.materials FOR UPDATE TO camms_app USING(private.current_app_role()='admin') WITH CHECK(private.current_app_role()='admin');
CREATE POLICY materials_delete ON public.materials FOR DELETE TO camms_app USING(private.current_app_role()='admin');
GRANT SELECT,INSERT,UPDATE,DELETE ON public.materials TO camms_app;
CREATE FUNCTION private.inventory_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
REVOKE ALL ON FUNCTION private.inventory_identity() FROM PUBLIC;
CREATE TRIGGER items_identity BEFORE INSERT OR UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION private.inventory_identity();
CREATE TRIGGER items_identity_delete AFTER DELETE ON public.items FOR EACH ROW EXECUTE FUNCTION private.inventory_identity();
CREATE TRIGGER materials_identity BEFORE INSERT OR UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION private.inventory_identity();
CREATE TRIGGER materials_identity_delete AFTER DELETE ON public.materials FOR EACH ROW EXECUTE FUNCTION private.inventory_identity();
CREATE FUNCTION private.audit_material_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.audit_logs(user_id,action,target_table,target_id,old_data,new_data)
 VALUES(private.current_user_id(),lower(TG_OP),'materials',coalesce(NEW.id,OLD.id),CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) END,CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) END);
 PERFORM pg_notify('camms_changes','items');
 RETURN coalesce(NEW,OLD);
END $$;
REVOKE ALL ON FUNCTION private.audit_material_change() FROM PUBLIC;
CREATE TRIGGER materials_audit AFTER INSERT OR UPDATE OR DELETE ON public.materials FOR EACH ROW EXECUTE FUNCTION private.audit_material_change();
CREATE TRIGGER materials_stamp BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION private.stamp_update();
ALTER POLICY audit_read ON public.audit_logs USING(private.current_app_role()='admin' OR (target_table IN ('items','materials') AND private.current_app_role() IS NOT NULL));

--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.get_public_item(p_id text) RETURNS TABLE(id uuid, item_name text, item_type text, quantity integer, unit_price numeric, asset_no text, serial_no text, brand text, model text, responsible_person text, status text, note text, image_url text, category_id uuid, category_name text, location_id uuid, location_name text, unit_id uuid, unit_name text, depreciation_enabled boolean, depreciation_method text, depreciation_cost numeric, depreciation_useful_life_years integer, depreciation_start_basis text, depreciation_start_date date, depreciation_residual_value numeric, created_at timestamp with time zone)
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

--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.validate_disbursement_item_type() RETURNS trigger
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

  SELECT item_type, asset_no INTO v_item_type, v_asset_no FROM public.inventory_items WHERE id = NEW.item_id AND deleted_at IS NULL;
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
