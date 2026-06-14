alter table ads
add column if not exists clicks_count integer not null default 0;

create or replace function increment_ad_clicks(ad_id uuid)
returns void
language sql
security definer
as $$
  update ads
  set clicks_count = coalesce(clicks_count, 0) + 1,
      updated_at = now()
  where id = ad_id;
$$;
