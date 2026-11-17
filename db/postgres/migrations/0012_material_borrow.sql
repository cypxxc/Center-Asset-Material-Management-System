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


--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.debit_pending_material_line() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_doc public.disbursements%ROWTYPE; v_balance integer; v_actor uuid;
BEGIN
  SELECT * INTO v_doc FROM public.disbursements WHERE id=NEW.disbursement_id FOR UPDATE;
  IF v_doc.transaction_type NOT IN ('material_issue','asset_borrow') OR v_doc.status<>'pending_approval' THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.materials WHERE id=NEW.item_id) THEN RETURN NEW; END IF;
  v_actor := private.current_user_id();
  -- Owner-side backup restoration/fixtures without an application identity
  -- restore their own persisted stock/ledger, rather than replay requests.
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
REVOKE ALL ON FUNCTION private.debit_pending_material_line() FROM PUBLIC;


CREATE OR REPLACE FUNCTION private.restore_pending_material_stock() RETURNS trigger
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
  -- Acquire the same globally sorted locks before touching any inventory row.
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
REVOKE ALL ON FUNCTION private.restore_pending_material_stock() FROM PUBLIC;


--> statement-breakpoint
CREATE FUNCTION private.material_always_central() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN NEW.is_central := true; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION private.material_always_central() FROM PUBLIC;
CREATE TRIGGER material_always_central BEFORE INSERT OR UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION private.material_always_central();
