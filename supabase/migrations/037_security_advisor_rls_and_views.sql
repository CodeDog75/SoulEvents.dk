-- Security Advisor hardening.
-- Internal event reference counters should never be accessed directly from the frontend.

alter table if exists public.facilitator_event_reference_counters
enable row level security;

revoke all on table public.facilitator_event_reference_counters from anon;
revoke all on table public.facilitator_event_reference_counters from authenticated;
revoke all on table public.facilitator_event_reference_counters from public;

comment on table public.facilitator_event_reference_counters is
  'Internal counter table used by assign_event_reference_id(). No direct frontend access.';

create or replace function public.assign_event_reference_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  host_reference text;
  next_event_number int;
  reference_month text;
begin
  if new.event_reference_id is not null and new.event_reference_id <> '' then
    return new;
  end if;

  select host_reference_id
  into host_reference
  from public.facilitator_profiles
  where id = new.facilitator_id;

  if host_reference is null then
    raise exception 'Missing host_reference_id for facilitator %', new.facilitator_id;
  end if;

  insert into public.facilitator_event_reference_counters (facilitator_id, last_number)
  values (new.facilitator_id, 1)
  on conflict (facilitator_id) do update
  set last_number = public.facilitator_event_reference_counters.last_number + 1
  returning last_number into next_event_number;

  reference_month := to_char(coalesce(new.created_at, now()), 'MMYY');
  new.event_reference_number := next_event_number;
  new.event_reference_id := host_reference || '-E' || lpad(next_event_number::text, 2, '0') || '-' || reference_month;

  return new;
end;
$$;

grant execute on function public.assign_event_reference_id() to authenticated;
grant execute on function public.assign_event_reference_id() to service_role;

create or replace view public.event_capacity_view
with (security_invoker = true)
as
select
  e.id as event_id,
  e.capacity,
  coalesce(sum(b.seats) filter (where b.status in ('pending', 'confirmed')), 0)::int as reserved_seats,
  (e.capacity - coalesce(sum(b.seats) filter (where b.status in ('pending', 'confirmed')), 0))::int as available_seats
from public.events e
left join public.bookings b on b.event_id = e.id
group by e.id, e.capacity;

create or replace view public.admin_booking_overview
with (security_invoker = true)
as
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
from public.bookings b
join public.events e on e.id = b.event_id
join public.facilitator_profiles fp on fp.id = b.facilitator_id
where public.is_admin();

create or replace view public.facilitator_monthly_totals
with (security_invoker = true)
as
select
  facilitator_id,
  date_trunc('month', created_at)::date as month_start,
  (date_trunc('month', created_at) + interval '1 month - 1 day')::date as month_end,
  count(*)::int as total_bookings,
  coalesce(sum(seats), 0)::int as total_seats,
  coalesce(sum(booking_value_cents), 0)::int as booking_value_cents,
  coalesce(sum(commission_cents), 0)::int as commission_cents
from public.bookings
where status in ('confirmed', 'completed', 'invoiced', 'paid')
group by facilitator_id, date_trunc('month', created_at);

revoke all on table public.event_capacity_view from anon;
revoke all on table public.event_capacity_view from authenticated;
revoke all on table public.event_capacity_view from public;
revoke all on table public.admin_booking_overview from anon;
revoke all on table public.admin_booking_overview from authenticated;
revoke all on table public.admin_booking_overview from public;
revoke all on table public.facilitator_monthly_totals from anon;
revoke all on table public.facilitator_monthly_totals from authenticated;
revoke all on table public.facilitator_monthly_totals from public;

grant select on table public.admin_booking_overview to authenticated;
grant select on table public.facilitator_monthly_totals to authenticated;
grant select on table public.event_capacity_view to service_role;
grant select on table public.admin_booking_overview to service_role;
grant select on table public.facilitator_monthly_totals to service_role;

notify pgrst, 'reload schema';
