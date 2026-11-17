CREATE OR REPLACE FUNCTION public.validate_disbursement_item_type() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_doc_type text;
  v_doc_status text;
  v_item_type text;
  v_asset_no text;
  v_stock integer;
  v_reserved bigint;
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
    IF v_doc_type = 'material_issue' THEN
      SELECT quantity INTO v_stock FROM public.materials WHERE id=NEW.item_id AND deleted_at IS NULL;
      SELECT coalesce(sum(di.requested_qty),0) INTO v_reserved
        FROM public.disbursement_items di JOIN public.disbursements d ON d.id=di.disbursement_id
        WHERE di.item_id=NEW.item_id AND di.id<>NEW.id AND d.transaction_type='material_issue'
          AND d.status='pending_approval' AND di.status='pending';
      IF v_doc_status = 'pending_approval' AND (v_stock IS NULL OR NEW.requested_qty<1 OR v_reserved+NEW.requested_qty>v_stock) THEN
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
