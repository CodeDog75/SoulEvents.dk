create table if not exists public.external_event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  facilitator_id uuid not null references public.facilitator_profiles(id) on delete cascade,
  participant_name text not null,
  participant_email text not null,
  participant_phone text,
  seats integer not null default 1,
  internal_note text,
  source text not null default 'manual',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_event_participants_seats_check check (seats >= 1 and seats <= 500),
  constraint external_event_participants_source_check check (source in ('manual', 'provider_sync'))
);

create index if not exists external_event_participants_event_id_idx
on public.external_event_participants(event_id);

create index if not exists external_event_participants_facilitator_id_idx
on public.external_event_participants(facilitator_id);

drop trigger if exists set_external_event_participants_updated_at on public.external_event_participants;
create trigger set_external_event_participants_updated_at
before update on public.external_event_participants
for each row execute function public.set_updated_at();

alter table public.external_event_participants enable row level security;

drop policy if exists "Facilitators can read own external event participants" on public.external_event_participants;
create policy "Facilitators can read own external event participants"
on public.external_event_participants
for select
to authenticated
using (
  exists (
    select 1
    from public.facilitator_profiles fp
    where fp.id = external_event_participants.facilitator_id
      and fp.profile_id = auth.uid()
  )
  or private.is_admin()
);

drop policy if exists "Facilitators can insert own external event participants" on public.external_event_participants;
create policy "Facilitators can insert own external event participants"
on public.external_event_participants
for insert
to authenticated
with check (
  exists (
    select 1
    from public.facilitator_profiles fp
    join public.events e on e.facilitator_id = fp.id
    where fp.id = external_event_participants.facilitator_id
      and e.id = external_event_participants.event_id
      and fp.profile_id = auth.uid()
      and external_event_participants.source = 'manual'
  )
  or private.is_admin()
);

drop policy if exists "Facilitators can update own external event participants" on public.external_event_participants;
create policy "Facilitators can update own external event participants"
on public.external_event_participants
for update
to authenticated
using (
  exists (
    select 1
    from public.facilitator_profiles fp
    where fp.id = external_event_participants.facilitator_id
      and fp.profile_id = auth.uid()
  )
  or private.is_admin()
)
with check (
  exists (
    select 1
    from public.facilitator_profiles fp
    join public.events e on e.facilitator_id = fp.id
    where fp.id = external_event_participants.facilitator_id
      and e.id = external_event_participants.event_id
      and fp.profile_id = auth.uid()
      and external_event_participants.source = 'manual'
  )
  or private.is_admin()
);

drop policy if exists "Facilitators can delete own external event participants" on public.external_event_participants;
create policy "Facilitators can delete own external event participants"
on public.external_event_participants
for delete
to authenticated
using (
  exists (
    select 1
    from public.facilitator_profiles fp
    where fp.id = external_event_participants.facilitator_id
      and fp.profile_id = auth.uid()
  )
  or private.is_admin()
);

comment on table public.external_event_participants is
  'Administrative participant rows for events where registration and payment are handled outside SoulEvents.';

comment on column public.external_event_participants.source is
  'manual rows are created by the facilitator; provider_sync is reserved for future external ticketing integrations.';

notify pgrst, 'reload schema';
