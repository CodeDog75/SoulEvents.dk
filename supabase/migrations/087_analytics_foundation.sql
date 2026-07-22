-- Analytics Foundation 1.0
-- GDPR-friendly, first-party analytics. Public clients never write directly to
-- these tables; writes go through the server-side analytics endpoint.

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid()
);

alter table public.analytics_events
  add column if not exists event_type text,
  add column if not exists occurred_at timestamptz default now(),
  add column if not exists event_id uuid references public.events(id) on delete cascade,
  add column if not exists facilitator_id uuid references public.facilitator_profiles(id) on delete cascade,
  add column if not exists anonymous_session_hash text,
  add column if not exists dedupe_bucket date,
  add column if not exists is_unique boolean default true,
  add column if not exists share_method text,
  add column if not exists referrer_category text default 'unknown',
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now();

update public.analytics_events
set
  occurred_at = coalesce(occurred_at, now()),
  dedupe_bucket = coalesce(dedupe_bucket, coalesce(occurred_at, now())::date),
  is_unique = coalesce(is_unique, true),
  referrer_category = coalesce(referrer_category, 'unknown'),
  metadata = coalesce(metadata, '{}'::jsonb),
  created_at = coalesce(created_at, now());

alter table public.analytics_events
  alter column event_type set not null,
  alter column occurred_at set not null,
  alter column anonymous_session_hash set not null,
  alter column dedupe_bucket set not null,
  alter column is_unique set not null,
  alter column referrer_category set not null,
  alter column metadata set not null,
  alter column created_at set not null,
  alter column occurred_at set default now(),
  alter column is_unique set default true,
  alter column referrer_category set default 'unknown',
  alter column metadata set default '{}'::jsonb,
  alter column created_at set default now();

alter table public.analytics_events drop constraint if exists analytics_events_event_type_check;
alter table public.analytics_events add constraint analytics_events_event_type_check
  check (event_type in ('event_view', 'event_share', 'facilitator_profile_view')) not valid;

alter table public.analytics_events drop constraint if exists analytics_events_share_method_allowed_check;
alter table public.analytics_events add constraint analytics_events_share_method_allowed_check
  check (
    share_method is null
    or share_method in ('native_share', 'copy_link', 'email', 'sms', 'messenger', 'facebook', 'other')
  ) not valid;

alter table public.analytics_events drop constraint if exists analytics_events_referrer_category_check;
alter table public.analytics_events add constraint analytics_events_referrer_category_check
  check (referrer_category in ('direct', 'internal', 'search', 'social', 'external', 'unknown')) not valid;

alter table public.analytics_events drop constraint if exists analytics_events_target_check;
alter table public.analytics_events add constraint analytics_events_target_check
  check (
    (event_type in ('event_view', 'event_share') and event_id is not null)
    or (event_type = 'facilitator_profile_view' and facilitator_id is not null and event_id is null)
  ) not valid;

alter table public.analytics_events drop constraint if exists analytics_events_share_method_check;
alter table public.analytics_events add constraint analytics_events_share_method_check
  check (
    (event_type = 'event_share' and share_method is not null)
    or (event_type <> 'event_share' and share_method is null)
  ) not valid;

alter table public.analytics_events drop constraint if exists analytics_events_metadata_object_check;
alter table public.analytics_events add constraint analytics_events_metadata_object_check
  check (jsonb_typeof(metadata) = 'object') not valid;

create index if not exists analytics_events_type_occurred_at_idx
  on public.analytics_events(event_type, occurred_at desc);

create index if not exists analytics_events_event_occurred_at_idx
  on public.analytics_events(event_id, occurred_at desc)
  where event_id is not null;

create index if not exists analytics_events_facilitator_occurred_at_idx
  on public.analytics_events(facilitator_id, occurred_at desc)
  where facilitator_id is not null;

create index if not exists analytics_events_share_method_idx
  on public.analytics_events(share_method, occurred_at desc)
  where share_method is not null;

create unique index if not exists analytics_unique_event_view_session_day_idx
  on public.analytics_events(event_type, event_id, anonymous_session_hash, dedupe_bucket)
  where event_type = 'event_view' and is_unique = true;

create unique index if not exists analytics_unique_profile_view_session_day_idx
  on public.analytics_events(event_type, facilitator_id, anonymous_session_hash, dedupe_bucket)
  where event_type = 'facilitator_profile_view' and is_unique = true;

alter table public.analytics_events enable row level security;

drop policy if exists "Admins can read analytics events" on public.analytics_events;
create policy "Admins can read analytics events"
on public.analytics_events
for select
to authenticated
using (private.is_admin());

create table if not exists public.analytics_monthly_snapshots (
  month_start date primary key,
  active_facilitators_count integer not null default 0,
  new_facilitators_count integer not null default 0,
  published_events_count integer not null default 0,
  held_events_count integer not null default 0,
  bookings_count integer not null default 0,
  confirmed_seats_count integer not null default 0,
  unique_event_views_count integer not null default 0,
  event_shares_count integer not null default 0,
  facilitator_profile_views_count integer not null default 0,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists analytics_monthly_snapshots_set_updated_at on public.analytics_monthly_snapshots;
create trigger analytics_monthly_snapshots_set_updated_at
before update on public.analytics_monthly_snapshots
for each row execute function set_updated_at();

alter table public.analytics_monthly_snapshots enable row level security;

drop policy if exists "Admins can read analytics monthly snapshots" on public.analytics_monthly_snapshots;
create policy "Admins can read analytics monthly snapshots"
on public.analytics_monthly_snapshots
for select
to authenticated
using (private.is_admin());

create or replace function public.refresh_analytics_monthly_snapshot(target_month date default date_trunc('month', now())::date)
returns public.analytics_monthly_snapshots
language plpgsql
security definer
set search_path = public, private
as $$
declare
  month_start_value date := date_trunc('month', target_month)::date;
  month_end_value timestamptz := (date_trunc('month', target_month)::date + interval '1 month')::timestamptz;
  snapshot_row public.analytics_monthly_snapshots;
begin
  if not (private.is_admin() or current_user in ('postgres', 'service_role', 'supabase_admin')) then
    raise exception 'Only admins can refresh analytics snapshots';
  end if;

  insert into public.analytics_monthly_snapshots (
    month_start,
    active_facilitators_count,
    new_facilitators_count,
    published_events_count,
    held_events_count,
    bookings_count,
    confirmed_seats_count,
    unique_event_views_count,
    event_shares_count,
    facilitator_profile_views_count,
    generated_at
  )
  values (
    month_start_value,
    (select count(*)::integer from public.facilitator_profiles where status = 'approved' and coalesce(is_paused, false) = false and coalesce(is_disabled, false) = false),
    (select count(*)::integer from public.facilitator_profiles where created_at >= month_start_value::timestamptz and created_at < month_end_value),
    (select count(*)::integer from public.events where published_at >= month_start_value::timestamptz and published_at < month_end_value),
    (select count(*)::integer from public.events where ends_at >= month_start_value::timestamptz and ends_at < month_end_value and status in ('active', 'sold_out', 'completed', 'archived')),
    (select count(*)::integer from public.bookings where created_at >= month_start_value::timestamptz and created_at < month_end_value and status <> 'cancelled'),
    (select coalesce(sum(seats), 0)::integer from public.bookings where created_at >= month_start_value::timestamptz and created_at < month_end_value and status in ('confirmed', 'completed', 'invoiced', 'paid')),
    (select count(*)::integer from public.analytics_events where occurred_at >= month_start_value::timestamptz and occurred_at < month_end_value and event_type = 'event_view' and is_unique = true),
    (select count(*)::integer from public.analytics_events where occurred_at >= month_start_value::timestamptz and occurred_at < month_end_value and event_type = 'event_share'),
    (select count(*)::integer from public.analytics_events where occurred_at >= month_start_value::timestamptz and occurred_at < month_end_value and event_type = 'facilitator_profile_view' and is_unique = true),
    now()
  )
  on conflict (month_start) do update set
    active_facilitators_count = excluded.active_facilitators_count,
    new_facilitators_count = excluded.new_facilitators_count,
    published_events_count = excluded.published_events_count,
    held_events_count = excluded.held_events_count,
    bookings_count = excluded.bookings_count,
    confirmed_seats_count = excluded.confirmed_seats_count,
    unique_event_views_count = excluded.unique_event_views_count,
    event_shares_count = excluded.event_shares_count,
    facilitator_profile_views_count = excluded.facilitator_profile_views_count,
    generated_at = now()
  returning * into snapshot_row;

  return snapshot_row;
end;
$$;

revoke all on function public.refresh_analytics_monthly_snapshot(date) from public;
grant execute on function public.refresh_analytics_monthly_snapshot(date) to authenticated;
grant execute on function public.refresh_analytics_monthly_snapshot(date) to service_role;

create or replace function public.get_admin_platform_insights(period_start timestamptz, period_end timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  result jsonb;
begin
  if not (private.is_admin() or current_user in ('postgres', 'service_role', 'supabase_admin')) then
    raise exception 'Only admins can read platform insights';
  end if;

  select jsonb_build_object(
    'summary', jsonb_build_object(
      'uniqueEventViews', (select count(*) from public.analytics_events where event_type = 'event_view' and is_unique = true and occurred_at >= period_start and occurred_at < period_end),
      'eventShares', (select count(*) from public.analytics_events where event_type = 'event_share' and occurred_at >= period_start and occurred_at < period_end),
      'facilitatorProfileViews', (select count(*) from public.analytics_events where event_type = 'facilitator_profile_view' and is_unique = true and occurred_at >= period_start and occurred_at < period_end),
      'bookings', (select count(*) from public.bookings where created_at >= period_start and created_at < period_end and status <> 'cancelled'),
      'confirmedSeats', (select coalesce(sum(seats), 0) from public.bookings where created_at >= period_start and created_at < period_end and status in ('confirmed', 'completed', 'invoiced', 'paid')),
      'activeFacilitators', (select count(*) from public.facilitator_profiles where status = 'approved' and coalesce(is_paused, false) = false and coalesce(is_disabled, false) = false),
      'upcomingPublicEvents', (select count(*) from public.events e join public.facilitator_profiles fp on fp.id = e.facilitator_id where e.status in ('active', 'sold_out') and e.ends_at >= now() and fp.status = 'approved' and coalesce(fp.is_paused, false) = false and coalesce(fp.is_disabled, false) = false)
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', day_value::date,
        'eventViews', coalesce(event_views, 0),
        'profileViews', coalesce(profile_views, 0),
        'shares', coalesce(shares, 0),
        'bookings', coalesce(bookings_count, 0)
      ) order by day_value), '[]'::jsonb)
      from generate_series(date_trunc('day', period_start), date_trunc('day', period_end - interval '1 second'), interval '1 day') day_value
      left join (
        select date_trunc('day', occurred_at) as day_key,
          count(*) filter (where event_type = 'event_view' and is_unique = true) as event_views,
          count(*) filter (where event_type = 'facilitator_profile_view' and is_unique = true) as profile_views,
          count(*) filter (where event_type = 'event_share') as shares
        from public.analytics_events
        where occurred_at >= period_start and occurred_at < period_end
        group by 1
      ) analytics_daily on analytics_daily.day_key = day_value
      left join (
        select date_trunc('day', created_at) as day_key, count(*) as bookings_count
        from public.bookings
        where created_at >= period_start and created_at < period_end and status <> 'cancelled'
        group by 1
      ) bookings_daily on bookings_daily.day_key = day_value
    ),
    'topEvents', (
      select coalesce(jsonb_agg(to_jsonb(event_row) order by event_row.unique_views desc, event_row.bookings desc), '[]'::jsonb)
      from (
        select
          e.id,
          e.title,
          e.slug,
          e.starts_at,
          coalesce(fp.company_name, p.full_name, 'Arrangør') as facilitator_name,
          coalesce(ev.unique_views, 0)::integer as unique_views,
          coalesce(sh.share_count, 0)::integer as shares,
          coalesce(b.booking_count, 0)::integer as bookings,
          coalesce(b.confirmed_seats, 0)::integer as confirmed_seats
        from public.events e
        join public.facilitator_profiles fp on fp.id = e.facilitator_id
        left join public.profiles p on p.id = fp.profile_id
        left join (
          select event_id, count(*) as unique_views
          from public.analytics_events
          where event_type = 'event_view' and is_unique = true and occurred_at >= period_start and occurred_at < period_end
          group by event_id
        ) ev on ev.event_id = e.id
        left join (
          select event_id, count(*) as share_count
          from public.analytics_events
          where event_type = 'event_share' and occurred_at >= period_start and occurred_at < period_end
          group by event_id
        ) sh on sh.event_id = e.id
        left join (
          select event_id, count(*) as booking_count, coalesce(sum(seats) filter (where status in ('confirmed', 'completed', 'invoiced', 'paid')), 0) as confirmed_seats
          from public.bookings
          where created_at >= period_start and created_at < period_end and status <> 'cancelled'
          group by event_id
        ) b on b.event_id = e.id
        where ev.event_id is not null or sh.event_id is not null or b.event_id is not null
        order by coalesce(ev.unique_views, 0) desc, coalesce(b.booking_count, 0) desc
        limit 10
      ) event_row
    ),
    'facilitators', (
      select coalesce(jsonb_agg(to_jsonb(facilitator_row) order by facilitator_row.profile_views desc, facilitator_row.event_views desc), '[]'::jsonb)
      from (
        select
          fp.id,
          fp.slug,
          fp.host_reference_id,
          coalesce(fp.company_name, p.full_name, 'Arrangør') as name,
          fp.status,
          coalesce(profile_views.profile_views, 0)::integer as profile_views,
          coalesce(event_views.event_views, 0)::integer as event_views,
          coalesce(bookings.booking_count, 0)::integer as bookings
        from public.facilitator_profiles fp
        left join public.profiles p on p.id = fp.profile_id
        left join (
          select facilitator_id, count(*) as profile_views
          from public.analytics_events
          where event_type = 'facilitator_profile_view' and is_unique = true and occurred_at >= period_start and occurred_at < period_end
          group by facilitator_id
        ) profile_views on profile_views.facilitator_id = fp.id
        left join (
          select e.facilitator_id, count(*) as event_views
          from public.analytics_events ae
          join public.events e on e.id = ae.event_id
          where ae.event_type = 'event_view' and ae.is_unique = true and ae.occurred_at >= period_start and ae.occurred_at < period_end
          group by e.facilitator_id
        ) event_views on event_views.facilitator_id = fp.id
        left join (
          select facilitator_id, count(*) as booking_count
          from public.bookings
          where created_at >= period_start and created_at < period_end and status <> 'cancelled'
          group by facilitator_id
        ) bookings on bookings.facilitator_id = fp.id
        where profile_views.facilitator_id is not null or event_views.facilitator_id is not null or bookings.facilitator_id is not null
        order by coalesce(profile_views.profile_views, 0) desc, coalesce(event_views.event_views, 0) desc
        limit 10
      ) facilitator_row
    ),
    'categories', (
      select coalesce(jsonb_agg(to_jsonb(category_row) order by category_row.event_views desc), '[]'::jsonb)
      from (
        select
          mc.id,
          mc.name,
          mc.slug,
          (count(*) filter (where ae.event_type = 'event_view' and ae.is_unique = true))::integer as event_views,
          (count(*) filter (where ae.event_type = 'event_share'))::integer as shares
        from public.analytics_events ae
        join public.event_main_categories emc on emc.event_id = ae.event_id
        join public.main_categories mc on mc.id = emc.main_category_id
        where ae.occurred_at >= period_start and ae.occurred_at < period_end
        group by mc.id, mc.name, mc.slug
        order by event_views desc
        limit 10
      ) category_row
    ),
    'shareMethods', (
      select coalesce(jsonb_agg(jsonb_build_object('method', share_method_row.share_method, 'count', share_method_row.share_count) order by share_method_row.share_count desc), '[]'::jsonb)
      from (
        select coalesce(share_method, 'other') as share_method, count(*)::integer as share_count
        from public.analytics_events
        where event_type = 'event_share' and occurred_at >= period_start and occurred_at < period_end
        group by coalesce(share_method, 'other')
      ) share_method_row
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_admin_platform_insights(timestamptz, timestamptz) from public;
grant execute on function public.get_admin_platform_insights(timestamptz, timestamptz) to authenticated;
grant execute on function public.get_admin_platform_insights(timestamptz, timestamptz) to service_role;

notify pgrst, 'reload schema';
