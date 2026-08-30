BEGIN;

UPDATE storage.buckets
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
WHERE id = 'item-images';

DROP POLICY IF EXISTS "Allow public to read item images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to read images" ON storage.objects;
DROP POLICY IF EXISTS registry_item_images_read ON storage.objects;

CREATE POLICY registry_item_images_read
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'item-images'
    AND private.current_app_role() IS NOT NULL
  );

INSERT INTO public.app_migrations (migration)
VALUES ('20260830000156_private_item_images.sql')
ON CONFLICT (migration) DO NOTHING;

COMMIT;
