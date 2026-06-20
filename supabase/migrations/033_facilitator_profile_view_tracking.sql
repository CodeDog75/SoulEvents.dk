create table if not exists public.facilitator_profile_views (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null references public.facilitator_profiles(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index if not exists facilitator_profile_views_facilitator_viewed_at_idx
  on public.facilitator_profile_views(facilitator_id, viewed_at);

alter table public.facilitator_profile_views enable row level security;

drop policy if exists "Admins can read facilitator profile views" on public.facilitator_profile_views;
create policy "Admins can read facilitator profile views"
on public.facilitator_profile_views for select
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);
