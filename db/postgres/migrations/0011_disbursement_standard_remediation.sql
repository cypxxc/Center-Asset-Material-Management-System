CREATE TABLE "material_stock_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"request_key" uuid NOT NULL,
	"created_by" uuid,
	"payload_hash" text NOT NULL,
	"quantity" integer NOT NULL,
	"accepted_quantity" integer DEFAULT 0 NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"reference" text NOT NULL,
	"disbursement_item_id" uuid,
	"opening_balance" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_stock_documents_kind_check" CHECK ("material_stock_documents"."kind" in ('receipt','count','return','opening')),
	CONSTRAINT "material_stock_documents_quantity_check" CHECK ("material_stock_documents"."quantity">=0),
	CONSTRAINT "material_stock_documents_accepted_check" CHECK ("material_stock_documents"."accepted_quantity">=0 and "material_stock_documents"."accepted_quantity"<="material_stock_documents"."quantity"),
	CONSTRAINT "material_stock_documents_reason_check" CHECK (length(btrim("material_stock_documents"."reason"))>0),
	CONSTRAINT "material_stock_documents_reference_check" CHECK (length(btrim("material_stock_documents"."reference"))>0),
	CONSTRAINT "material_stock_documents_return_check" CHECK (("material_stock_documents"."kind"='return')=("material_stock_documents"."disbursement_item_id" is not null)),
	CONSTRAINT "material_stock_documents_opening_check" CHECK (("material_stock_documents"."kind"='opening')=("material_stock_documents"."opening_balance" is not null))
);
--> statement-breakpoint
CREATE TABLE "request_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by" uuid NOT NULL,
	"request_key" uuid NOT NULL,
	"payload_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_type_check";--> statement-breakpoint
ALTER TABLE "disbursements" ADD COLUMN "request_batch_id" uuid;--> statement-breakpoint
ALTER TABLE "disbursements" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "disbursements" ADD COLUMN "handed_over_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "disbursements" ADD COLUMN "handed_over_by" uuid;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "metadata_version" bigint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "stock_version" bigint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "stock_document_id" uuid;--> statement-breakpoint
ALTER TABLE "material_stock_documents" ADD CONSTRAINT "material_stock_documents_item_id_inventory_registry_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_registry"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_stock_documents" ADD CONSTRAINT "material_stock_documents_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_stock_documents" ADD CONSTRAINT "material_stock_documents_disbursement_item_id_disbursement_items_id_fk" FOREIGN KEY ("disbursement_item_id") REFERENCES "public"."disbursement_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_batches" ADD CONSTRAINT "request_batches_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "material_stock_documents_creator_key_unique" ON "material_stock_documents" USING btree ("created_by","request_key");--> statement-breakpoint
CREATE UNIQUE INDEX "material_stock_opening_unique" ON "material_stock_documents" USING btree ("item_id") WHERE "material_stock_documents"."kind"='opening';--> statement-breakpoint
CREATE INDEX "material_stock_documents_item_created" ON "material_stock_documents" USING btree ("item_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "request_batches_creator_key_unique" ON "request_batches" USING btree ("created_by","request_key");--> statement-breakpoint
ALTER TABLE "disbursements" ADD CONSTRAINT "disbursements_request_batch_id_request_batches_id_fk" FOREIGN KEY ("request_batch_id") REFERENCES "public"."request_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disbursements" ADD CONSTRAINT "disbursements_handed_over_by_profiles_id_fk" FOREIGN KEY ("handed_over_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_stock_document_id_material_stock_documents_id_fk" FOREIGN KEY ("stock_document_id") REFERENCES "public"."material_stock_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "disbursements_batch_index" ON "disbursements" USING btree ("request_batch_id") WHERE "disbursements"."request_batch_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_movements_document_unique" ON "stock_movements" USING btree ("stock_document_id") WHERE "stock_movements"."stock_document_id" is not null;--> statement-breakpoint
ALTER TABLE "disbursements" ADD CONSTRAINT "disbursements_handover_time_check" CHECK ("disbursements"."handed_over_at" is not null or "disbursements"."handed_over_by" is null);--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_type_check" CHECK ("stock_movements"."movement_type" in ('issue','reversal','adjust_audit','receipt','material_return'));
--> statement-breakpoint
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
REVOKE ALL ON FUNCTION private.version_material_changes() FROM PUBLIC;
CREATE TRIGGER version_material_changes BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION private.version_material_changes();


--> statement-breakpoint
ALTER TABLE public.material_stock_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_stock_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY material_stock_documents_read ON public.material_stock_documents FOR SELECT TO camms_app USING(private.current_app_role() IS NOT NULL);
CREATE POLICY material_stock_documents_insert ON public.material_stock_documents FOR INSERT TO camms_app WITH CHECK(private.current_app_role()='admin' AND created_by=private.current_user_id());
GRANT SELECT,INSERT ON public.material_stock_documents TO camms_app;
CREATE FUNCTION private.protect_material_stock_document() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'Stock documents are immutable'; END $$;
REVOKE ALL ON FUNCTION private.protect_material_stock_document() FROM PUBLIC;
CREATE TRIGGER protect_material_stock_document BEFORE UPDATE OR DELETE ON public.material_stock_documents FOR EACH ROW EXECUTE FUNCTION private.protect_material_stock_document();

--> statement-breakpoint
-- Record the existing physical snapshot without changing it or rewriting history.
INSERT INTO public.material_stock_documents(item_id,kind,request_key,created_by,payload_hash,quantity,delta,reason,reference,opening_balance)
SELECT m.id,'opening',gen_random_uuid(),m.created_by,'migration-opening-snapshot',m.quantity,0,
  'บันทึกยอดตั้งต้นจากยอดคงเหลือและประวัติ ณ วันเริ่มตรวจสอบบัญชี','MIGRATION-STOCK-OPENING',
  m.quantity::bigint-coalesce((SELECT sum(sm.delta) FROM public.stock_movements sm WHERE sm.item_id=m.id),0)
FROM public.materials m;

CREATE FUNCTION private.open_material_stock_ledger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  -- Full/data restore supplies persisted opening documents separately.
  IF private.current_app_role() IS NULL THEN RETURN NEW; END IF;
  IF private.current_app_role()<>'admin' THEN RAISE EXCEPTION 'Only admins may open material stock'; END IF;
  INSERT INTO public.material_stock_documents(item_id,kind,request_key,created_by,payload_hash,quantity,delta,reason,reference,opening_balance)
  VALUES(NEW.id,'opening',pg_catalog.gen_random_uuid(),private.current_user_id(),'new-material-opening',NEW.quantity,0,
    'ยอดตั้งต้นเมื่อขึ้นทะเบียนวัสดุ','REGISTER-'||NEW.id::text,NEW.quantity);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.open_material_stock_ledger() FROM PUBLIC;
-- Registry insertion must run first; its existing trigger name starts with materials_.
CREATE TRIGGER zz_open_material_stock_ledger AFTER INSERT ON public.materials FOR EACH ROW EXECUTE FUNCTION private.open_material_stock_ledger();

--> statement-breakpoint
ALTER TABLE public.request_batches ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT ON public.request_batches TO camms_app;
CREATE POLICY request_batches_read ON public.request_batches FOR SELECT TO camms_app USING (private.current_app_role()='admin' OR (private.current_app_role()='user' AND created_by=private.current_user_id()));
CREATE POLICY request_batches_insert ON public.request_batches FOR INSERT TO camms_app WITH CHECK (private.current_app_role() IS NOT NULL AND created_by=private.current_user_id());
CREATE TRIGGER request_batches_immutable BEFORE UPDATE OR DELETE ON public.request_batches FOR EACH ROW EXECUTE FUNCTION public.prevent_stock_and_custody_tampering();

--> statement-breakpoint
CREATE FUNCTION private.protect_request_batch_link() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.request_batch_id IS DISTINCT FROM OLD.request_batch_id THEN
   RAISE EXCEPTION 'Request batch link is immutable';
 END IF;
 IF TG_OP='INSERT' AND NEW.request_batch_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM public.request_batches b WHERE b.id=NEW.request_batch_id AND b.created_by=NEW.created_by
 ) THEN RAISE EXCEPTION 'Invalid request batch owner'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.protect_request_batch_link() FROM PUBLIC;
CREATE TRIGGER disbursement_request_batch_link BEFORE INSERT OR UPDATE ON public.disbursements FOR EACH ROW EXECUTE FUNCTION private.protect_request_batch_link();

--> statement-breakpoint
CREATE FUNCTION private.protect_disbursement_tracking() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
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
REVOKE ALL ON FUNCTION private.protect_disbursement_tracking() FROM PUBLIC;
CREATE TRIGGER protect_disbursement_tracking BEFORE UPDATE ON public.disbursements FOR EACH ROW EXECUTE FUNCTION private.protect_disbursement_tracking();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.protect_disbursement_header_immutability() RETURNS trigger
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

