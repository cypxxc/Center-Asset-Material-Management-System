-- Migration: Add disbursement ledger, immutable snapshots, custody logs, and sequence generator
-- db/migrations/20261028000100_disbursement_ledger_and_custody.sql

BEGIN;

-- 1. Sequences table for Thai fiscal year document numbering (DIS-YYYY-XXXX)
CREATE TABLE IF NOT EXISTS public.disbursement_sequences (
  fiscal_year integer NOT NULL,
  prefix text NOT NULL,
  current_val integer NOT NULL DEFAULT 0,
  PRIMARY KEY (fiscal_year, prefix)
);

ALTER TABLE public.disbursement_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY disbursement_sequences_read ON public.disbursement_sequences
  FOR SELECT TO authenticated
  USING (private.current_app_role() IS NOT NULL);

CREATE POLICY disbursement_sequences_write ON public.disbursement_sequences
  FOR ALL TO authenticated
  USING (private.current_app_role() IN ('admin', 'staff'))
  WITH CHECK (private.current_app_role() IN ('admin', 'staff'));

-- 2. Header table: disbursements
CREATE TABLE IF NOT EXISTS public.disbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_no text UNIQUE,
  fiscal_year integer,
  transaction_type text NOT NULL CHECK (transaction_type IN ('material_issue', 'asset_handover', 'asset_borrow')),
  recipient_name text NOT NULL,
  department_name text NOT NULL,
  purpose text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'active_borrow', 'partially_returned', 'returned', 'reversed', 'cancelled')),
  due_date date,
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reversal_reason text,
  reversed_at timestamptz,
  reversed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_due_date_on_borrow CHECK (transaction_type != 'asset_borrow' OR status = 'draft' OR due_date IS NOT NULL),
  CONSTRAINT check_reversal_meta CHECK (status != 'reversed' OR (reversal_reason IS NOT NULL AND reversed_by IS NOT NULL AND reversed_at IS NOT NULL))
);

ALTER TABLE public.disbursements ENABLE ROW LEVEL SECURITY;

CREATE POLICY disbursements_read ON public.disbursements
  FOR SELECT TO authenticated
  USING (private.current_app_role() IS NOT NULL);

CREATE POLICY disbursements_write ON public.disbursements
  FOR ALL TO authenticated
  USING (private.current_app_role() IN ('admin', 'staff'))
  WITH CHECK (private.current_app_role() IN ('admin', 'staff'));

CREATE INDEX IF NOT EXISTS idx_disbursements_status ON public.disbursements(status);
CREATE INDEX IF NOT EXISTS idx_disbursements_created_at ON public.disbursements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disbursements_doc_no ON public.disbursements(document_no);

-- 3. Lines table: disbursement_items (with complete historical snapshots)
CREATE TABLE IF NOT EXISTS public.disbursement_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  disbursement_id uuid NOT NULL REFERENCES public.disbursements(id) ON DELETE RESTRICT,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  requested_qty integer NOT NULL CHECK (requested_qty > 0),
  issued_qty integer NOT NULL DEFAULT 0 CHECK (issued_qty >= 0),
  returned_qty integer NOT NULL DEFAULT 0 CHECK (returned_qty >= 0),
  -- Immutable snapshots populated upon confirmation
  item_name_snapshot text,
  asset_no_snapshot text,
  serial_no_snapshot text,
  brand_snapshot text,
  model_snapshot text,
  unit_name_snapshot text,
  unit_price_snapshot numeric(12,2) DEFAULT 0,
  category_name_snapshot text,
  location_name_snapshot text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'issued', 'partially_returned', 'returned', 'reversed')),
  CONSTRAINT check_return_within_issued CHECK (returned_qty <= issued_qty)
);

ALTER TABLE public.disbursement_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY disbursement_items_read ON public.disbursement_items
  FOR SELECT TO authenticated
  USING (private.current_app_role() IS NOT NULL);

CREATE POLICY disbursement_items_write ON public.disbursement_items
  FOR ALL TO authenticated
  USING (private.current_app_role() IN ('admin', 'staff'))
  WITH CHECK (private.current_app_role() IN ('admin', 'staff'));

CREATE INDEX IF NOT EXISTS idx_disbursement_items_doc_id ON public.disbursement_items(disbursement_id);
CREATE INDEX IF NOT EXISTS idx_disbursement_items_item_id ON public.disbursement_items(item_id);

-- 4. Ledger table: stock_movements (for consumable stock tracking)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  disbursement_item_id uuid REFERENCES public.disbursement_items(id) ON DELETE RESTRICT,
  delta integer NOT NULL,
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  movement_type text NOT NULL CHECK (movement_type IN ('issue', 'reversal', 'adjust_audit')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_movements_read ON public.stock_movements
  FOR SELECT TO authenticated
  USING (private.current_app_role() IS NOT NULL);

CREATE POLICY stock_movements_write ON public.stock_movements
  FOR ALL TO authenticated
  USING (private.current_app_role() IN ('admin', 'staff'))
  WITH CHECK (private.current_app_role() IN ('admin', 'staff'));

CREATE INDEX IF NOT EXISTS idx_stock_movements_item_id ON public.stock_movements(item_id, created_at DESC);

-- 5. Custody table: asset_custody_logs (tracks asset borrowing, handover, returns, reversals)
CREATE TABLE IF NOT EXISTS public.asset_custody_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  disbursement_item_id uuid NOT NULL REFERENCES public.disbursement_items(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('handover', 'borrow', 'return', 'reversal')),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  from_responsible text,
  to_responsible text,
  item_condition text NOT NULL DEFAULT 'normal' CHECK (item_condition IN ('normal', 'damaged', 'lost')),
  note text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_custody_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY asset_custody_logs_read ON public.asset_custody_logs
  FOR SELECT TO authenticated
  USING (private.current_app_role() IS NOT NULL);

CREATE POLICY asset_custody_logs_write ON public.asset_custody_logs
  FOR ALL TO authenticated
  USING (private.current_app_role() IN ('admin', 'staff'))
  WITH CHECK (private.current_app_role() IN ('admin', 'staff'));

CREATE INDEX IF NOT EXISTS idx_asset_custody_logs_item ON public.asset_custody_logs(item_id, created_at DESC);

-- 6. Trigger: validate line item type matches document transaction type
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

DROP TRIGGER IF EXISTS on_disbursement_item_validate ON public.disbursement_items;
CREATE TRIGGER on_disbursement_item_validate
  BEFORE INSERT OR UPDATE ON public.disbursement_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_disbursement_item_type();

-- 7. Supabase Stored Procedure: confirm_disbursement_rpc
CREATE OR REPLACE FUNCTION public.confirm_disbursement_rpc(p_disbursement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_caller_id uuid := auth.uid();
  v_doc record;
  v_line record;
  v_item record;
  v_fiscal_year integer;
  v_month integer;
  v_year integer;
  v_seq integer;
  v_doc_no text;
  v_target_status text;
BEGIN
  v_caller_role := private.current_app_role();
  IF v_caller_role NOT IN ('admin', 'staff') OR v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: only admin and staff may confirm disbursements';
  END IF;

  SELECT * INTO v_doc
  FROM public.disbursements
  WHERE id = p_disbursement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Disbursement document not found';
  END IF;

  IF v_doc.status != 'draft' THEN
    RAISE EXCEPTION 'Only draft documents can be confirmed. Current status: %', v_doc.status;
  END IF;

  -- Verify at least one line exists
  IF NOT EXISTS (SELECT 1 FROM public.disbursement_items WHERE disbursement_id = p_disbursement_id) THEN
    RAISE EXCEPTION 'Cannot confirm an empty disbursement document';
  END IF;

  -- Calculate Thai Fiscal Year: October belongs to next fiscal year
  v_month := EXTRACT(MONTH FROM now())::int;
  v_year := EXTRACT(YEAR FROM now())::int + 543;
  IF v_month >= 10 THEN
    v_fiscal_year := v_year + 1;
  ELSE
    v_fiscal_year := v_year;
  END IF;

  -- Allocate sequence number atomically
  INSERT INTO public.disbursement_sequences (fiscal_year, prefix, current_val)
  VALUES (v_fiscal_year, 'DIS', 1)
  ON CONFLICT (fiscal_year, prefix)
  DO UPDATE SET current_val = public.disbursement_sequences.current_val + 1
  RETURNING current_val INTO v_seq;

  v_doc_no := 'DIS-' || v_fiscal_year || '-' || lpad(v_seq::text, 4, '0');

  -- Process line items with row locking
  FOR v_line IN
    SELECT di.*, c.name as category_name, u.name as unit_name, l.name as location_name
    FROM public.disbursement_items di
    JOIN public.items i ON i.id = di.item_id
    LEFT JOIN public.categories c ON c.id = i.category_id
    LEFT JOIN public.units u ON u.id = i.unit_id
    LEFT JOIN public.locations l ON l.id = i.location_id
    WHERE di.disbursement_id = p_disbursement_id
    FOR UPDATE OF di
  LOOP
    -- Lock inventory item
    SELECT * INTO v_item
    FROM public.items
    WHERE id = v_line.item_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item % is unavailable or deleted', v_line.item_id;
    END IF;

    IF v_doc.transaction_type = 'material_issue' THEN
      IF v_item.quantity < v_line.requested_qty THEN
        RAISE EXCEPTION 'Stock insufficient for item % (Requested: %, Available: %)',
          v_item.item_name, v_line.requested_qty, v_item.quantity;
      END IF;

      -- Deduct stock
      UPDATE public.items
      SET quantity = quantity - v_line.requested_qty, updated_at = now()
      WHERE id = v_item.id;

      -- Record stock movement ledger
      INSERT INTO public.stock_movements (
        item_id, disbursement_item_id, delta, balance_after, movement_type, created_by
      ) VALUES (
        v_item.id, v_line.id, -v_line.requested_qty, v_item.quantity - v_line.requested_qty, 'issue', v_caller_id
      );

    ELSIF v_doc.transaction_type IN ('asset_handover', 'asset_borrow') THEN
      -- Record custody transfer
      INSERT INTO public.asset_custody_logs (
        item_id, disbursement_item_id, action, quantity, from_responsible, to_responsible, created_by
      ) VALUES (
        v_item.id, v_line.id,
        CASE WHEN v_doc.transaction_type = 'asset_borrow' THEN 'borrow' ELSE 'handover' END,
        v_line.requested_qty, v_item.responsible_person, v_doc.recipient_name, v_caller_id
      );

      -- Update responsible person on item
      UPDATE public.items
      SET responsible_person = v_doc.recipient_name, updated_at = now()
      WHERE id = v_item.id;
    END IF;

    -- Snapshot line and update line status
    UPDATE public.disbursement_items
    SET
      issued_qty = v_line.requested_qty,
      item_name_snapshot = v_item.item_name,
      asset_no_snapshot = v_item.asset_no,
      serial_no_snapshot = v_item.serial_no,
      brand_snapshot = v_item.brand,
      model_snapshot = v_item.model,
      unit_name_snapshot = coalesce(v_line.unit_name, '-'),
      unit_price_snapshot = coalesce(v_item.unit_price, 0),
      category_name_snapshot = v_line.category_name,
      location_name_snapshot = v_line.location_name,
      status = 'issued'
    WHERE id = v_line.id;
  END LOOP;

  v_target_status := CASE WHEN v_doc.transaction_type = 'asset_borrow' THEN 'active_borrow' ELSE 'confirmed' END;

  UPDATE public.disbursements
  SET
    document_no = v_doc_no,
    fiscal_year = v_fiscal_year,
    status = v_target_status,
    confirmed_at = now(),
    confirmed_by = v_caller_id,
    updated_at = now()
  WHERE id = p_disbursement_id;

  -- Write audit log inside the same transaction
  INSERT INTO public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
  VALUES (
    v_caller_id,
    'CONFIRM_DISBURSEMENT',
    'disbursements',
    p_disbursement_id,
    jsonb_build_object('status', 'draft'),
    jsonb_build_object('status', v_target_status, 'document_no', v_doc_no)
  );

  RETURN jsonb_build_object('ok', true, 'document_no', v_doc_no, 'status', v_target_status);
END;
$$;

-- 8. Supabase Stored Procedure: return_disbursement_item_rpc
CREATE OR REPLACE FUNCTION public.return_disbursement_item_rpc(
  p_line_id uuid,
  p_return_qty integer,
  p_condition text,
  p_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_caller_id uuid := auth.uid();
  v_line record;
  v_doc record;
  v_item record;
  v_new_returned integer;
  v_pending_count integer;
  v_new_doc_status text;
BEGIN
  v_caller_role := private.current_app_role();
  IF v_caller_role NOT IN ('admin', 'staff') OR v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: only admin and staff may record returns';
  END IF;

  IF p_return_qty <= 0 THEN
    RAISE EXCEPTION 'Return quantity must be greater than zero';
  END IF;

  IF p_condition NOT IN ('normal', 'damaged', 'lost') THEN
    RAISE EXCEPTION 'Invalid item condition: %', p_condition;
  END IF;

  -- Lock line item
  SELECT * INTO v_line
  FROM public.disbursement_items
  WHERE id = p_line_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Disbursement line item not found';
  END IF;

  -- Lock parent document
  SELECT * INTO v_doc
  FROM public.disbursements
  WHERE id = v_line.disbursement_id
  FOR UPDATE;

  IF v_doc.transaction_type != 'asset_borrow' THEN
    RAISE EXCEPTION 'Only borrowed assets can be returned';
  END IF;

  IF v_doc.status NOT IN ('active_borrow', 'partially_returned') THEN
    RAISE EXCEPTION 'Document is not active for borrowing. Status: %', v_doc.status;
  END IF;

  v_new_returned := v_line.returned_qty + p_return_qty;
  IF v_new_returned > v_line.issued_qty THEN
    RAISE EXCEPTION 'Cannot return more than issued (Issued: %, Already Returned: %, Attempted: %)',
      v_line.issued_qty, v_line.returned_qty, p_return_qty;
  END IF;

  -- Lock asset item
  SELECT * INTO v_item
  FROM public.items
  WHERE id = v_line.item_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Asset item not found or deleted';
  END IF;

  -- Record custody return event
  INSERT INTO public.asset_custody_logs (
    item_id, disbursement_item_id, action, quantity, from_responsible, to_responsible, item_condition, note, created_by
  ) VALUES (
    v_item.id, v_line.id, 'return', p_return_qty, v_doc.recipient_name, NULL, p_condition, p_note, v_caller_id
  );

  -- Return to central custody
  UPDATE public.items
  SET responsible_person = NULL, updated_at = now()
  WHERE id = v_item.id;

  -- Update line status
  UPDATE public.disbursement_items
  SET
    returned_qty = v_new_returned,
    status = CASE WHEN v_new_returned = v_line.issued_qty THEN 'returned' ELSE 'partially_returned' END
  WHERE id = v_line.id;

  -- Calculate new document status
  SELECT count(*) INTO v_pending_count
  FROM public.disbursement_items
  WHERE disbursement_id = v_doc.id AND status != 'returned';

  IF v_pending_count = 0 THEN
    v_new_doc_status := 'returned';
  ELSE
    v_new_doc_status := 'partially_returned';
  END IF;

  UPDATE public.disbursements
  SET status = v_new_doc_status, updated_at = now()
  WHERE id = v_doc.id;

  -- In-transaction audit
  INSERT INTO public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
  VALUES (
    v_caller_id,
    'RETURN_DISBURSEMENT_ITEM',
    'disbursement_items',
    p_line_id,
    jsonb_build_object('returned_qty', v_line.returned_qty),
    jsonb_build_object('returned_qty', v_new_returned, 'condition', p_condition, 'doc_status', v_new_doc_status)
  );

  RETURN jsonb_build_object('ok', true, 'line_status', CASE WHEN v_new_returned = v_line.issued_qty THEN 'returned' ELSE 'partially_returned' END, 'doc_status', v_new_doc_status);
END;
$$;

-- 9. Supabase Stored Procedure: reverse_disbursement_rpc
CREATE OR REPLACE FUNCTION public.reverse_disbursement_rpc(
  p_disbursement_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_caller_id uuid := auth.uid();
  v_doc record;
  v_line record;
  v_item record;
  v_original_custody record;
BEGIN
  v_caller_role := private.current_app_role();
  IF v_caller_role NOT IN ('admin', 'staff') OR v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: only admin and staff may reverse disbursements';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Reversal reason is required';
  END IF;

  -- Lock parent document
  SELECT * INTO v_doc
  FROM public.disbursements
  WHERE id = p_disbursement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Disbursement document not found';
  END IF;

  IF v_doc.status NOT IN ('confirmed', 'active_borrow') THEN
    RAISE EXCEPTION 'Cannot reverse document in status: %', v_doc.status;
  END IF;

  -- Reversal is strictly forbidden if any partial return has already occurred
  IF EXISTS (SELECT 1 FROM public.disbursement_items WHERE disbursement_id = p_disbursement_id AND returned_qty > 0) THEN
    RAISE EXCEPTION 'Cannot reverse document because items have already been returned. Complete the return workflow instead.';
  END IF;

  -- Process line reversals
  FOR v_line IN
    SELECT * FROM public.disbursement_items
    WHERE disbursement_id = p_disbursement_id
    FOR UPDATE
  LOOP
    SELECT * INTO v_item
    FROM public.items
    WHERE id = v_line.item_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item % is unavailable or deleted', v_line.item_id;
    END IF;

    IF v_doc.transaction_type = 'material_issue' THEN
      -- Refund stock
      UPDATE public.items
      SET quantity = quantity + v_line.issued_qty, updated_at = now()
      WHERE id = v_item.id;

      -- Record stock movement ledger
      INSERT INTO public.stock_movements (
        item_id, disbursement_item_id, delta, balance_after, movement_type, created_by
      ) VALUES (
        v_item.id, v_line.id, v_line.issued_qty, v_item.quantity + v_line.issued_qty, 'reversal', v_caller_id
      );

    ELSIF v_doc.transaction_type IN ('asset_handover', 'asset_borrow') THEN
      -- Safeguard: check custody has not changed to another recipient since this transaction
      IF v_item.responsible_person != v_doc.recipient_name THEN
        RAISE EXCEPTION 'Cannot reverse asset %: custody has changed to % since disbursement',
          v_item.item_name, coalesce(v_item.responsible_person, 'None');
      END IF;

      -- Look up original responsible person before this disbursement
      SELECT from_responsible INTO v_original_custody
      FROM public.asset_custody_logs
      WHERE disbursement_item_id = v_line.id AND action IN ('borrow', 'handover')
      ORDER BY created_at ASC
      LIMIT 1;

      -- Revert responsible person on item
      UPDATE public.items
      SET responsible_person = v_original_custody.from_responsible, updated_at = now()
      WHERE id = v_item.id;

      -- Record custody log
      INSERT INTO public.asset_custody_logs (
        item_id, disbursement_item_id, action, quantity, from_responsible, to_responsible, note, created_by
      ) VALUES (
        v_item.id, v_line.id, 'reversal', v_line.issued_qty, v_item.responsible_person, v_original_custody.from_responsible, p_reason, v_caller_id
      );
    END IF;

    UPDATE public.disbursement_items
    SET status = 'reversed'
    WHERE id = v_line.id;
  END LOOP;

  UPDATE public.disbursements
  SET
    status = 'reversed',
    reversal_reason = p_reason,
    reversed_at = now(),
    reversed_by = v_caller_id,
    updated_at = now()
  WHERE id = p_disbursement_id;

  -- In-transaction audit
  INSERT INTO public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
  VALUES (
    v_caller_id,
    'REVERSE_DISBURSEMENT',
    'disbursements',
    p_disbursement_id,
    jsonb_build_object('status', v_doc.status),
    jsonb_build_object('status', 'reversed', 'reason', p_reason)
  );

  RETURN jsonb_build_object('ok', true, 'status', 'reversed');
END;
$$;

-- Revoke all public execution and grant to authenticated
REVOKE ALL ON FUNCTION public.validate_disbursement_item_type() FROM public;
REVOKE ALL ON FUNCTION public.confirm_disbursement_rpc(uuid) FROM public;
REVOKE ALL ON FUNCTION public.return_disbursement_item_rpc(uuid, integer, text, text) FROM public;
REVOKE ALL ON FUNCTION public.reverse_disbursement_rpc(uuid, text) FROM public;

GRANT EXECUTE ON FUNCTION public.confirm_disbursement_rpc(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.return_disbursement_item_rpc(uuid, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_disbursement_rpc(uuid, text) TO authenticated;

COMMIT;
