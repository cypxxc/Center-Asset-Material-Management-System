-- Migration: Grant Public Select Policy for Item Images Storage Bucket
-- 00032_public_storage_read_policy.sql

drop policy if exists "Allow authenticated users to read images" on storage.objects;
drop policy if exists "Allow public to read item images" on storage.objects;

create policy "Allow public to read item images"
  on storage.objects for select
  to public
  using (bucket_id = 'item-images');
