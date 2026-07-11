create or replace function public.enforce_booking_capacity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  event_capacity int;
  reserved_seats int;
begin
  if new.status not in ('pending', 'confirmed') then
    return new;
  end if;

  select capacity
  into event_capacity
  from public.events
  where id = new.event_id
  for update;

  if event_capacity is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    select coalesce(sum(b.seats), 0)::int
    into reserved_seats
    from public.bookings b
    where b.event_id = new.event_id
      and b.status in ('pending', 'confirmed');
  else
    select coalesce(sum(b.seats), 0)::int
    into reserved_seats
    from public.bookings b
    where b.event_id = new.event_id
      and b.status in ('pending', 'confirmed')
      and b.id <> old.id;
  end if;

  if reserved_seats + new.seats > event_capacity then
    raise exception 'Event capacity exceeded'
      using errcode = '23514',
            constraint = 'booking_capacity_not_exceeded';
  end if;

  return new;
end;
$$;

create or replace function public.sync_event_capacity_status_from_booking()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  affected_event_ids uuid[];
  affected_event_id uuid;
  event_capacity int;
  event_status public.event_status;
  reserved_seats int;
  next_status public.event_status;
begin
  if tg_op = 'INSERT' then
    affected_event_ids := array[new.event_id];
  elsif tg_op = 'DELETE' then
    affected_event_ids := array[old.event_id];
  elsif old.event_id = new.event_id then
    affected_event_ids := array[new.event_id];
  else
    affected_event_ids := array[old.event_id, new.event_id];
  end if;

  foreach affected_event_id in array affected_event_ids
  loop
    select capacity, status
    into event_capacity, event_status
    from public.events
    where id = affected_event_id
    for update;

    if event_status in ('active', 'sold_out') then
      select coalesce(sum(seats), 0)::int
      into reserved_seats
      from public.bookings
      where event_id = affected_event_id
        and status in ('pending', 'confirmed');

      next_status := case
        when reserved_seats >= event_capacity then 'sold_out'::public.event_status
        else 'active'::public.event_status
      end;

      if event_status <> next_status then
        update public.events
        set status = next_status
        where id = affected_event_id;
      end if;
    end if;
  end loop;

  return null;
end;
$$;

drop trigger if exists bookings_enforce_capacity on public.bookings;
create trigger bookings_enforce_capacity
before insert or update of event_id, status, seats on public.bookings
for each row
execute function public.enforce_booking_capacity();

drop trigger if exists bookings_sync_event_capacity_status on public.bookings;
create trigger bookings_sync_event_capacity_status
after insert or update of event_id, status, seats or delete on public.bookings
for each row
execute function public.sync_event_capacity_status_from_booking();

revoke all on function public.enforce_booking_capacity() from public;
revoke all on function public.enforce_booking_capacity() from anon;
revoke all on function public.enforce_booking_capacity() from authenticated;
grant execute on function public.enforce_booking_capacity() to service_role;

revoke all on function public.sync_event_capacity_status_from_booking() from public;
revoke all on function public.sync_event_capacity_status_from_booking() from anon;
revoke all on function public.sync_event_capacity_status_from_booking() from authenticated;
grant execute on function public.sync_event_capacity_status_from_booking() to service_role;

with capacity as (
  select
    e.id,
    case
      when coalesce(sum(b.seats) filter (where b.status in ('pending', 'confirmed')), 0) >= e.capacity
        then 'sold_out'::public.event_status
      else 'active'::public.event_status
    end as next_status
  from public.events e
  left join public.bookings b on b.event_id = e.id
  where e.status in ('active', 'sold_out')
  group by e.id, e.capacity
)
update public.events e
set status = capacity.next_status
from capacity
where capacity.id = e.id
  and e.status <> capacity.next_status;

notify pgrst, 'reload schema';
