-- Rename the role without changing its permissions or rewriting historical audit records.
LOCK TABLE public.profiles IN SHARE ROW EXCLUSIVE MODE;
--> statement-breakpoint
ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
--> statement-breakpoint
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'user';
--> statement-breakpoint
UPDATE public.profiles SET role = 'user' WHERE role = 'viewer';
--> statement-breakpoint
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'user'));
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
--> statement-breakpoint
DROP POLICY disbursement_items_insert ON public.disbursement_items;
CREATE POLICY disbursement_items_insert ON public.disbursement_items FOR INSERT TO camms_app WITH CHECK (((private.current_app_role() = 'admin'::text) OR ((private.current_app_role() = 'user'::text) AND (status = 'pending'::text) AND (issued_qty = 0) AND (returned_qty = 0) AND (item_name_snapshot IS NULL) AND (asset_no_snapshot IS NULL) AND (serial_no_snapshot IS NULL) AND (brand_snapshot IS NULL) AND (model_snapshot IS NULL) AND (unit_name_snapshot IS NULL) AND (COALESCE(unit_price_snapshot, (0)::numeric) = (0)::numeric) AND (category_name_snapshot IS NULL) AND (location_name_snapshot IS NULL) AND (EXISTS ( SELECT 1
   FROM public.disbursements d
  WHERE ((d.id = disbursement_items.disbursement_id) AND (d.created_by = private.current_user_id()) AND (d.status = 'pending_approval'::text) AND (d.transaction_type = ANY (ARRAY['material_issue'::text, 'asset_handover'::text, 'asset_borrow'::text]))))))));
--> statement-breakpoint
DROP POLICY disbursements_insert ON public.disbursements;
CREATE POLICY disbursements_insert ON public.disbursements FOR INSERT TO camms_app WITH CHECK (((private.current_app_role() = 'admin'::text) OR ((private.current_app_role() = 'user'::text) AND (created_by = private.current_user_id()) AND (status = 'pending_approval'::text) AND (transaction_type = ANY (ARRAY['material_issue'::text, 'asset_handover'::text, 'asset_borrow'::text])) AND (document_no IS NULL) AND (fiscal_year IS NULL) AND (confirmed_by IS NULL) AND (confirmed_at IS NULL) AND (reversal_reason IS NULL) AND (reversed_by IS NULL) AND (reversed_at IS NULL))));
--> statement-breakpoint
DROP POLICY disbursements_update ON public.disbursements;
CREATE POLICY disbursements_update ON public.disbursements FOR UPDATE TO camms_app USING (((private.current_app_role() = 'admin'::text) OR ((private.current_app_role() = 'user'::text) AND (created_by = private.current_user_id()) AND (status = 'pending_approval'::text)))) WITH CHECK (((private.current_app_role() = 'admin'::text) OR ((private.current_app_role() = 'user'::text) AND (created_by = private.current_user_id()) AND (status = 'cancelled'::text))));
