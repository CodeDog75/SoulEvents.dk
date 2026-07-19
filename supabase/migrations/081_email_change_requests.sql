create table if not exists public.email_change_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  facilitator_id uuid references public.facilitator_profiles(id) on delete set null,
  requested_by_profile_id uuid references public.profiles(id) on delete set null,
  requested_by_role public.app_role not null,
  old_email text not null,
  new_email text not null,
  admin_reason text,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_change_requests_status_check check (status in ('pending', 'completed', 'cancelled', 'expired')),
  constraint email_change_requests_distinct_email_check check (lower(old_email) <> lower(new_email)),
  constraint email_change_requests_reason_length_check check (admin_reason is null or char_length(admin_reason) <= 500)
);

create unique index if not exists email_change_requests_one_pending_per_profile_idx
  on public.email_change_requests (profile_id)
  where status = 'pending';

create unique index if not exists email_change_requests_one_pending_new_email_idx
  on public.email_change_requests (lower(new_email))
  where status = 'pending';

create index if not exists email_change_requests_facilitator_idx
  on public.email_change_requests (facilitator_id, requested_at desc);

create index if not exists email_change_requests_expiry_idx
  on public.email_change_requests (status, expires_at);

drop trigger if exists set_email_change_requests_updated_at on public.email_change_requests;
create trigger set_email_change_requests_updated_at
  before update on public.email_change_requests
  for each row
  execute function public.set_updated_at();

alter table public.email_change_requests enable row level security;

revoke all on public.email_change_requests from anon;
revoke all on public.email_change_requests from authenticated;

drop policy if exists "Admins can manage email change requests" on public.email_change_requests;
create policy "Admins can manage email change requests"
  on public.email_change_requests
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'::public.app_role
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'::public.app_role
    )
  );

drop policy if exists "Facilitators can read own email change requests" on public.email_change_requests;
create policy "Facilitators can read own email change requests"
  on public.email_change_requests
  for select
  to authenticated
  using (profile_id = auth.uid());

grant all on public.email_change_requests to service_role;
