alter table public.bookings
  add column if not exists payment_reminder_sent_at timestamptz;
