-- Migration 00017: Add custom ICU Thai collation and alter columns to use it
-- 
-- Explanation of Risks and Safeguards:
-- 1. Risks: Altering a column's collation acquires an ACCESS EXCLUSIVE lock on the table.
--    This blocks all reads and writes until the transaction completes.
-- 2. Index Rebuild Requirements: PostgreSQL will automatically rebuild the unique indexes
--    and search indexes on the altered columns (e.g., public.categories.name, public.items.item_name).
--    On very large tables, GIN index rebuilds can be slow.
-- 3. Migration Locking: For small-to-medium tables, this is extremely fast and safe.
--    In a production database with millions of items, it should be run during a maintenance window.
-- 4. Rollback Strategy: To rollback, run:
--    ALTER TABLE public.categories ALTER COLUMN name TYPE text COLLATE "default";
--    (Repeat for other tables/columns altered below).

BEGIN;

-- Create the ICU-based Thai collation if it doesn't already exist
CREATE COLLATION IF NOT EXISTS "th-TH-x-icu" (provider = icu, locale = 'th-TH');

-- Alter categories name column
ALTER TABLE public.categories ALTER COLUMN name TYPE text COLLATE "th-TH-x-icu";

-- Alter locations name column
ALTER TABLE public.locations ALTER COLUMN name TYPE text COLLATE "th-TH-x-icu";

-- Alter units name column
ALTER TABLE public.units ALTER COLUMN name TYPE text COLLATE "th-TH-x-icu";

-- Alter items item_name column
ALTER TABLE public.items ALTER COLUMN item_name TYPE text COLLATE "th-TH-x-icu";

COMMIT;
