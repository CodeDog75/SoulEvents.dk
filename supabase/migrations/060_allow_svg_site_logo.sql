update storage.buckets
set allowed_mime_types = allowed_mime_types || array['image/svg+xml']
where id = 'media'
  and allowed_mime_types is not null
  and not ('image/svg+xml' = any(allowed_mime_types));
