alter table public.facilitator_admin_messages
  add column if not exists facilitator_read_at timestamptz;

notify pgrst, 'reload schema';
