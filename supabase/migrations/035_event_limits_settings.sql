insert into site_settings (key, value)
values
  ('max_draft_events_per_facilitator', '5'),
  ('max_active_events_per_facilitator', '10')
on conflict (key) do nothing;
