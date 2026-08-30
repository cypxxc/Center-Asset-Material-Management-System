-- Asset numbers are user-confirmed static values. Remove automatic sequences.
DROP FUNCTION IF EXISTS public.create_item_with_asset_number(jsonb, uuid);
DROP FUNCTION IF EXISTS public.create_item_with_asset_number(jsonb, uuid, jsonb);
DROP FUNCTION IF EXISTS public.issue_asset_number(uuid, jsonb);
DROP FUNCTION IF EXISTS public.render_asset_number(text, jsonb, integer);
DROP TABLE IF EXISTS public.asset_number_template_series;
DROP FUNCTION IF EXISTS public.seed_asset_number_series_sequence();
DROP TABLE IF EXISTS public.asset_number_sequences;
