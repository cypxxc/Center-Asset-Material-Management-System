-- Run inside a transaction after loading render_asset_number from migration 00037.
-- Use an isolated test database; ROLLBACK after running this file.
DO $$
BEGIN
  IF public.render_asset_number('IT-{year}-{running:4}', '{"year":"2569"}'::jsonb, 7)
      IS DISTINCT FROM 'IT-2569-0007' THEN
    RAISE EXCEPTION 'Multiple tokens and running-number padding failed';
  END IF;
  IF public.render_asset_number('{code}-{code}', '{"code":"ABC"}'::jsonb)
      IS DISTINCT FROM 'ABC-ABC' THEN
    RAISE EXCEPTION 'Repeated tokens failed';
  END IF;
  IF public.render_asset_number('PLAIN', '{}'::jsonb) IS DISTINCT FROM 'PLAIN' THEN
    RAISE EXCEPTION 'Literal-only pattern failed';
  END IF;
  BEGIN
    PERFORM public.render_asset_number('{missing}', '{}'::jsonb);
    RAISE EXCEPTION 'Expected missing-token rejection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Missing asset-number token:%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.render_asset_number('{running:2}', '{}'::jsonb, 123);
    RAISE EXCEPTION 'Expected width-overflow rejection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Asset-number token % exceeds width %' THEN RAISE; END IF;
  END;
END;
$$;
