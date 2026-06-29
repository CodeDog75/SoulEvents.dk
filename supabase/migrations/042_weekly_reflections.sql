create table if not exists weekly_reflections (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Ugens refleksion',
  reflection_text text not null,
  author text,
  background_color text not null default '#FAF6EF',
  is_active boolean not null default false,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_reflections_background_color_check check (background_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint weekly_reflections_date_order_check check (end_date is null or start_date is null or end_date >= start_date)
);

drop trigger if exists weekly_reflections_set_updated_at on weekly_reflections;
create trigger weekly_reflections_set_updated_at
before update on weekly_reflections
for each row execute function set_updated_at();

create index if not exists weekly_reflections_public_active_idx
on weekly_reflections (is_active, start_date, end_date, updated_at desc);

alter table weekly_reflections enable row level security;

drop policy if exists "Public can read active weekly reflections" on weekly_reflections;
create policy "Public can read active weekly reflections"
on weekly_reflections for select
using (
  is_active = true
  and (start_date is null or start_date <= current_date)
  and (end_date is null or end_date >= current_date)
);

drop policy if exists "Admins manage weekly reflections" on weekly_reflections;
create policy "Admins manage weekly reflections"
on weekly_reflections for all
using (private.is_admin())
with check (private.is_admin());
