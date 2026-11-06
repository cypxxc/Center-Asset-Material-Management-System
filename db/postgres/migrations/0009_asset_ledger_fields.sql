ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "acquired_date" date;
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "budget_source" text;
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "gfmis_number" text;
