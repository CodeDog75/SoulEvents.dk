create table if not exists public.admin_event_change_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  facilitator_id uuid references public.facilitator_profiles(id) on delete set null,
  admin_profile_id uuid references public.profiles(id) on delete set null,
  changed_fields text[] not null default '{}',
  support_note text,
  note_visible_to_facilitator boolean not null default false,
  created_at timestamptz not null default now(),
  constraint admin_event_change_log_support_note_length check (
    support_note is null or char_length(support_note) <= 500
  )
);

create index if not exists admin_event_change_log_event_created_at_idx
  on public.admin_event_change_log(event_id, created_at desc);

create index if not exists admin_event_change_log_facilitator_created_at_idx
  on public.admin_event_change_log(facilitator_id, created_at desc);

alter table public.admin_event_change_log enable row level security;

drop policy if exists "Admins can read admin event change log" on public.admin_event_change_log;
create policy "Admins can read admin event change log"
on public.admin_event_change_log for select
using (private.is_admin());

drop policy if exists "Admins can insert admin event change log" on public.admin_event_change_log;
create policy "Admins can insert admin event change log"
on public.admin_event_change_log for insert
with check (private.is_admin());

drop policy if exists "Facilitators can read own admin event change log" on public.admin_event_change_log;
create policy "Facilitators can read own admin event change log"
on public.admin_event_change_log for select
using (
  exists (
    select 1
    from public.facilitator_profiles
    where facilitator_profiles.id = admin_event_change_log.facilitator_id
      and facilitator_profiles.profile_id = auth.uid()
  )
);

notify pgrst, 'reload schema';
