ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "is_central" boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "items_is_central_index" ON "items" ("is_central") WHERE "deleted_at" IS NULL;
UPDATE "items" SET "is_central" = true WHERE "note" ILIKE '%ส่วนกลาง%' AND "item_type" = 'asset';
