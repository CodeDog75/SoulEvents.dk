alter table public.commission_settings
  add column if not exists tier_one_limit_cents int not null default 120000,
  add column if not exists tier_two_rate_bps int not null default 1000;

alter table public.facilitator_commission_terms
  add column if not exists tier_one_limit_cents int,
  add column if not exists tier_two_rate_bps int;

update public.commission_settings
set
  tier_one_limit_cents = coalesce(nullif(tier_one_limit_cents, 0), threshold_cents),
  tier_two_rate_bps = coalesce(tier_two_rate_bps, commission_rate_bps);

with soulevents_progressive_source as (
  select
    id,
    threshold_cents,
    commission_rate_bps,
    minimum_commission_cents,
    currency,
    created_by,
    reason,
    row_number() over (order by effective_from desc, created_at desc) as recency_rank,
    count(*) over () as active_count
  from public.commission_settings
  where is_active
    and (
      (threshold_cents = 80000 and commission_rate_bps = 500)
      or (threshold_cents = 120000 and commission_rate_bps = 1000)
    )
),
lower_tier as (
  select *
  from soulevents_progressive_source
  where threshold_cents = 80000 and commission_rate_bps = 500
  order by effective_from desc, created_at desc
  limit 1
),
upper_tier as (
  select *
  from soulevents_progressive_source
  where threshold_cents = 120000 and commission_rate_bps = 1000
  order by effective_from desc, created_at desc
  limit 1
),
latest_active as (
  select *
  from soulevents_progressive_source
  where recency_rank = 1
)
insert into public.commission_settings (
  threshold_cents,
  commission_rate_bps,
  tier_one_limit_cents,
  tier_two_rate_bps,
  minimum_commission_cents,
  currency,
  effective_from,
  is_active,
  reason,
  created_by
)
select
  lower_tier.threshold_cents,
  lower_tier.commission_rate_bps,
  upper_tier.threshold_cents,
  upper_tier.commission_rate_bps,
  coalesce(latest_active.minimum_commission_cents, 0),
  coalesce(latest_active.currency, 'DKK'),
  now(),
  true,
  'Migrated from two simple active commission settings into one progressive event settlement plan.',
  latest_active.created_by
from lower_tier, upper_tier, latest_active
where lower_tier.id <> upper_tier.id
  and latest_active.active_count >= 2;

update public.commission_settings
set is_active = false
where is_active
  and id not in (
    select id
    from public.commission_settings
    where is_active
    order by effective_from desc, created_at desc
    limit 1
)
and exists (
  select 1
  from public.commission_settings active_settings
  where active_settings.is_active
);

alter table public.commission_settings
  drop constraint if exists commission_settings_tier_one_limit_check,
  add constraint commission_settings_tier_one_limit_check check (tier_one_limit_cents >= threshold_cents);

alter table public.commission_settings
  drop constraint if exists commission_settings_tier_two_rate_check,
  add constraint commission_settings_tier_two_rate_check check (tier_two_rate_bps >= 0 and tier_two_rate_bps <= 10000);

update public.facilitator_commission_terms
set
  tier_one_limit_cents = coalesce(tier_one_limit_cents, threshold_cents),
  tier_two_rate_bps = coalesce(tier_two_rate_bps, commission_rate_bps);

alter table public.facilitator_commission_terms
  drop constraint if exists facilitator_commission_terms_tier_one_limit_check,
  add constraint facilitator_commission_terms_tier_one_limit_check check (
    tier_one_limit_cents is null
    or threshold_cents is null
    or tier_one_limit_cents >= threshold_cents
  );

alter table public.facilitator_commission_terms
  drop constraint if exists facilitator_commission_terms_tier_two_rate_check,
  add constraint facilitator_commission_terms_tier_two_rate_check check (
    tier_two_rate_bps is null
    or (tier_two_rate_bps >= 0 and tier_two_rate_bps <= 10000)
  );

create table if not exists public.event_financial_records (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete restrict,
  primary_facilitator_id uuid not null references public.facilitator_profiles(id) on delete restrict,
  event_ends_at timestamptz not null,
  status text not null default 'ready_for_review',
  classification text not null,
  currency text not null default 'DKK',
  included_booking_count int not null default 0,
  excluded_booking_count int not null default 0,
  included_seats int not null default 0,
  gross_revenue_cents int not null default 0,
  commission_plan_id uuid references public.commission_settings(id) on delete set null,
  free_threshold_cents int not null default 0,
  tier_one_limit_cents int not null default 120000,
  tier_one_rate_bps int not null default 300,
  tier_two_rate_bps int not null default 1000,
  free_revenue_cents int not null default 0,
  tier_one_revenue_cents int not null default 0,
  tier_two_revenue_cents int not null default 0,
  calculated_commission_cents int not null default 0,
  manual_adjustment_cents int not null default 0,
  final_commission_cents int not null default 0,
  payment_provider text,
  payment_transaction_id text,
  paid_amount_cents int,
  payment_fee_cents int,
  refunded_amount_cents int,
  payout_amount_cents int,
  net_settlement_cents int,
  internal_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  invoiced_at timestamptz,
  settled_at timestamptz,
  archived_at timestamptz,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_financial_records_status_check check (
    status in ('no_revenue', 'below_threshold', 'ready_for_review', 'selected_for_invoice', 'invoiced', 'settled', 'waived')
  ),
  constraint event_financial_records_classification_check check (
    classification in ('no_revenue', 'below_threshold', 'ready_for_review')
  ),
  constraint event_financial_records_currency_check check (char_length(currency) = 3),
  constraint event_financial_records_counts_check check (
    included_booking_count >= 0 and excluded_booking_count >= 0 and included_seats >= 0
  ),
  constraint event_financial_records_amounts_check check (
    gross_revenue_cents >= 0
    and free_threshold_cents >= 0
    and tier_one_limit_cents >= free_threshold_cents
    and free_revenue_cents >= 0
    and tier_one_revenue_cents >= 0
    and tier_two_revenue_cents >= 0
    and calculated_commission_cents >= 0
    and final_commission_cents >= 0
  ),
  constraint event_financial_records_rates_check check (
    tier_one_rate_bps >= 0 and tier_one_rate_bps <= 10000 and tier_two_rate_bps >= 0 and tier_two_rate_bps <= 10000
  ),
  constraint event_financial_records_payment_amounts_check check (
    (paid_amount_cents is null or paid_amount_cents >= 0)
    and (payment_fee_cents is null or payment_fee_cents >= 0)
    and (refunded_amount_cents is null or refunded_amount_cents >= 0)
    and (payout_amount_cents is null or payout_amount_cents >= 0)
  )
);

alter table public.event_financial_records
  add column if not exists payment_provider text,
  add column if not exists payment_transaction_id text,
  add column if not exists paid_amount_cents int,
  add column if not exists payment_fee_cents int,
  add column if not exists refunded_amount_cents int,
  add column if not exists payout_amount_cents int,
  add column if not exists net_settlement_cents int;

alter table public.event_financial_records
  drop constraint if exists event_financial_records_payment_amounts_check,
  add constraint event_financial_records_payment_amounts_check check (
    (paid_amount_cents is null or paid_amount_cents >= 0)
    and (payment_fee_cents is null or payment_fee_cents >= 0)
    and (refunded_amount_cents is null or refunded_amount_cents >= 0)
    and (payout_amount_cents is null or payout_amount_cents >= 0)
  );

create table if not exists public.event_financial_record_booking_lines (
  financial_record_id uuid not null references public.event_financial_records(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  booking_status_snapshot text not null,
  seats_snapshot int not null,
  price_per_seat_cents_snapshot int not null,
  booking_value_cents_snapshot int not null,
  included_in_financial_record boolean not null default true,
  exclusion_reason text,
  created_at timestamptz not null default now(),
  primary key (financial_record_id, booking_id),
  constraint event_financial_record_booking_lines_amounts_check check (
    seats_snapshot > 0 and price_per_seat_cents_snapshot >= 0 and booking_value_cents_snapshot >= 0
  )
);

create table if not exists public.event_financial_adjustments (
  id uuid primary key default gen_random_uuid(),
  financial_record_id uuid not null references public.event_financial_records(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete restrict,
  amount_cents int not null,
  reason text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

drop trigger if exists event_financial_records_set_updated_at on public.event_financial_records;
create trigger event_financial_records_set_updated_at
before update on public.event_financial_records
for each row execute function public.set_updated_at();

create index if not exists event_financial_records_status_idx
  on public.event_financial_records(status, event_ends_at desc);

create index if not exists event_financial_records_ends_at_status_idx
  on public.event_financial_records(event_ends_at desc, status);

create index if not exists event_financial_records_facilitator_idx
  on public.event_financial_records(primary_facilitator_id, event_ends_at desc);

alter table public.event_financial_records enable row level security;
alter table public.event_financial_record_booking_lines enable row level security;
alter table public.event_financial_adjustments enable row level security;

grant select, insert, update on public.event_financial_records to authenticated;
grant select, insert, delete on public.event_financial_record_booking_lines to authenticated;
grant select, insert on public.event_financial_adjustments to authenticated;

drop policy if exists "Admins can read event financial records" on public.event_financial_records;
create policy "Admins can read event financial records"
on public.event_financial_records for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can insert event financial records" on public.event_financial_records;
create policy "Admins can insert event financial records"
on public.event_financial_records for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can update event financial records" on public.event_financial_records;
create policy "Admins can update event financial records"
on public.event_financial_records for update
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

drop policy if exists "Admins can read event financial booking lines" on public.event_financial_record_booking_lines;
create policy "Admins can read event financial booking lines"
on public.event_financial_record_booking_lines for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can insert event financial booking lines" on public.event_financial_record_booking_lines;
create policy "Admins can insert event financial booking lines"
on public.event_financial_record_booking_lines for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can delete event financial booking lines" on public.event_financial_record_booking_lines;
create policy "Admins can delete event financial booking lines"
on public.event_financial_record_booking_lines for delete
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can read event financial adjustments" on public.event_financial_adjustments;
create policy "Admins can read event financial adjustments"
on public.event_financial_adjustments for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can insert event financial adjustments" on public.event_financial_adjustments;
create policy "Admins can insert event financial adjustments"
on public.event_financial_adjustments for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

comment on column public.commission_settings.tier_one_limit_cents is 'Upper revenue boundary for the first event-level commission tier.';
comment on column public.commission_settings.tier_two_rate_bps is 'Commission rate applied above tier_one_limit_cents for event-level settlement.';
comment on column public.facilitator_commission_terms.tier_one_limit_cents is 'Optional facilitator-specific upper revenue boundary for the first event-level commission tier.';
comment on column public.facilitator_commission_terms.tier_two_rate_bps is 'Optional facilitator-specific commission rate above tier_one_limit_cents.';
comment on table public.event_financial_records is 'Event-level financial snapshots for completed, previously published events.';
comment on table public.event_financial_record_booking_lines is 'Booking-line snapshots included in an event financial record.';
comment on table public.event_financial_adjustments is 'Manual event financial adjustments for future settlement and payment workflows.';
