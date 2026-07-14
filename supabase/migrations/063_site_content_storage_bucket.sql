insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-content',
  'site-content',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can upload site content" on storage.objects;
drop policy if exists "Admins can update site content" on storage.objects;
drop policy if exists "Admins can delete site content" on storage.objects;

create policy "Admins can upload site content"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'site-content'
  and private.is_admin()
);

create policy "Admins can update site content"
on storage.objects for update
to authenticated
using (
  bucket_id = 'site-content'
  and private.is_admin()
)
with check (
  bucket_id = 'site-content'
  and private.is_admin()
);

create policy "Admins can delete site content"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'site-content'
  and private.is_admin()
);
