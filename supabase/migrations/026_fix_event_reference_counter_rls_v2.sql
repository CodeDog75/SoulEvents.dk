-- Stronger fix for event reference counters.
-- facilitator_event_reference_counters is an internal technical counter table.
-- It should not block hosts from saving drafts/events.

alter table if exists public.facilitator_event_reference_counters
disable row level security;

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

drop trigger if exists events_assign_event_reference_id on public.events;
create trigger events_assign_event_reference_id
before insert on public.events
for each row
execute function public.assign_event_reference_id();

grant execute on function public.assign_event_reference_id() to authenticated;
grant execute on function public.assign_event_reference_id() to service_role;

notify pgrst, 'reload schema';
