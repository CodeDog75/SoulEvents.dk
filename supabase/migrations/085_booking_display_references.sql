alter table public.bookings
  add column if not exists booking_number integer,
  add column if not exists booking_reference text;

with numbered_bookings as (
  select
    id,
    event_id,
    row_number() over (partition by event_id order by created_at asc, id asc)::integer as booking_number
  from public.bookings
)
update public.bookings b
set
  booking_number = numbered_bookings.booking_number,
  booking_reference = 'SE-' || upper(substr(replace(numbered_bookings.event_id::text, '-', ''), 1, 6)) || '-' || lpad(numbered_bookings.booking_number::text, 3, '0')
from numbered_bookings
where b.id = numbered_bookings.id
  and (b.booking_number is null or b.booking_reference is null);

create or replace function public.assign_booking_display_reference()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_booking_number integer;
  event_reference text;
begin
  if new.booking_number is null then
    perform pg_advisory_xact_lock(hashtext(new.event_id::text));

    select coalesce(max(booking_number), 0) + 1
    into next_booking_number
    from public.bookings
    where event_id = new.event_id;

    new.booking_number := next_booking_number;
  end if;

  if new.booking_reference is null then
    event_reference := upper(substr(replace(new.event_id::text, '-', ''), 1, 6));
    new.booking_reference := 'SE-' || event_reference || '-' || lpad(new.booking_number::text, 3, '0');
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_assign_display_reference on public.bookings;
create trigger bookings_assign_display_reference
before insert on public.bookings
for each row
execute function public.assign_booking_display_reference();

create unique index if not exists bookings_event_booking_number_key
on public.bookings(event_id, booking_number);

create unique index if not exists bookings_booking_reference_key
on public.bookings(booking_reference);

alter table public.bookings
  alter column booking_number set not null,
  alter column booking_reference set not null;

comment on column public.bookings.booking_number is
  'Stable sequential booking number within the event, assigned at booking creation.';

comment on column public.bookings.booking_reference is
  'Short human-readable booking reference for organizer and participant communication.';

revoke execute on function public.assign_booking_display_reference() from public;
revoke execute on function public.assign_booking_display_reference() from anon;
revoke execute on function public.assign_booking_display_reference() from authenticated;
grant execute on function public.assign_booking_display_reference() to service_role;

notify pgrst, 'reload schema';
