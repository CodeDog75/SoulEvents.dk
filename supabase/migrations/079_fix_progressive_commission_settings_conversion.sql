alter table public.commission_settings
  add column if not exists tier_one_limit_cents int not null default 120000,
  add column if not exists tier_two_rate_bps int not null default 1000;

with soulevents_progressive_source as (
  select
    id,
    threshold_cents,
    commission_rate_bps,
    minimum_commission_cents,
    currency,
    created_by,
    effective_from,
    created_at,
    row_number() over (order by effective_from desc, created_at desc) as recency_rank,
    count(*) over () as active_count
  from public.commission_settings
  where is_active
    and (
      (threshold_cents = 80000 and commission_rate_bps = 500)
      or (threshold_cents = 120000 and commission_rate_bps = 1000)
      or (threshold_cents in (80000, 120000) and tier_one_limit_cents = 2500000 and tier_two_rate_bps = 500)
    )
),
matching_state as (
  select count(*)::int as matching_active_count
  from soulevents_progressive_source
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
  80000,
  500,
  120000,
  1000,
  coalesce(latest.minimum_commission_cents, 0),
  coalesce(latest.currency, 'DKK'),
  now(),
  true,
  'Corrected progressive standard model: 0-800 DKK at 0%, 800-1200 DKK at 5%, above 1200 DKK at 10%.',
  latest.created_by
from (
  select *
  from soulevents_progressive_source
  order by recency_rank asc
  limit 1
) latest, matching_state
where matching_state.matching_active_count >= 1
  and not exists (
    select 1
    from public.commission_settings existing
    where existing.is_active
      and existing.threshold_cents = 80000
      and existing.commission_rate_bps = 500
      and existing.tier_one_limit_cents = 120000
      and existing.tier_two_rate_bps = 1000
  );

with canonical_setting as (
  select id
  from public.commission_settings
  where is_active
    and threshold_cents = 80000
    and commission_rate_bps = 500
    and tier_one_limit_cents = 120000
    and tier_two_rate_bps = 1000
  order by effective_from desc, created_at desc
  limit 1
)
update public.commission_settings settings
set is_active = false
from canonical_setting
where settings.is_active
  and settings.id <> canonical_setting.id;

alter table public.commission_settings
  drop constraint if exists commission_settings_tier_one_limit_check,
  add constraint commission_settings_tier_one_limit_check check (tier_one_limit_cents >= threshold_cents);

alter table public.commission_settings
  drop constraint if exists commission_settings_tier_two_rate_check,
  add constraint commission_settings_tier_two_rate_check check (tier_two_rate_bps >= 0 and tier_two_rate_bps <= 10000);

comment on column public.commission_settings.tier_one_limit_cents is 'Upper revenue boundary for the first event-level commission tier.';
comment on column public.commission_settings.tier_two_rate_bps is 'Commission rate applied above tier_one_limit_cents for event-level settlement.';
