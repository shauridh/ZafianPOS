insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'item-images',
  'item-images',
  true,
  2097152,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('archives', 'archives', false, 52428800, array['application/gzip'])
on conflict (id) do nothing;

create policy "item images read"
on storage.objects for select
using (bucket_id = 'item-images');

create policy "item images insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'item-images'
  and (storage.foldername(name))[1] = public.current_outlet_id()::text
);

create policy "item images update"
on storage.objects for update to authenticated
using (
  bucket_id = 'item-images'
  and (storage.foldername(name))[1] = public.current_outlet_id()::text
);

create policy "item images delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'item-images'
  and (storage.foldername(name))[1] = public.current_outlet_id()::text
);
