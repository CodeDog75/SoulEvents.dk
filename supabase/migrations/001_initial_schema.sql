create extension if not exists "pgcrypto";

create type app_role as enum ('admin', 'facilitator');
create type facilitator_status as enum ('pending', 'approved', 'disabled');
create type event_status as enum ('draft', 'active', 'sold_out', 'cancelled', 'completed');
create type booking_status as enum ('pending', 'confirmed', 'sold_out', 'cancelled', 'completed', 'invoiced', 'paid');
create type invoice_status as enum ('draft', 'approved', 'sent', 'paid', 'cancelled');
create type email_status as enum ('queued', 'sent', 'failed');

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role app_role not null default 'facilitator',
  full_name text not null,
  email text not null unique,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table regions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  color_hex text not null default '#87A878',
  icon_name text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_color_hex_check check (color_hex ~ '^#[0-9A-Fa-f]{6}$')
);

create table facilitator_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references profiles(id) on delete cascade,
  status facilitator_status not null default 'pending',
  company_name text,
  profile_image_path text,
  short_description text not null default '',
  long_description text not null default '',
  website_url text,
  facebook_url text,
  instagram_url text,
  address_line text,
  postal_code text,
  city text,
  region_id uuid references regions(id) on delete set null,
  latitude numeric(9,6),
  longitude numeric(9,6),
  accepted_terms_at timestamptz,
  accepted_privacy_at timestamptz,
  accepted_guidelines_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint facilitator_latitude_check check (latitude is null or latitude between -90 and 90),
  constraint facilitator_longitude_check check (longitude is null or longitude between -180 and 180)
);

create table facilitator_images (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null references facilitator_profiles(id) on delete cascade,
  image_path text not null,
  alt_text text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table facilitator_categories (
  facilitator_id uuid not null references facilitator_profiles(id) on delete cascade,
  category_id uuid not null references categories(id) on delete restrict,
  primary key (facilitator_id, category_id)
);

create table events (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null references facilitator_profiles(id) on delete cascade,
  status event_status not null default 'draft',
  title text not null,
  slug text not null,
  short_description text not null default '',
  long_description text not null default '',
  cover_image_path text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  address_line text,
  postal_code text,
  city text,
  region_id uuid references regions(id) on delete set null,
  latitude numeric(9,6),
  longitude numeric(9,6),
  price_cents int not null default 0,
  capacity int not null,
  contact_email text,
  contact_phone text,
  facebook_url text,
  instagram_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_slug_unique_per_facilitator unique (facilitator_id, slug),
  constraint events_time_check check (ends_at > starts_at),
  constraint events_price_check check (price_cents >= 0),
  constraint events_capacity_check check (capacity > 0),
  constraint events_latitude_check check (latitude is null or latitude between -90 and 90),
  constraint events_longitude_check check (longitude is null or longitude between -180 and 180)
);

create table event_images (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  image_path text not null,
  alt_text text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table event_categories (
  event_id uuid not null references events(id) on delete cascade,
  category_id uuid not null references categories(id) on delete restrict,
  primary key (event_id, category_id)
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete restrict,
  facilitator_id uuid not null references facilitator_profiles(id) on delete restrict,
  status booking_status not null default 'pending',
  participant_name text not null,
  participant_email text not null,
  participant_phone text,
  seats int not null,
  message text,
  event_title_snapshot text not null,
  event_starts_at_snapshot timestamptz not null,
  facilitator_name_snapshot text not null,
  primary_category_snapshot text,
  price_per_seat_cents int not null,
  commission_rate_bps int not null default 1200,
  booking_value_cents int generated always as (price_per_seat_cents * seats) stored,
  commission_cents int generated always as (
    case
      when price_per_seat_cents > 0 then round((price_per_seat_cents * seats) * commission_rate_bps / 10000.0)::int
      else 0
    end
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_seats_check check (seats > 0),
  constraint bookings_price_check check (price_per_seat_cents >= 0),
  constraint bookings_commission_rate_check check (commission_rate_bps >= 0)
);

create table newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  status text not null default 'active',
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint newsletter_status_check check (status in ('active', 'unsubscribed'))
);

create table newsletter_subscriber_regions (
  subscriber_id uuid not null references newsletter_subscribers(id) on delete cascade,
  region_id uuid not null references regions(id) on delete cascade,
  primary key (subscriber_id, region_id)
);

create table newsletter_subscriber_categories (
  subscriber_id uuid not null references newsletter_subscribers(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  primary key (subscriber_id, category_id)
);

create table email_logs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  recipient_email text not null,
  subject text not null,
  status email_status not null default 'queued',
  resend_message_id text,
  booking_id uuid references bookings(id) on delete set null,
  event_id uuid references events(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table monthly_reports (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null references facilitator_profiles(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  total_bookings int not null default 0,
  total_seats int not null default 0,
  booking_value_cents int not null default 0,
  commission_cents int not null default 0,
  created_at timestamptz not null default now(),
  constraint monthly_reports_period_check check (period_end >= period_start),
  constraint monthly_reports_unique_period unique (facilitator_id, period_start, period_end)
);

create table invoice_drafts (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null references facilitator_profiles(id) on delete restrict,
  monthly_report_id uuid references monthly_reports(id) on delete set null,
  status invoice_status not null default 'draft',
  period_start date not null,
  period_end date not null,
  total_commission_cents int not null default 0,
  payment_due_date date,
  bank_details text,
  payment_reference text,
  approved_by uuid references profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_drafts_period_check check (period_end >= period_start),
  constraint invoice_drafts_total_check check (total_commission_cents >= 0)
);

create table invoice_draft_lines (
  invoice_draft_id uuid not null references invoice_drafts(id) on delete cascade,
  booking_id uuid not null references bookings(id) on delete restrict,
  commission_cents int not null,
  primary key (invoice_draft_id, booking_id),
  constraint invoice_draft_lines_commission_check check (commission_cents >= 0)
);

create table content_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  body text not null default '',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on profiles
for each row execute function set_updated_at();

create trigger categories_set_updated_at
before update on categories
for each row execute function set_updated_at();

create trigger facilitator_profiles_set_updated_at
before update on facilitator_profiles
for each row execute function set_updated_at();

create trigger events_set_updated_at
before update on events
for each row execute function set_updated_at();

create trigger bookings_set_updated_at
before update on bookings
for each row execute function set_updated_at();

create trigger newsletter_subscribers_set_updated_at
before update on newsletter_subscribers
for each row execute function set_updated_at();

create trigger invoice_drafts_set_updated_at
before update on invoice_drafts
for each row execute function set_updated_at();

create trigger content_pages_set_updated_at
before update on content_pages
for each row execute function set_updated_at();

create index profiles_role_idx on profiles(role);
create index facilitator_profiles_status_region_idx on facilitator_profiles(status, region_id);
create index events_status_starts_at_idx on events(status, starts_at);
create index events_region_starts_at_idx on events(region_id, starts_at);
create index events_facilitator_starts_at_idx on events(facilitator_id, starts_at);
create index events_coordinates_idx on events(latitude, longitude);
create index bookings_event_status_idx on bookings(event_id, status);
create index bookings_facilitator_created_at_idx on bookings(facilitator_id, created_at);
create index bookings_status_created_at_idx on bookings(status, created_at);
create index event_categories_category_event_idx on event_categories(category_id, event_id);
create index facilitator_categories_category_facilitator_idx on facilitator_categories(category_id, facilitator_id);
create index newsletter_subscribers_email_idx on newsletter_subscribers(email);

create view event_capacity_view as
select
  e.id as event_id,
  e.capacity,
  coalesce(sum(b.seats) filter (where b.status in ('pending', 'confirmed')), 0)::int as reserved_seats,
  (e.capacity - coalesce(sum(b.seats) filter (where b.status in ('pending', 'confirmed')), 0))::int as available_seats
from events e
left join bookings b on b.event_id = e.id
group by e.id, e.capacity;

create view admin_booking_overview as
select
  b.id as booking_id,
  b.status as booking_status,
  b.created_at as booking_created_at,
  b.participant_name,
  b.participant_email,
  b.seats,
  b.event_title_snapshot,
  b.event_starts_at_snapshot,
  b.facilitator_name_snapshot,
  b.primary_category_snapshot,
  b.price_per_seat_cents,
  b.booking_value_cents,
  b.commission_cents,
  e.id as event_id,
  fp.id as facilitator_id
from bookings b
join events e on e.id = b.event_id
join facilitator_profiles fp on fp.id = b.facilitator_id;

create view facilitator_monthly_totals as
select
  facilitator_id,
  date_trunc('month', created_at)::date as month_start,
  (date_trunc('month', created_at) + interval '1 month - 1 day')::date as month_end,
  count(*)::int as total_bookings,
  coalesce(sum(seats), 0)::int as total_seats,
  coalesce(sum(booking_value_cents), 0)::int as booking_value_cents,
  coalesce(sum(commission_cents), 0)::int as commission_cents
from bookings
where status in ('confirmed', 'completed', 'invoiced', 'paid')
group by facilitator_id, date_trunc('month', created_at);

alter table profiles enable row level security;
alter table regions enable row level security;
alter table categories enable row level security;
alter table facilitator_profiles enable row level security;
alter table facilitator_images enable row level security;
alter table facilitator_categories enable row level security;
alter table events enable row level security;
alter table event_images enable row level security;
alter table event_categories enable row level security;
alter table bookings enable row level security;
alter table newsletter_subscribers enable row level security;
alter table newsletter_subscriber_regions enable row level security;
alter table newsletter_subscriber_categories enable row level security;
alter table email_logs enable row level security;
alter table monthly_reports enable row level security;
alter table invoice_drafts enable row level security;
alter table invoice_draft_lines enable row level security;
alter table content_pages enable row level security;

insert into regions (name, slug, sort_order) values
  ('Hele Danmark', 'hele-danmark', 10),
  ('Storkøbenhavn', 'storkobenhavn', 20),
  ('Nordsjælland', 'nordsjaelland', 30),
  ('Midtsjælland', 'midtsjaelland', 40),
  ('Sydsjælland', 'sydsjaelland', 50),
  ('Vestsjælland', 'vestsjaelland', 60),
  ('Fyn', 'fyn', 70),
  ('Bornholm', 'bornholm', 80),
  ('Sønderjylland', 'sonderjylland', 90),
  ('Midtjylland', 'midtjylland', 100),
  ('Nordjylland', 'nordjylland', 110);

insert into categories (name, slug, color_hex, icon_name, sort_order) values
  ('Yoga', 'yoga', '#87A878', 'leaf', 10),
  ('Meditation', 'meditation', '#6B7F9E', 'sparkles', 20),
  ('Ceremoni', 'ceremoni', '#B9795B', 'flame', 30),
  ('Shamanisme', 'shamanisme', '#7E6B5A', 'drum', 40),
  ('Saunagus', 'saunagus', '#C47A4B', 'waves', 50),
  ('Lydbad', 'lydbad', '#7A8FA6', 'music', 60),
  ('Coaching', 'coaching', '#A58D68', 'messages-square', 70),
  ('Retreat', 'retreat', '#9A7AA0', 'mountain', 80),
  ('Musik & Dans', 'musik-dans', '#C46676', 'music-2', 90),
  ('Foredrag', 'foredrag', '#5A6E8C', 'mic', 100),
  ('Undervisning', 'undervisning', '#A6A15E', 'book-open', 110),
  ('Healing', 'healing', '#79A99A', 'heart', 120),
  ('Breathwork', 'breathwork', '#75A8B8', 'wind', 130),
  ('Mindfulness', 'mindfulness', '#8C9B72', 'circle', 140),
  ('Kropsarbejde', 'kropsarbejde', '#B08A6C', 'user-round', 150),
  ('Naturforløb', 'naturforlob', '#6F9B70', 'tree-pine', 160),
  ('Spirituel Udvikling', 'spirituel-udvikling', '#8A7BB6', 'stars', 170);
