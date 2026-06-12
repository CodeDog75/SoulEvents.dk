alter table facilitator_profiles
add column if not exists host_reference_id text;

alter table events
add column if not exists event_reference_id text,
add column if not exists event_reference_number int;

create sequence if not exists host_reference_number_seq start with 100 increment by 1;

create table if not exists facilitator_event_reference_counters (
  facilitator_id uuid primary key references facilitator_profiles(id) on delete cascade,
  last_number int not null default 0
);

with ordered_hosts as (
  select
    id,
    'V' || (99 + row_number() over (order by created_at, id))::text as generated_reference
  from facilitator_profiles
  where host_reference_id is null
)
update facilitator_profiles fp
set host_reference_id = ordered_hosts.generated_reference
from ordered_hosts
where fp.id = ordered_hosts.id;

do $$
declare
  next_host_number int;
begin
  select coalesce(max(substring(host_reference_id from 2)::int), 99) + 1
  into next_host_number
  from facilitator_profiles
  where host_reference_id ~ '^V[0-9]+$';

  execute 'alter sequence host_reference_number_seq restart with ' || next_host_number;
end $$;

alter table facilitator_profiles
alter column host_reference_id set not null;

create unique index if not exists facilitator_profiles_host_reference_id_key
on facilitator_profiles(host_reference_id);

with ordered_events as (
  select
    e.id,
    row_number() over (partition by e.facilitator_id order by e.created_at, e.id) as event_number,
    fp.host_reference_id,
    e.created_at
  from events e
  join facilitator_profiles fp on fp.id = e.facilitator_id
  where e.event_reference_id is null
),
generated_events as (
  select
    id,
    event_number,
    host_reference_id || '-E' || lpad(event_number::text, 2, '0') || '-' || to_char(created_at, 'MMYY') as generated_reference
  from ordered_events
)
update events e
set
  event_reference_number = generated_events.event_number,
  event_reference_id = generated_events.generated_reference
from generated_events
where e.id = generated_events.id;

insert into facilitator_event_reference_counters (facilitator_id, last_number)
select facilitator_id, max(event_reference_number)
from events
where event_reference_number is not null
group by facilitator_id
on conflict (facilitator_id) do update
set last_number = greatest(
  facilitator_event_reference_counters.last_number,
  excluded.last_number
);

alter table events
alter column event_reference_id set not null;

alter table events
alter column event_reference_number set not null;

create unique index if not exists events_event_reference_id_key
on events(event_reference_id);

create or replace function assign_host_reference_id()
returns trigger
language plpgsql
as $$
begin
  if new.host_reference_id is null or new.host_reference_id = '' then
    new.host_reference_id := 'V' || nextval('host_reference_number_seq')::text;
  end if;

  return new;
end;
$$;

drop trigger if exists facilitator_profiles_assign_host_reference_id on facilitator_profiles;
create trigger facilitator_profiles_assign_host_reference_id
before insert on facilitator_profiles
for each row
execute function assign_host_reference_id();

create or replace function assign_event_reference_id()
returns trigger
language plpgsql
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
  from facilitator_profiles
  where id = new.facilitator_id;

  if host_reference is null then
    raise exception 'Missing host_reference_id for facilitator %', new.facilitator_id;
  end if;

  insert into facilitator_event_reference_counters (facilitator_id, last_number)
  values (new.facilitator_id, 1)
  on conflict (facilitator_id) do update
  set last_number = facilitator_event_reference_counters.last_number + 1
  returning last_number into next_event_number;

  reference_month := to_char(coalesce(new.created_at, now()), 'MMYY');
  new.event_reference_number := next_event_number;
  new.event_reference_id := host_reference || '-E' || lpad(next_event_number::text, 2, '0') || '-' || reference_month;

  return new;
end;
$$;

drop trigger if exists events_assign_event_reference_id on events;
create trigger events_assign_event_reference_id
before insert on events
for each row
execute function assign_event_reference_id();
