insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  104857600,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = greatest(coalesce(storage.buckets.file_size_limit, 0), excluded.file_size_limit),
  allowed_mime_types = (
    select array(
      select distinct mime_type
      from unnest(coalesce(storage.buckets.allowed_mime_types, array[]::text[]) || excluded.allowed_mime_types) as mime_type
    )
  );

drop policy if exists "Facilitators can upload own draft event media" on storage.objects;
drop policy if exists "Facilitators can update own draft event media" on storage.objects;
drop policy if exists "Facilitators can delete own draft event media" on storage.objects;

create policy "Facilitators can upload own draft event media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'media'
  and split_part(name, '/', 1) = 'events'
  and split_part(name, '/', 2) = 'drafts'
  and exists (
    select 1
    from public.facilitator_profiles
    where facilitator_profiles.id::text = split_part(name, '/', 3)
      and facilitator_profiles.profile_id = auth.uid()
  )
);

create policy "Facilitators can update own draft event media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'media'
  and split_part(name, '/', 1) = 'events'
  and split_part(name, '/', 2) = 'drafts'
  and exists (
    select 1
    from public.facilitator_profiles
    where facilitator_profiles.id::text = split_part(name, '/', 3)
      and facilitator_profiles.profile_id = auth.uid()
  )
)
with check (
  bucket_id = 'media'
  and split_part(name, '/', 1) = 'events'
  and split_part(name, '/', 2) = 'drafts'
  and exists (
    select 1
    from public.facilitator_profiles
    where facilitator_profiles.id::text = split_part(name, '/', 3)
      and facilitator_profiles.profile_id = auth.uid()
  )
);

create policy "Facilitators can delete own draft event media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'media'
  and split_part(name, '/', 1) = 'events'
  and split_part(name, '/', 2) = 'drafts'
  and exists (
    select 1
    from public.facilitator_profiles
    where facilitator_profiles.id::text = split_part(name, '/', 3)
      and facilitator_profiles.profile_id = auth.uid()
  )
);

notify pgrst, 'reload schema';
