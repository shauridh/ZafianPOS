insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'item-images',
  'item-images',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "public menu images"
on storage.objects for select
using (bucket_id = 'item-images');

create policy "authenticated upload menu images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'item-images'
  and (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000001'
);

create policy "authenticated update menu images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'item-images'
  and (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000001'
)
with check (
  bucket_id = 'item-images'
  and (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000001'
);

