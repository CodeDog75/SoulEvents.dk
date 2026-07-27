alter table public.events
  add column if not exists dashboard_hidden_at timestamptz;

comment on column public.events.dashboard_hidden_at is
  'Set when the event owner hides an ended or cancelled event from their facilitator dashboard. Public event pages, history and retention remain unchanged.';

create index if not exists events_facilitator_dashboard_visible_idx
  on public.events(facilitator_id, starts_at desc)
  where dashboard_hidden_at is null;

create index if not exists events_facilitator_dashboard_hidden_idx
  on public.events(facilitator_id, dashboard_hidden_at desc)
  where dashboard_hidden_at is not null;

notify pgrst, 'reload schema';
