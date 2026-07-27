alter table public.facilitator_admin_messages
  add column if not exists admin_hidden_at timestamptz;

comment on column public.facilitator_admin_messages.admin_hidden_at is
  'Set when an admin hides the message from the admin Beskedcenter. Facilitator history and retention remain unchanged.';

create index if not exists facilitator_admin_messages_admin_visible_idx
  on public.facilitator_admin_messages(facilitator_id, type, status, created_at desc)
  where admin_hidden_at is null;

notify pgrst, 'reload schema';
