create table if not exists public.inspirator_profiles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  title text,
  short_intro text,
  profile_image_path text,
  hero_image_path text,
  about_body text,
  category text,
  contact_email text,
  website_url text,
  instagram_url text,
  facebook_url text,
  youtube_url text,
  spotify_url text,
  webshop_url text,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspirator_images (
  id uuid primary key default gen_random_uuid(),
  inspirator_id uuid not null references public.inspirator_profiles(id) on delete cascade,
  section text not null default 'mood' check (section in ('mood', 'gallery')),
  image_path text not null,
  alt_text text,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

alter table public.inspirator_profiles enable row level security;
alter table public.inspirator_images enable row level security;

drop policy if exists "Public can view active inspirators" on public.inspirator_profiles;
create policy "Public can view active inspirators"
  on public.inspirator_profiles for select
  using (is_active = true);

drop policy if exists "Admins can manage inspirators" on public.inspirator_profiles;
create policy "Admins can manage inspirators"
  on public.inspirator_profiles for all
  using (exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  ))
  with check (exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  ));

drop policy if exists "Public can view active inspirator images" on public.inspirator_images;
create policy "Public can view active inspirator images"
  on public.inspirator_images for select
  using (
    exists (
      select 1 from public.inspirator_profiles
      where inspirator_profiles.id = inspirator_images.inspirator_id
        and inspirator_profiles.is_active = true
    )
  );

drop policy if exists "Admins can manage inspirator images" on public.inspirator_images;
create policy "Admins can manage inspirator images"
  on public.inspirator_images for all
  using (exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  ))
  with check (exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  ));

create index if not exists inspirator_profiles_active_sort_idx
  on public.inspirator_profiles (is_active, sort_order, name);

create index if not exists inspirator_images_profile_section_idx
  on public.inspirator_images (inspirator_id, section, sort_order);
