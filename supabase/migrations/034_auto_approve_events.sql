alter table public.facilitator_profiles
  add column if not exists auto_approve_events boolean not null default false;

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  facilitator_id uuid references public.facilitator_profiles(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  action text not null,
  old_value text,
  new_value text,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_facilitator_created_at_idx
  on public.admin_audit_log(facilitator_id, created_at desc);

create index if not exists admin_audit_log_event_created_at_idx
  on public.admin_audit_log(event_id, created_at desc);

alter table public.admin_audit_log enable row level security;

drop policy if exists "Admins can read audit log" on public.admin_audit_log;
create policy "Admins can read audit log"
on public.admin_audit_log for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can insert audit log" on public.admin_audit_log;
create policy "Admins can insert audit log"
on public.admin_audit_log for insert
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);
