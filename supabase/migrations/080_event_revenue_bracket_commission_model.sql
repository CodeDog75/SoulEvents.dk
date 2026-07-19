alter table public.commission_settings
  add column if not exists tier_one_limit_cents int not null default 2000000,
  add column if not exists tier_two_limit_cents int not null default 3000000,
  add column if not exists tier_two_rate_bps int not null default 500,
  add column if not exists tier_three_rate_bps int not null default 400;

alter table public.facilitator_commission_terms
  add column if not exists tier_one_limit_cents int,
  add column if not exists tier_two_limit_cents int,
  add column if not exists tier_two_rate_bps int,
  add column if not exists tier_three_rate_bps int;

alter table public.event_financial_records
  add column if not exists tier_one_limit_cents int not null default 2000000,
  add column if not exists tier_two_limit_cents int not null default 3000000,
  add column if not exists tier_two_rate_bps int not null default 500,
  add column if not exists tier_two_revenue_cents int not null default 0,
  add column if not exists tier_three_rate_bps int not null default 400,
  add column if not exists tier_three_revenue_cents int not null default 0;

alter table public.commission_settings
  drop constraint if exists commission_settings_revenue_bracket_limits_check,
  add constraint commission_settings_revenue_bracket_limits_check check (
    threshold_cents >= 0
    and tier_one_limit_cents > threshold_cents
    and tier_two_limit_cents > tier_one_limit_cents
  );

alter table public.commission_settings
  drop constraint if exists commission_settings_tier_three_rate_check,
  add constraint commission_settings_tier_three_rate_check check (tier_three_rate_bps >= 0 and tier_three_rate_bps <= 10000);

alter table public.facilitator_commission_terms
  drop constraint if exists facilitator_commission_terms_revenue_bracket_limits_check,
  add constraint facilitator_commission_terms_revenue_bracket_limits_check check (
    threshold_cents is null
    or tier_one_limit_cents is null
    or tier_two_limit_cents is null
    or (
      threshold_cents >= 0
      and tier_one_limit_cents > threshold_cents
      and tier_two_limit_cents > tier_one_limit_cents
    )
  );

alter table public.facilitator_commission_terms
  drop constraint if exists facilitator_commission_terms_tier_three_rate_check,
  add constraint facilitator_commission_terms_tier_three_rate_check check (
    tier_three_rate_bps is null
    or (tier_three_rate_bps >= 0 and tier_three_rate_bps <= 10000)
  );

alter table public.event_financial_records
  drop constraint if exists event_financial_records_revenue_bracket_limits_check,
  add constraint event_financial_records_revenue_bracket_limits_check check (
    free_threshold_cents >= 0
    and tier_one_limit_cents > free_threshold_cents
    and tier_two_limit_cents > tier_one_limit_cents
  );

alter table public.event_financial_records
  drop constraint if exists event_financial_records_tier_three_rate_check,
  add constraint event_financial_records_tier_three_rate_check check (tier_three_rate_bps >= 0 and tier_three_rate_bps <= 10000);

alter table public.event_financial_records
  drop constraint if exists event_financial_records_tier_three_revenue_check,
  add constraint event_financial_records_tier_three_revenue_check check (tier_three_revenue_cents >= 0);

with latest_active_standard as (
  select *
  from public.commission_settings
  where is_active = true
  order by effective_from desc, created_at desc
  limit 1
),
inserted as (
  insert into public.commission_settings (
    threshold_cents,
    tier_one_limit_cents,
    tier_two_limit_cents,
    commission_rate_bps,
    tier_two_rate_bps,
    tier_three_rate_bps,
    minimum_commission_cents,
    currency,
    effective_from,
    is_active,
    reason,
    created_by
  )
  select
    1000000,
    2000000,
    3000000,
    600,
    500,
    400,
    coalesce(minimum_commission_cents, 0),
    coalesce(currency, 'DKK'),
    now(),
    true,
    'Revenue bracket model: under 10,000 DKK at 0%, 10,000-19,999 DKK at 6%, 20,000-29,999 DKK at 5%, from 30,000 DKK at 4%.',
    created_by
  from latest_active_standard
  where not exists (
    select 1
    from public.commission_settings existing
    where existing.is_active = true
      and existing.threshold_cents = 1000000
      and existing.tier_one_limit_cents = 2000000
      and existing.tier_two_limit_cents = 3000000
      and existing.commission_rate_bps = 600
      and existing.tier_two_rate_bps = 500
      and existing.tier_three_rate_bps = 400
  )
  returning id
),
target_active as (
  select id from inserted
  union all
  select id
  from public.commission_settings
  where is_active = true
    and threshold_cents = 1000000
    and tier_one_limit_cents = 2000000
    and tier_two_limit_cents = 3000000
    and commission_rate_bps = 600
    and tier_two_rate_bps = 500
    and tier_three_rate_bps = 400
  order by id desc
  limit 1
)
update public.commission_settings settings
set is_active = settings.id in (select id from target_active)
where settings.is_active = true
  or settings.id in (select id from target_active);

comment on column public.commission_settings.threshold_cents is 'First event revenue boundary. Events below this revenue are commission-free.';
comment on column public.commission_settings.tier_one_limit_cents is 'Second event revenue boundary. Revenue from threshold_cents up to this boundary uses commission_rate_bps on the full event revenue.';
comment on column public.commission_settings.tier_two_limit_cents is 'Third event revenue boundary. Revenue from tier_one_limit_cents up to this boundary uses tier_two_rate_bps on the full event revenue.';
comment on column public.commission_settings.commission_rate_bps is 'Commission rate for events in the first paid revenue bracket, applied to the full event revenue.';
comment on column public.commission_settings.tier_two_rate_bps is 'Commission rate for events in the second paid revenue bracket, applied to the full event revenue.';
comment on column public.commission_settings.tier_three_rate_bps is 'Commission rate for events at or above tier_two_limit_cents, applied to the full event revenue.';
comment on column public.facilitator_commission_terms.tier_two_limit_cents is 'Optional facilitator-specific third event revenue boundary.';
comment on column public.facilitator_commission_terms.tier_three_rate_bps is 'Optional facilitator-specific commission rate for the highest event revenue bracket.';
comment on column public.event_financial_records.tier_two_limit_cents is 'Snapshot of the third event revenue boundary used for this financial record.';
comment on column public.event_financial_records.tier_three_rate_bps is 'Snapshot of the highest revenue bracket rate used for this financial record.';
comment on column public.event_financial_records.tier_three_revenue_cents is 'Full event revenue when the event landed in the highest revenue bracket, otherwise 0.';
