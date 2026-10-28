CREATE TABLE IF NOT EXISTS "disbursement_sequences" (
	"fiscal_year" integer NOT NULL,
	"prefix" text NOT NULL,
	"current_val" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "disbursement_sequences_pk" ON "disbursement_sequences" USING btree ("fiscal_year", "prefix");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "disbursements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_no" text,
	"fiscal_year" integer,
	"transaction_type" text NOT NULL,
	"recipient_name" text NOT NULL,
	"department_name" text NOT NULL,
	"purpose" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"due_date" date,
	"confirmed_at" timestamp with time zone,
	"confirmed_by" uuid,
	"reversal_reason" text,
	"reversed_at" timestamp with time zone,
	"reversed_by" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "disbursements_document_no_unique" UNIQUE("document_no"),
	CONSTRAINT "disbursements_type_check" CHECK ("disbursements"."transaction_type" in ('material_issue','asset_handover','asset_borrow')),
	CONSTRAINT "disbursements_status_check" CHECK ("disbursements"."status" in ('draft','confirmed','active_borrow','partially_returned','returned','reversed','cancelled')),
	CONSTRAINT "check_due_date_on_borrow" CHECK ("transaction_type" != 'asset_borrow' OR "status" = 'draft' OR "due_date" IS NOT NULL),
	CONSTRAINT "check_reversal_meta" CHECK ("status" != 'reversed' OR ("reversal_reason" IS NOT NULL AND "reversed_by" IS NOT NULL AND "reversed_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "disbursements" ADD CONSTRAINT "disbursements_confirmed_by_profiles_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "disbursements" ADD CONSTRAINT "disbursements_reversed_by_profiles_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "disbursements" ADD CONSTRAINT "disbursements_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disbursements_status_index" ON "disbursements" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disbursements_created_index" ON "disbursements" USING btree ("created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "disbursement_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"disbursement_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"requested_qty" integer NOT NULL,
	"issued_qty" integer DEFAULT 0 NOT NULL,
	"returned_qty" integer DEFAULT 0 NOT NULL,
	"item_name_snapshot" text,
	"asset_no_snapshot" text,
	"serial_no_snapshot" text,
	"brand_snapshot" text,
	"model_snapshot" text,
	"unit_name_snapshot" text,
	"unit_price_snapshot" numeric(12, 2) DEFAULT 0,
	"category_name_snapshot" text,
	"location_name_snapshot" text,
	"status" text DEFAULT 'pending' NOT NULL,
	CONSTRAINT "disbursement_items_requested_qty_check" CHECK ("disbursement_items"."requested_qty" > 0),
	CONSTRAINT "disbursement_items_issued_qty_check" CHECK ("disbursement_items"."issued_qty" >= 0),
	CONSTRAINT "disbursement_items_returned_qty_check" CHECK ("disbursement_items"."returned_qty" >= 0 and "disbursement_items"."returned_qty" <= "disbursement_items"."issued_qty"),
	CONSTRAINT "disbursement_items_status_check" CHECK ("disbursement_items"."status" in ('pending','issued','partially_returned','returned','reversed'))
);
--> statement-breakpoint
ALTER TABLE "disbursement_items" ADD CONSTRAINT "disbursement_items_disbursement_id_disbursements_id_fk" FOREIGN KEY ("disbursement_id") REFERENCES "public"."disbursements"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "disbursement_items" ADD CONSTRAINT "disbursement_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disbursement_items_doc_index" ON "disbursement_items" USING btree ("disbursement_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disbursement_items_item_index" ON "disbursement_items" USING btree ("item_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"disbursement_item_id" uuid,
	"delta" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"movement_type" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_balance_check" CHECK ("stock_movements"."balance_after" >= 0),
	CONSTRAINT "stock_movements_type_check" CHECK ("stock_movements"."movement_type" in ('issue','reversal','adjust_audit'))
);
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_disbursement_item_id_disbursement_items_id_fk" FOREIGN KEY ("disbursement_item_id") REFERENCES "public"."disbursement_items"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_item_created_index" ON "stock_movements" USING btree ("item_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_custody_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"disbursement_item_id" uuid NOT NULL,
	"action" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"from_responsible" text,
	"to_responsible" text,
	"item_condition" text DEFAULT 'normal' NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_custody_action_check" CHECK ("asset_custody_logs"."action" in ('handover','borrow','return','reversal')),
	CONSTRAINT "asset_custody_condition_check" CHECK ("asset_custody_logs"."item_condition" in ('normal','damaged','lost')),
	CONSTRAINT "asset_custody_qty_check" CHECK ("asset_custody_logs"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "asset_custody_logs" ADD CONSTRAINT "asset_custody_logs_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_custody_logs" ADD CONSTRAINT "asset_custody_logs_disbursement_item_id_disbursement_items_id_fk" FOREIGN KEY ("disbursement_item_id") REFERENCES "public"."disbursement_items"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_custody_logs" ADD CONSTRAINT "asset_custody_logs_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_custody_item_created_index" ON "asset_custody_logs" USING btree ("item_id", "created_at");
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disbursement_sequences, public.disbursements, public.disbursement_items, public.stock_movements, public.asset_custody_logs TO camms_app;
--> statement-breakpoint
ALTER TABLE public.disbursement_sequences ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY disbursement_sequences_read ON public.disbursement_sequences FOR SELECT TO camms_app USING (private.current_app_role() IS NOT NULL);
--> statement-breakpoint
CREATE POLICY disbursement_sequences_write ON public.disbursement_sequences FOR ALL TO camms_app USING (private.current_app_role() IN ('admin','staff')) WITH CHECK (private.current_app_role() IN ('admin','staff'));
--> statement-breakpoint
ALTER TABLE public.disbursements ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY disbursements_read ON public.disbursements FOR SELECT TO camms_app USING (private.current_app_role() IS NOT NULL);
--> statement-breakpoint
CREATE POLICY disbursements_write ON public.disbursements FOR ALL TO camms_app USING (private.current_app_role() IN ('admin','staff')) WITH CHECK (private.current_app_role() IN ('admin','staff'));
--> statement-breakpoint
ALTER TABLE public.disbursement_items ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY disbursement_items_read ON public.disbursement_items FOR SELECT TO camms_app USING (private.current_app_role() IS NOT NULL);
--> statement-breakpoint
CREATE POLICY disbursement_items_write ON public.disbursement_items FOR ALL TO camms_app USING (private.current_app_role() IN ('admin','staff')) WITH CHECK (private.current_app_role() IN ('admin','staff'));
--> statement-breakpoint
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY stock_movements_read ON public.stock_movements FOR SELECT TO camms_app USING (private.current_app_role() IS NOT NULL);
--> statement-breakpoint
CREATE POLICY stock_movements_write ON public.stock_movements FOR ALL TO camms_app USING (private.current_app_role() IN ('admin','staff')) WITH CHECK (private.current_app_role() IN ('admin','staff'));
--> statement-breakpoint
ALTER TABLE public.asset_custody_logs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY asset_custody_logs_read ON public.asset_custody_logs FOR SELECT TO camms_app USING (private.current_app_role() IS NOT NULL);
--> statement-breakpoint
CREATE POLICY asset_custody_logs_write ON public.asset_custody_logs FOR ALL TO camms_app USING (private.current_app_role() IN ('admin','staff')) WITH CHECK (private.current_app_role() IN ('admin','staff'));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.protect_disbursement_header_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status != 'draft' AND OLD.status != 'cancelled' THEN
      RAISE EXCEPTION 'Cannot delete non-draft disbursement document % (status: %)', OLD.id, OLD.status;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status != 'draft' THEN
      IF NEW.id != OLD.id
         OR NEW.document_no != OLD.document_no
         OR NEW.fiscal_year != OLD.fiscal_year
         OR NEW.transaction_type != OLD.transaction_type
         OR NEW.recipient_name != OLD.recipient_name
         OR NEW.department_name != OLD.department_name
         OR NEW.purpose != OLD.purpose
         OR NEW.confirmed_at != OLD.confirmed_at
         OR NEW.confirmed_by IS DISTINCT FROM OLD.confirmed_by
         OR NEW.created_by IS DISTINCT FROM OLD.created_by
         OR NEW.created_at != OLD.created_at THEN
        RAISE EXCEPTION 'Confirmed disbursement document % is immutable for core snapshot fields', OLD.id;
      END IF;

      IF OLD.status = 'reversed' AND (
        NEW.reversal_reason != OLD.reversal_reason OR
        NEW.reversed_at != OLD.reversed_at OR
        NEW.reversed_by IS DISTINCT FROM OLD.reversed_by
      ) THEN
        RAISE EXCEPTION 'Reversal details on document % cannot be modified once set', OLD.id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.protect_disbursement_item_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.validate_disbursement_item_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc_type text;
  v_item_type text;
  v_asset_no text;
BEGIN
  SELECT transaction_type INTO v_doc_type FROM public.disbursements WHERE id = NEW.disbursement_id;
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
--> statement-breakpoint
DROP TRIGGER IF EXISTS on_disbursement_header_protect ON public.disbursements;
--> statement-breakpoint
CREATE TRIGGER on_disbursement_header_protect
  BEFORE UPDATE OR DELETE ON public.disbursements
  FOR EACH ROW EXECUTE FUNCTION public.protect_disbursement_header_immutability();
--> statement-breakpoint
DROP TRIGGER IF EXISTS on_disbursement_item_protect ON public.disbursement_items;
--> statement-breakpoint
CREATE TRIGGER on_disbursement_item_protect
  BEFORE UPDATE OR DELETE ON public.disbursement_items
  FOR EACH ROW EXECUTE FUNCTION public.protect_disbursement_item_immutability();
--> statement-breakpoint
DROP TRIGGER IF EXISTS on_disbursement_item_validate ON public.disbursement_items;
--> statement-breakpoint
CREATE TRIGGER on_disbursement_item_validate
  BEFORE INSERT OR UPDATE ON public.disbursement_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_disbursement_item_type();
--> statement-breakpoint
DROP TRIGGER IF EXISTS disbursements_stamp ON public.disbursements;
--> statement-breakpoint
CREATE TRIGGER disbursements_stamp
  BEFORE UPDATE ON public.disbursements
  FOR EACH ROW EXECUTE FUNCTION private.stamp_update();
