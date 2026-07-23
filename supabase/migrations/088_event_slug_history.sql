create table if not exists public.event_slug_history (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  slug text not null,
  created_at timestamptz not null default now(),
  constraint event_slug_history_slug_not_blank check (btrim(slug) <> '')
);

create unique index if not exists event_slug_history_slug_unique_idx
  on public.event_slug_history(slug);

create index if not exists event_slug_history_event_id_idx
  on public.event_slug_history(event_id);

create or replace function public.soulevents_unique_event_slug(
  base_value text,
  current_id uuid default null
)
returns text
language plpgsql
as $$
declare
  base_slug text := coalesce(nullif(public.soulevents_slugify(base_value), ''), 'event');
  candidate text := base_slug;
  suffix int := 2;
begin
  while exists (
    select 1
    from public.events
    where slug = candidate
      and (current_id is null or id <> current_id)
  ) or exists (
    select 1
    from public.event_slug_history
    where slug = candidate
      and (current_id is null or event_id <> current_id)
  ) loop
    candidate := base_slug || '-' || suffix::text;
    suffix := suffix + 1;
  end loop;

  return candidate;
end;
$$;

alter table public.event_slug_history enable row level security;

drop policy if exists "event slug history is publicly readable" on public.event_slug_history;
create policy "event slug history is publicly readable"
on public.event_slug_history
for select
using (true);

drop policy if exists "service role manages event slug history" on public.event_slug_history;
create policy "service role manages event slug history"
on public.event_slug_history
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

notify pgrst, 'reload schema';
