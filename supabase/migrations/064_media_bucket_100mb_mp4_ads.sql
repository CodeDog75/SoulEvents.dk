insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  104857600,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'video/mp4']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = (
    select array(
      select distinct mime_type
      from unnest(coalesce(storage.buckets.allowed_mime_types, array[]::text[]) || excluded.allowed_mime_types) as mime_type
    )
  );

drop policy if exists "Authenticated users can upload media" on storage.objects;
drop policy if exists "Authenticated users can update media" on storage.objects;
drop policy if exists "Authenticated users can delete media" on storage.objects;

create policy "Authenticated users can upload media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'media'
);

create policy "Authenticated users can update media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'media'
)
with check (
  bucket_id = 'media'
);

create policy "Authenticated users can delete media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'media'
);

notify pgrst, 'reload schema';
