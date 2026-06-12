create table if not exists facilitator_event_reminders (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null references facilitator_profiles(id) on delete cascade,
  email text not null,
  status text not null default 'active' check (status in ('active', 'unsubscribed')),
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  unique (facilitator_id, email)
);

create table if not exists facilitator_event_reminder_notifications (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references facilitator_event_reminders(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (reminder_id, event_id)
);

alter table facilitator_event_reminders enable row level security;
alter table facilitator_event_reminder_notifications enable row level security;

drop policy if exists "Admins can manage facilitator event reminders" on facilitator_event_reminders;
create policy "Admins can manage facilitator event reminders"
  on facilitator_event_reminders
  for all
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

drop policy if exists "Facilitators can view their own event reminders" on facilitator_event_reminders;
create policy "Facilitators can view their own event reminders"
  on facilitator_event_reminders
  for select
  using (
    exists (
      select 1
      from facilitator_profiles
      where facilitator_profiles.id = facilitator_event_reminders.facilitator_id
        and facilitator_profiles.profile_id = auth.uid()
    )
  );

drop policy if exists "Admins can manage facilitator event reminder notifications" on facilitator_event_reminder_notifications;
create policy "Admins can manage facilitator event reminder notifications"
  on facilitator_event_reminder_notifications
  for all
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
