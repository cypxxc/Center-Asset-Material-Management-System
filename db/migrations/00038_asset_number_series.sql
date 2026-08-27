-- Configurable series within an asset-number template.
CREATE TABLE public.asset_number_template_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.asset_number_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  issue_mode text NOT NULL DEFAULT 'automatic' CHECK (issue_mode IN ('automatic', 'manual')),
  starting_number integer CHECK (starting_number IS NULL OR starting_number > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asset_number_template_series_unique UNIQUE (template_id, name)
);

ALTER TABLE public.asset_number_template_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY asset_number_template_series_read ON public.asset_number_template_series
  FOR SELECT TO authenticated USING (private.current_app_role() IS NOT NULL);
CREATE POLICY asset_number_template_series_admin_manage ON public.asset_number_template_series
  FOR ALL TO authenticated
  USING (private.current_app_role() = 'admin')
  WITH CHECK (private.current_app_role() = 'admin');

CREATE OR REPLACE FUNCTION public.seed_asset_number_series_sequence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.issue_mode = 'automatic' AND NEW.starting_number IS NOT NULL THEN
    INSERT INTO public.asset_number_sequences (template_id, sequence_scope, last_issued)
    VALUES (NEW.template_id, NEW.payload::text, NEW.starting_number - 1)
    ON CONFLICT (template_id, sequence_scope) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER asset_number_series_seed_sequence
  AFTER INSERT ON public.asset_number_template_series
  FOR EACH ROW EXECUTE FUNCTION public.seed_asset_number_series_sequence();

CREATE OR REPLACE FUNCTION public.create_item_with_asset_number(
  p_item jsonb,
  p_series_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
  series_row public.asset_number_template_series%ROWTYPE;
  issued jsonb;
  new_id uuid;
BEGIN
  SELECT private.current_app_role() INTO caller_role;
  IF caller_role NOT IN ('admin', 'staff') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO series_row FROM public.asset_number_template_series WHERE id = p_series_id AND is_active = true;
  IF NOT FOUND OR series_row.issue_mode <> 'automatic' THEN RAISE EXCEPTION 'Asset-number series is unavailable'; END IF;
  issued := public.issue_asset_number(series_row.template_id, series_row.payload);
  INSERT INTO public.items (
    item_name, item_type, category_id, quantity, unit_price, unit_id, asset_no, serial_no, brand, model,
    location_id, responsible_person, status, note, image_url, created_by, updated_by,
    asset_number_source, asset_number_template_id, asset_number_payload
  ) VALUES (
    p_item->>'item_name', p_item->>'item_type', NULLIF(p_item->>'category_id', '')::uuid,
    (p_item->>'quantity')::integer, NULLIF(p_item->>'unit_price', '')::numeric, NULLIF(p_item->>'unit_id', '')::uuid,
    issued->>'asset_no', NULLIF(p_item->>'serial_no', ''), NULLIF(p_item->>'brand', ''), NULLIF(p_item->>'model', ''),
    NULLIF(p_item->>'location_id', '')::uuid, NULLIF(p_item->>'responsible_person', ''), p_item->>'status',
    NULLIF(p_item->>'note', ''), NULLIF(p_item->>'image_url', ''), auth.uid(), auth.uid(),
    'automatic', series_row.template_id, series_row.payload
  ) RETURNING id INTO new_id;
  RETURN issued || jsonb_build_object('id', new_id, 'series_id', series_row.id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_item_with_asset_number(jsonb, uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_item_with_asset_number(jsonb, uuid) TO authenticated;
