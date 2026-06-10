alter table facilitator_profiles add column if not exists public_email text;
alter table facilitator_profiles add column if not exists public_phone text;
alter table facilitator_profiles add column if not exists youtube_url text;
alter table facilitator_profiles add column if not exists tiktok_url text;
alter table facilitator_profiles add column if not exists country text not null default 'Danmark';
alter table facilitator_profiles add column if not exists is_online_facilitator boolean not null default false;
alter table facilitator_profiles add column if not exists is_featured boolean not null default false;

create index if not exists facilitator_profiles_featured_idx on facilitator_profiles(is_featured, status);
create index if not exists facilitator_profiles_online_idx on facilitator_profiles(is_online_facilitator, status);
