-- Migration: Protect confirmed disbursement documents and item snapshots from direct SQL updates/deletes
-- db/migrations/20261028000200_protect_confirmed_disbursement_snapshots.sql

BEGIN;

-- 1. Trigger function: Protect confirmed disbursement headers
CREATE OR REPLACE FUNCTION public.protect_disbursement_header_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Prevent deletion of confirmed/active/returned/reversed documents
  IF TG_OP = 'DELETE' THEN
    IF OLD.status != 'draft' AND OLD.status != 'cancelled' THEN
      RAISE EXCEPTION 'Cannot delete non-draft disbursement document % (status: %)', OLD.id, OLD.status;
    END IF;
    RETURN OLD;
  END IF;

  -- Protect confirmed fields on UPDATE
  IF TG_OP = 'UPDATE' THEN
    -- If document was already confirmed/terminal, protect immutable attributes
    IF OLD.status != 'draft' THEN
      -- Disallow changing core identity and transaction metadata
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

      -- Reversal metadata cannot be altered once reversed
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

DROP TRIGGER IF EXISTS on_disbursement_header_protect ON public.disbursements;
CREATE TRIGGER on_disbursement_header_protect
  BEFORE UPDATE OR DELETE ON public.disbursements
  FOR EACH ROW EXECUTE FUNCTION public.protect_disbursement_header_immutability();

-- 2. Trigger function: Protect confirmed line items and immutable snapshots
CREATE OR REPLACE FUNCTION public.protect_disbursement_item_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc_status text;
BEGIN
  -- Check parent document status
  IF TG_OP = 'DELETE' THEN
    SELECT status INTO v_doc_status FROM public.disbursements WHERE id = OLD.disbursement_id;
    IF v_doc_status IS NOT NULL AND v_doc_status != 'draft' AND v_doc_status != 'cancelled' THEN
      RAISE EXCEPTION 'Cannot delete line items from non-draft disbursement document %', OLD.disbursement_id;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT status INTO v_doc_status FROM public.disbursements WHERE id = OLD.disbursement_id;

    -- If parent document is already past draft status
    IF v_doc_status IS NOT NULL AND v_doc_status != 'draft' THEN
      -- Prohibit modifying item identity, parent, requested/issued quantities, and snapshots
      IF NEW.id != OLD.id
         OR NEW.disbursement_id != OLD.disbursement_id
         OR NEW.item_id != OLD.item_id
         OR NEW.requested_qty != OLD.requested_qty
         OR (OLD.status != 'pending' AND NEW.issued_qty != OLD.issued_qty)
         OR (OLD.item_name_snapshot IS NOT NULL AND NEW.item_name_snapshot != OLD.item_name_snapshot)
         OR (OLD.asset_no_snapshot IS NOT NULL AND NEW.asset_no_snapshot != OLD.asset_no_snapshot)
         OR (OLD.serial_no_snapshot IS NOT NULL AND NEW.serial_no_snapshot != OLD.serial_no_snapshot)
         OR (OLD.brand_snapshot IS NOT NULL AND NEW.brand_snapshot != OLD.brand_snapshot)
         OR (OLD.model_snapshot IS NOT NULL AND NEW.model_snapshot != OLD.model_snapshot)
         OR (OLD.unit_name_snapshot IS NOT NULL AND NEW.unit_name_snapshot != OLD.unit_name_snapshot)
         OR (OLD.unit_price_snapshot IS NOT NULL AND NEW.unit_price_snapshot != OLD.unit_price_snapshot)
         OR (OLD.category_name_snapshot IS NOT NULL AND NEW.category_name_snapshot != OLD.category_name_snapshot)
         OR (OLD.location_name_snapshot IS NOT NULL AND NEW.location_name_snapshot != OLD.location_name_snapshot) THEN
        RAISE EXCEPTION 'Snapshot and historical attributes of disbursement line % are strictly immutable', OLD.id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_disbursement_item_protect ON public.disbursement_items;
CREATE TRIGGER on_disbursement_item_protect
  BEFORE UPDATE OR DELETE ON public.disbursement_items
  FOR EACH ROW EXECUTE FUNCTION public.protect_disbursement_item_immutability();

REVOKE ALL ON FUNCTION public.protect_disbursement_header_immutability() FROM public;
REVOKE ALL ON FUNCTION public.protect_disbursement_item_immutability() FROM public;

COMMIT;
