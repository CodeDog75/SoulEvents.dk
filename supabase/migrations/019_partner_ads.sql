create extension if not exists pgcrypto;

create table if not exists ads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_path text,
  mobile_image_path text,
  alt_text text,
  sponsor_name text,
  target_url text,
  priority int not null default 100,
  display_seconds int not null default 10,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  show_on_category_pages boolean not null default true,
  show_in_newsletter boolean not null default false,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ad_main_categories (
  ad_id uuid not null references ads(id) on delete cascade,
  main_category_id uuid not null references main_categories(id) on delete cascade,
  primary key (ad_id, main_category_id)
);

create index if not exists ads_active_category_idx on ads (is_active, show_on_category_pages, priority, created_at);
create index if not exists ad_main_categories_category_idx on ad_main_categories (main_category_id);

create or replace function set_ads_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists ads_set_updated_at on ads;
create trigger ads_set_updated_at
before update on ads
for each row execute function set_ads_updated_at();
