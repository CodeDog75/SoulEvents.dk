create table if not exists public.facilitator_work_area_suggestions (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null references public.facilitator_profiles(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  suggestion_text text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint facilitator_work_area_suggestions_status_check
    check (status in ('pending', 'approved', 'rejected')),
  constraint facilitator_work_area_suggestions_text_length_check
    check (char_length(btrim(suggestion_text)) between 2 and 120)
);

create index if not exists facilitator_work_area_suggestions_facilitator_idx
  on public.facilitator_work_area_suggestions (facilitator_id);

create index if not exists facilitator_work_area_suggestions_status_idx
  on public.facilitator_work_area_suggestions (status);

create unique index if not exists facilitator_work_area_suggestions_pending_unique_idx
  on public.facilitator_work_area_suggestions (facilitator_id, lower(btrim(suggestion_text)))
  where status = 'pending';

alter table public.facilitator_work_area_suggestions enable row level security;

drop policy if exists "Facilitators read own work area suggestions" on public.facilitator_work_area_suggestions;
create policy "Facilitators read own work area suggestions"
  on public.facilitator_work_area_suggestions
  for select
  using (profile_id = auth.uid());

drop policy if exists "Facilitators create own work area suggestions" on public.facilitator_work_area_suggestions;
create policy "Facilitators create own work area suggestions"
  on public.facilitator_work_area_suggestions
  for insert
  with check (profile_id = auth.uid());

drop policy if exists "Admins manage work area suggestions" on public.facilitator_work_area_suggestions;
create policy "Admins manage work area suggestions"
  on public.facilitator_work_area_suggestions
  for all
  using (private.is_admin())
  with check (private.is_admin());
