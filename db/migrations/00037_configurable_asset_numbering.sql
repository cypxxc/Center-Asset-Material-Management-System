-- Configurable asset-number templates. Apply after 00035_permanent_item_deletion.sql.

CREATE TABLE public.asset_number_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pattern text NOT NULL,
  field_defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asset_number_templates_name_unique UNIQUE (name),
  CONSTRAINT asset_number_templates_pattern_length CHECK (char_length(pattern) BETWEEN 1 AND 150)
);

CREATE TABLE public.asset_number_sequences (
  template_id uuid NOT NULL REFERENCES public.asset_number_templates(id) ON DELETE RESTRICT,
  sequence_scope text NOT NULL,
  last_issued integer NOT NULL DEFAULT 0 CHECK (last_issued >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (template_id, sequence_scope)
);

ALTER TABLE public.asset_number_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_number_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY asset_number_templates_read ON public.asset_number_templates
  FOR SELECT TO authenticated USING (private.current_app_role() IS NOT NULL);
CREATE POLICY asset_number_templates_admin_manage ON public.asset_number_templates
  FOR ALL TO authenticated
  USING (private.current_app_role() = 'admin')
  WITH CHECK (private.current_app_role() = 'admin');

-- No direct policy is granted for the sequence table. It is only changed by the RPC below.

ALTER TABLE public.items
  ADD COLUMN asset_number_source text,
  ADD COLUMN asset_number_template_id uuid REFERENCES public.asset_number_templates(id) ON DELETE SET NULL,
  ADD COLUMN asset_number_payload jsonb;

ALTER TABLE public.items
  ADD CONSTRAINT items_asset_number_source_check
  CHECK (asset_number_source IS NULL OR asset_number_source IN ('manual', 'template', 'automatic', 'import', 'legacy'));

UPDATE public.items
SET asset_number_source = 'legacy'
WHERE asset_no IS NOT NULL AND asset_number_source IS NULL;

-- Existing CSV RPCs do not need a breaking signature change: imports that omit
-- this column are marked as import, while the item actions set their explicit source.
ALTER TABLE public.items
  ALTER COLUMN asset_number_source SET DEFAULT 'import';

DROP INDEX IF EXISTS public.unique_asset_no_not_deleted;
CREATE UNIQUE INDEX unique_asset_no_active
  ON public.items(asset_no)
  WHERE asset_no IS NOT NULL;

CREATE OR REPLACE FUNCTION public.render_asset_number(
  p_pattern text,
  p_payload jsonb,
  p_running integer DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  result text := p_pattern;
  token_match text[];
  token_key text;
  token_width integer;
  token_value text;
BEGIN
  IF p_pattern IS NULL OR btrim(p_pattern) = '' THEN
    RAISE EXCEPTION 'Asset-number pattern is required';
  END IF;

  FOR token_match IN SELECT regexp_matches(result, '\{([a-z][a-z0-9_]*)(?::([1-9][0-9]?))?\}', 'g')
  LOOP
    token_key := token_match[1];
    token_width := NULLIF(token_match[2], '')::integer;
    token_value := CASE WHEN token_key = 'running' THEN p_running::text ELSE p_payload ->> token_key END;
    IF token_value IS NULL THEN
      RAISE EXCEPTION 'Missing asset-number token: %', token_key;
    END IF;
    IF token_width IS NOT NULL THEN
      IF char_length(token_value) > token_width THEN
        RAISE EXCEPTION 'Asset-number token % exceeds width %', token_key, token_width;
      END IF;
      token_value := lpad(token_value, token_width, '0');
    END IF;
    result := replace(
      result,
      '{' || token_key || CASE WHEN token_width IS NULL THEN '' ELSE ':' || token_width::text END || '}',
      token_value
    );
  END LOOP;

  IF result ~ '\{[^}]+\}' THEN
    RAISE EXCEPTION 'Unknown or missing asset-number token';
  END IF;
  IF char_length(result) > 150 THEN
    RAISE EXCEPTION 'Asset number exceeds 150 characters';
  END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_asset_number(
  p_template_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
  template_row public.asset_number_templates%ROWTYPE;
  scope_value text;
  next_running integer;
  rendered text;
BEGIN
  SELECT private.current_app_role() INTO caller_role;
  IF caller_role NOT IN ('admin', 'staff') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO template_row
  FROM public.asset_number_templates
  WHERE id = p_template_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Asset-number template is unavailable';
  END IF;

  scope_value := COALESCE(p_payload, '{}'::jsonb)::text;
  INSERT INTO public.asset_number_sequences (template_id, sequence_scope, last_issued)
  VALUES (p_template_id, scope_value, 1)
  ON CONFLICT (template_id, sequence_scope)
  DO UPDATE SET last_issued = public.asset_number_sequences.last_issued + 1, updated_at = now()
  RETURNING last_issued INTO next_running;

  rendered := public.render_asset_number(
    template_row.pattern,
    COALESCE(template_row.field_defaults, '{}'::jsonb) || COALESCE(p_payload, '{}'::jsonb),
    next_running
  );

  RETURN jsonb_build_object(
    'asset_no', rendered,
    'running', next_running,
    'template_id', p_template_id,
    'payload', COALESCE(p_payload, '{}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_asset_number(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.render_asset_number(text, jsonb, integer) TO authenticated;

-- This keeps reserving a running number and creating the item in the same transaction.
CREATE OR REPLACE FUNCTION public.create_item_with_asset_number(
  p_item jsonb,
  p_template_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
  issued jsonb;
  new_id uuid;
BEGIN
  SELECT private.current_app_role() INTO caller_role;
  IF caller_role NOT IN ('admin', 'staff') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  issued := public.issue_asset_number(p_template_id, p_payload);

  INSERT INTO public.items (
    item_name, item_type, category_id, quantity, unit_price, unit_id,
    asset_no, serial_no, brand, model, location_id, responsible_person,
    status, note, image_url, created_by, updated_by,
    asset_number_source, asset_number_template_id, asset_number_payload
  ) VALUES (
    p_item->>'item_name', p_item->>'item_type',
    NULLIF(p_item->>'category_id', '')::uuid, (p_item->>'quantity')::integer,
    NULLIF(p_item->>'unit_price', '')::numeric, NULLIF(p_item->>'unit_id', '')::uuid,
    issued->>'asset_no', NULLIF(p_item->>'serial_no', ''), NULLIF(p_item->>'brand', ''),
    NULLIF(p_item->>'model', ''), NULLIF(p_item->>'location_id', '')::uuid,
    NULLIF(p_item->>'responsible_person', ''), p_item->>'status',
    NULLIF(p_item->>'note', ''), NULLIF(p_item->>'image_url', ''), auth.uid(), auth.uid(),
    'automatic', p_template_id, issued->'payload'
  ) RETURNING id INTO new_id;

  RETURN issued || jsonb_build_object('id', new_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_item_with_asset_number(jsonb, uuid, jsonb) TO authenticated;
