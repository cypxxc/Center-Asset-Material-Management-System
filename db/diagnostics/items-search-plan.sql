-- Run with the application's authenticated role and representative filters on
-- staging data. EXPLAIN ANALYZE executes SELECTs; it does not modify items.
-- Replace the sample keyword in BOTH statements. Repeat with common/rare Thai
-- and English terms, including 1-2 character terms (less selective for trigrams).
-- Existing migrations 00009 and 00014 provide the six trigram indexes.
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'items'
  AND indexdef LIKE '%gin_trgm_ops%';

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, item_name, updated_at FROM public.items
WHERE deleted_at IS NULL AND (
  item_name ILIKE '%printer%' OR asset_no ILIKE '%printer%'
  OR serial_no ILIKE '%printer%' OR brand ILIKE '%printer%'
  OR model ILIKE '%printer%' OR responsible_person ILIKE '%printer%')
ORDER BY updated_at DESC, id ASC LIMIT 10;

EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*) FROM public.items
WHERE deleted_at IS NULL AND (
  item_name ILIKE '%printer%' OR asset_no ILIKE '%printer%'
  OR serial_no ILIKE '%printer%' OR brand ILIKE '%printer%'
  OR model ILIKE '%printer%' OR responsible_person ILIKE '%printer%');
