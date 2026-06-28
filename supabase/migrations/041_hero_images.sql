create table if not exists hero_images (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('homepage', 'main_category')),
  main_category_id uuid references main_categories(id) on delete cascade,
  image_path text not null,
  alt_text text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hero_images_scope_category_check check (
    (scope = 'homepage' and main_category_id is null)
    or
    (scope = 'main_category' and main_category_id is not null)
  )
);

drop trigger if exists hero_images_set_updated_at on hero_images;
create trigger hero_images_set_updated_at
before update on hero_images
for each row execute function set_updated_at();

create index if not exists hero_images_homepage_active_idx
on hero_images (is_active, sort_order)
where scope = 'homepage';

create index if not exists hero_images_main_category_active_idx
on hero_images (main_category_id, is_active, sort_order)
where scope = 'main_category';

alter table hero_images enable row level security;

drop policy if exists "Public can read active hero images" on hero_images;
create policy "Public can read active hero images"
on hero_images for select
using (is_active = true or private.is_admin());

drop policy if exists "Admins manage hero images" on hero_images;
create policy "Admins manage hero images"
on hero_images for all
using (private.is_admin())
with check (private.is_admin());
