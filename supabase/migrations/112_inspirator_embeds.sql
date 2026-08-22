create table if not exists public.inspirator_embeds (
  id uuid primary key default gen_random_uuid(),
  inspirator_id uuid not null references public.inspirator_profiles(id) on delete cascade,
  url text not null,
  title text,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inspirator_embeds enable row level security;

drop policy if exists "Public can view active inspirator embeds" on public.inspirator_embeds;
create policy "Public can view active inspirator embeds"
  on public.inspirator_embeds for select
  using (
    exists (
      select 1
      from public.inspirator_profiles
      where inspirator_profiles.id = inspirator_embeds.inspirator_id
        and inspirator_profiles.is_active = true
    )
  );

drop policy if exists "Admins can manage inspirator embeds" on public.inspirator_embeds;
create policy "Admins can manage inspirator embeds"
  on public.inspirator_embeds for all
  using (exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  ))
  with check (exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  ));

create index if not exists inspirator_embeds_profile_sort_idx
  on public.inspirator_embeds (inspirator_id, sort_order);
