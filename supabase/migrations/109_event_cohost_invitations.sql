create table if not exists public.event_cohost_invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  inviter_profile_id uuid references public.profiles(id) on delete set null,
  inviter_facilitator_id uuid not null references public.facilitator_profiles(id) on delete cascade,
  email text not null,
  name text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'accepted_pending_profile_approval', 'declined', 'cancelled', 'expired')),
  token_hash text not null unique,
  invited_user_id uuid references public.profiles(id) on delete set null,
  invited_facilitator_id uuid references public.facilitator_profiles(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '30 days'),
  accepted_at timestamptz,
  declined_at timestamptz,
  cancelled_at timestamptz,
  last_sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_cohost_invitations_email_lower_check check (email = lower(email)),
  constraint event_cohost_invitations_status_dates_check check (
    (status <> 'accepted' or accepted_at is not null)
    and (status <> 'accepted_pending_profile_approval' or accepted_at is not null)
    and (status <> 'declined' or declined_at is not null)
    and (status <> 'cancelled' or cancelled_at is not null)
  )
);

create unique index if not exists event_cohost_invitations_active_email_unique
  on public.event_cohost_invitations (event_id, lower(email))
  where status in ('pending', 'accepted_pending_profile_approval');

create index if not exists event_cohost_invitations_event_status_idx
  on public.event_cohost_invitations (event_id, status, created_at desc);

create index if not exists event_cohost_invitations_email_status_idx
  on public.event_cohost_invitations (lower(email), status, expires_at);

create index if not exists event_cohost_invitations_invited_facilitator_idx
  on public.event_cohost_invitations (invited_facilitator_id, status);

create or replace function public.set_event_cohost_invitations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_event_cohost_invitations_updated_at on public.event_cohost_invitations;
create trigger set_event_cohost_invitations_updated_at
before update on public.event_cohost_invitations
for each row execute function public.set_event_cohost_invitations_updated_at();

alter table public.event_cohost_invitations enable row level security;

drop policy if exists "service role manages event cohost invitations" on public.event_cohost_invitations;
create policy "service role manages event cohost invitations"
on public.event_cohost_invitations
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

grant all on public.event_cohost_invitations to service_role;

notify pgrst, 'reload schema';
