alter table public.facilitator_admin_messages
  add column if not exists facilitator_read_at timestamptz,
  add column if not exists facilitator_hidden_at timestamptz;

comment on column public.facilitator_admin_messages.facilitator_read_at is
  'Set when the facilitator has read an admin reply in their Beskedcenter.';

comment on column public.facilitator_admin_messages.facilitator_hidden_at is
  'Set when a facilitator hides the message from their own Beskedcenter. Admin history and retention remain unchanged.';

create index if not exists facilitator_admin_messages_visible_unread_idx
  on public.facilitator_admin_messages(facilitator_id, type, status)
  where facilitator_hidden_at is null;

notify pgrst, 'reload schema';
