create table if not exists event_exposure_stats (
  event_id uuid primary key references events(id) on delete cascade,
  facilitator_id uuid not null references facilitator_profiles(id) on delete cascade,
  event_view_count int not null default 0,
  facilitator_view_count int not null default 0,
  last_shown_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger event_exposure_stats_set_updated_at
before update on event_exposure_stats
for each row execute function set_updated_at();

alter table event_exposure_stats enable row level security;

create policy "Admins can manage event exposure stats"
on event_exposure_stats for all
using (public.is_admin())
with check (public.is_admin());
