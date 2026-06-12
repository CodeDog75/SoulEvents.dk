create table if not exists site_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table site_settings enable row level security;

create policy "Public can read site settings"
on site_settings for select
using (true);

create policy "Admins manage site settings"
on site_settings for all
using (public.is_admin())
with check (public.is_admin());

insert into site_settings (key, value)
values ('brand_logo_path', null)
on conflict (key) do nothing;
