create table if not exists public.commission_settings (
  id uuid primary key default gen_random_uuid(),
  threshold_cents int not null default 120000,
  commission_rate_bps int not null default 1000,
  minimum_commission_cents int not null default 0,
  currency text not null default 'DKK',
  effective_from timestamptz not null default now(),
  is_active boolean not null default true,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint commission_settings_threshold_check check (threshold_cents >= 0),
  constraint commission_settings_rate_check check (commission_rate_bps >= 0 and commission_rate_bps <= 10000),
  constraint commission_settings_minimum_check check (minimum_commission_cents >= 0),
  constraint commission_settings_currency_check check (char_length(currency) = 3)
);

alter table public.commission_settings
  add column if not exists threshold_cents int not null default 120000,
  add column if not exists commission_rate_bps int not null default 1000,
  add column if not exists minimum_commission_cents int not null default 0,
  add column if not exists currency text not null default 'DKK',
  add column if not exists effective_from timestamptz not null default now(),
  add column if not exists is_active boolean not null default true,
  add column if not exists reason text,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.facilitator_commission_terms (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null references public.facilitator_profiles(id) on delete cascade,
  threshold_cents int,
  commission_rate_bps int,
  minimum_commission_cents int,
  currency text,
  effective_from timestamptz not null default now(),
  is_active boolean not null default true,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint facilitator_commission_terms_threshold_check check (threshold_cents is null or threshold_cents >= 0),
  constraint facilitator_commission_terms_rate_check check (commission_rate_bps is null or (commission_rate_bps >= 0 and commission_rate_bps <= 10000)),
  constraint facilitator_commission_terms_minimum_check check (minimum_commission_cents is null or minimum_commission_cents >= 0),
  constraint facilitator_commission_terms_currency_check check (currency is null or char_length(currency) = 3)
);

alter table public.facilitator_commission_terms
  add column if not exists facilitator_id uuid references public.facilitator_profiles(id) on delete cascade,
  add column if not exists threshold_cents int,
  add column if not exists commission_rate_bps int,
  add column if not exists minimum_commission_cents int,
  add column if not exists currency text,
  add column if not exists effective_from timestamptz not null default now(),
  add column if not exists is_active boolean not null default true,
  add column if not exists reason text,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists facilitator_commission_terms_one_active_idx
  on public.facilitator_commission_terms(facilitator_id)
  where is_active;

create index if not exists commission_settings_active_effective_idx
  on public.commission_settings(is_active, effective_from desc);

create index if not exists facilitator_commission_terms_effective_idx
  on public.facilitator_commission_terms(facilitator_id, is_active, effective_from desc);

insert into public.commission_settings (threshold_cents, commission_rate_bps, minimum_commission_cents, currency, reason)
select 120000, 1000, 0, 'DKK', 'Initial standard commission settings.'
where not exists (select 1 from public.commission_settings);

alter table public.bookings
  add column if not exists commission_threshold_cents int,
  add column if not exists commission_source text not null default 'legacy',
  add column if not exists commission_currency text not null default 'DKK',
  add column if not exists commission_calculated_at timestamptz,
  add column if not exists commission_terms_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists reporting_month date,
  add column if not exists reporting_month_locked_at timestamptz;

alter table public.bookings
  drop constraint if exists bookings_commission_threshold_check,
  add constraint bookings_commission_threshold_check check (commission_threshold_cents is null or commission_threshold_cents >= 0);

alter table public.bookings
  drop constraint if exists bookings_commission_source_check,
  add constraint bookings_commission_source_check check (commission_source in ('standard', 'individual', 'legacy'));

alter table public.bookings
  drop constraint if exists bookings_commission_currency_check,
  add constraint bookings_commission_currency_check check (char_length(commission_currency) = 3);

update public.bookings b
set
  commission_calculated_at = coalesce(b.commission_calculated_at, b.created_at),
  reporting_month = coalesce(
    b.reporting_month,
    date_trunc('month', coalesce(e.ends_at, b.event_starts_at_snapshot))::date
  ),
  reporting_month_locked_at = coalesce(b.reporting_month_locked_at, now())
from public.events e
where b.event_id = e.id
  and (b.reporting_month is null or b.commission_calculated_at is null or b.reporting_month_locked_at is null);

update public.bookings
set
  commission_calculated_at = coalesce(commission_calculated_at, created_at),
  reporting_month = coalesce(reporting_month, date_trunc('month', event_starts_at_snapshot)::date),
  reporting_month_locked_at = coalesce(reporting_month_locked_at, now())
where reporting_month is null or commission_calculated_at is null or reporting_month_locked_at is null;

alter table public.bookings
  alter column reporting_month set not null,
  alter column commission_calculated_at set not null;

create index if not exists bookings_reporting_month_facilitator_idx
  on public.bookings(reporting_month, facilitator_id, status);

create index if not exists bookings_commission_source_idx
  on public.bookings(commission_source);

drop view if exists public.admin_booking_overview;
create view public.admin_booking_overview as
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
  b.commission_rate_bps,
  b.commission_threshold_cents,
  b.commission_source,
  b.commission_currency,
  b.commission_calculated_at,
  b.reporting_month,
  b.event_id,
  b.facilitator_id
from public.bookings b;

create or replace view public.monthly_revenue as
select
  reporting_month as month_start,
  (reporting_month + interval '1 month - 1 day')::date as month_end,
  facilitator_id,
  count(*)::int as total_bookings,
  coalesce(sum(seats), 0)::int as total_seats,
  coalesce(sum(booking_value_cents), 0)::int as booking_value_cents,
  coalesce(sum(commission_cents), 0)::int as commission_cents
from public.bookings
where status in ('confirmed', 'completed', 'invoiced', 'paid')
group by reporting_month, facilitator_id;

alter table public.commission_settings enable row level security;
alter table public.facilitator_commission_terms enable row level security;

drop policy if exists "Admins can read commission settings" on public.commission_settings;
create policy "Admins can read commission settings"
on public.commission_settings for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can insert commission settings" on public.commission_settings;
create policy "Admins can insert commission settings"
on public.commission_settings for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can read facilitator commission terms" on public.facilitator_commission_terms;
create policy "Admins can read facilitator commission terms"
on public.facilitator_commission_terms for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can insert facilitator commission terms" on public.facilitator_commission_terms;
create policy "Admins can insert facilitator commission terms"
on public.facilitator_commission_terms for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can update facilitator commission terms" on public.facilitator_commission_terms;
create policy "Admins can update facilitator commission terms"
on public.facilitator_commission_terms for update
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

comment on table public.commission_settings is 'Versioned central SoulEvents commission and ticket threshold settings.';
comment on table public.facilitator_commission_terms is 'Facilitator-specific commission overrides. One active override per facilitator.';
comment on column public.bookings.reporting_month is 'Authoritative reporting month based on the event end date at booking creation/backfill time.';
