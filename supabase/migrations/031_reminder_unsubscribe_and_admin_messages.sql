alter table public.facilitator_event_reminders
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create unique index if not exists facilitator_event_reminders_unsubscribe_token_idx
  on public.facilitator_event_reminders(unsubscribe_token);

create table if not exists public.facilitator_admin_messages (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid references public.facilitator_profiles(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  type text not null default 'message' check (type in ('message', 'closure_request')),
  status text not null default 'unread' check (status in ('unread', 'read', 'handled')),
  subject text not null,
  message text not null check (char_length(message) <= 500),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.facilitator_admin_messages enable row level security;

drop policy if exists "Admins can manage facilitator admin messages" on public.facilitator_admin_messages;
create policy "Admins can manage facilitator admin messages"
  on public.facilitator_admin_messages
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Facilitators can create their own admin messages" on public.facilitator_admin_messages;
create policy "Facilitators can create their own admin messages"
  on public.facilitator_admin_messages
  for insert
  with check (
    exists (
      select 1
      from public.facilitator_profiles
      where facilitator_profiles.id = facilitator_admin_messages.facilitator_id
        and facilitator_profiles.profile_id = auth.uid()
    )
  );

drop policy if exists "Facilitators can view their own admin messages" on public.facilitator_admin_messages;
create policy "Facilitators can view their own admin messages"
  on public.facilitator_admin_messages
  for select
  using (
    exists (
      select 1
      from public.facilitator_profiles
      where facilitator_profiles.id = facilitator_admin_messages.facilitator_id
        and facilitator_profiles.profile_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
