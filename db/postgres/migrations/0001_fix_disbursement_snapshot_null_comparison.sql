CREATE OR REPLACE FUNCTION public.protect_disbursement_item_immutability() RETURNS trigger
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
         OR NEW.item_name_snapshot IS DISTINCT FROM OLD.item_name_snapshot
         OR NEW.asset_no_snapshot IS DISTINCT FROM OLD.asset_no_snapshot
         OR NEW.serial_no_snapshot IS DISTINCT FROM OLD.serial_no_snapshot
         OR NEW.brand_snapshot IS DISTINCT FROM OLD.brand_snapshot
         OR NEW.model_snapshot IS DISTINCT FROM OLD.model_snapshot
         OR NEW.unit_name_snapshot IS DISTINCT FROM OLD.unit_name_snapshot
         OR NEW.unit_price_snapshot IS DISTINCT FROM OLD.unit_price_snapshot
         OR NEW.category_name_snapshot IS DISTINCT FROM OLD.category_name_snapshot
         OR NEW.location_name_snapshot IS DISTINCT FROM OLD.location_name_snapshot THEN
        RAISE EXCEPTION 'Confirmed snapshot attributes on disbursement item % are immutable', OLD.id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;
