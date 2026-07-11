create table if not exists public.event_update_notification_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  facilitator_id uuid not null references public.facilitator_profiles(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  recipient_count int not null default 0,
  created_at timestamptz not null default now(),
  constraint event_update_notification_logs_recipient_count_check check (recipient_count >= 0)
);

create index if not exists event_update_notification_logs_event_created_at_idx
  on public.event_update_notification_logs(event_id, created_at desc);

create index if not exists event_update_notification_logs_facilitator_created_at_idx
  on public.event_update_notification_logs(facilitator_id, created_at desc);

alter table public.event_update_notification_logs enable row level security;

drop policy if exists "Admins can read event update notification logs" on public.event_update_notification_logs;
create policy "Admins can read event update notification logs"
on public.event_update_notification_logs for select
using (private.is_admin());

drop policy if exists "Facilitators can read own event update notification logs" on public.event_update_notification_logs;
create policy "Facilitators can read own event update notification logs"
on public.event_update_notification_logs for select
using (
  exists (
    select 1
    from public.events
    join public.facilitator_profiles
      on facilitator_profiles.id = events.facilitator_id
    where events.id = event_update_notification_logs.event_id
      and events.facilitator_id = event_update_notification_logs.facilitator_id
      and facilitator_profiles.profile_id = auth.uid()
  )
);

drop policy if exists "Facilitators can insert own event update notification logs" on public.event_update_notification_logs;
create policy "Facilitators can insert own event update notification logs"
on public.event_update_notification_logs for insert
with check (
  actor_profile_id = auth.uid()
  and exists (
    select 1
    from public.events
    join public.facilitator_profiles
      on facilitator_profiles.id = events.facilitator_id
    where events.id = event_update_notification_logs.event_id
      and events.facilitator_id = event_update_notification_logs.facilitator_id
      and facilitator_profiles.profile_id = auth.uid()
  )
);

notify pgrst, 'reload schema';
