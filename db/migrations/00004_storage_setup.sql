-- Migration: Create Storage Bucket and Policies for Item Images
-- 00004_storage_setup.sql

-- 1. Create the 'item-images' bucket
insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true)
on conflict (id) do nothing;

-- 2. Enable RLS on storage.objects (if not already enabled)
alter table storage.objects enable row level security;

-- 3. Storage policies for item-images bucket
create policy "Allow authenticated users to read images"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'item-images');

create policy "Allow staff and admin to upload images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'item-images'
    and public.get_my_role() in ('admin', 'staff')
  );

create policy "Allow staff and admin to update images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'item-images'
    and public.get_my_role() in ('admin', 'staff')
  )
  with check (
    bucket_id = 'item-images'
    and public.get_my_role() in ('admin', 'staff')
  );

create policy "Allow admin to delete images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'item-images'
    and public.get_my_role() = 'admin'
  );
