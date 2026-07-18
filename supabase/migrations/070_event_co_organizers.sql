create table if not exists public.event_co_organizers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  primary_organizer_profile_id uuid not null references public.facilitator_profiles(id) on delete cascade,
  co_organizer_profile_id uuid not null references public.facilitator_profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled', 'withdrawn')),
  response_token uuid not null default gen_random_uuid(),
  invited_by_user_id uuid references public.profiles(id) on delete set null,
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_co_organizers_not_primary check (primary_organizer_profile_id <> co_organizer_profile_id)
);

create unique index if not exists event_co_organizers_response_token_key
  on public.event_co_organizers(response_token);

create unique index if not exists event_co_organizers_active_unique
  on public.event_co_organizers(event_id, co_organizer_profile_id)
  where status in ('pending', 'accepted');

create index if not exists event_co_organizers_event_status_idx
  on public.event_co_organizers(event_id, status);

create index if not exists event_co_organizers_profile_status_idx
  on public.event_co_organizers(co_organizer_profile_id, status);

create or replace function public.set_event_co_organizers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_event_co_organizers_updated_at on public.event_co_organizers;
create trigger set_event_co_organizers_updated_at
before update on public.event_co_organizers
for each row execute function public.set_event_co_organizers_updated_at();

create or replace function public.enforce_event_co_organizer_limit()
returns trigger
language plpgsql
as $$
declare
  active_count integer;
  event_owner uuid;
begin
  select facilitator_id into event_owner
  from public.events
  where id = new.event_id;

  if event_owner is null then
    raise exception 'Event does not exist.';
  end if;

  if new.primary_organizer_profile_id <> event_owner then
    raise exception 'Primary organizer must match event owner.';
  end if;

  if new.co_organizer_profile_id = event_owner then
    raise exception 'Primary organizer cannot be invited as co-organizer.';
  end if;

  if new.status in ('pending', 'accepted') then
    select count(*) into active_count
    from public.event_co_organizers
    where event_id = new.event_id
      and status in ('pending', 'accepted')
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

    if active_count >= 2 then
      raise exception 'An event can have at most two co-organizers.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_event_co_organizer_limit on public.event_co_organizers;
create trigger enforce_event_co_organizer_limit
before insert or update on public.event_co_organizers
for each row execute function public.enforce_event_co_organizer_limit();

alter table public.event_co_organizers enable row level security;

drop policy if exists "event co organizers are publicly readable when accepted" on public.event_co_organizers;
create policy "event co organizers are publicly readable when accepted"
on public.event_co_organizers
for select
using (status = 'accepted');

drop policy if exists "service role manages event co organizers" on public.event_co_organizers;
create policy "service role manages event co organizers"
on public.event_co_organizers
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

notify pgrst, 'reload schema';
