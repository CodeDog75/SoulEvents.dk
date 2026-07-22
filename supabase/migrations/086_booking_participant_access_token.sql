alter table public.bookings
  add column if not exists participant_access_token text not null default encode(gen_random_bytes(32), 'hex');

create unique index if not exists bookings_participant_access_token_key
on public.bookings(participant_access_token);

comment on column public.bookings.participant_access_token is
  'Secure participant-facing token for booking cancellation and calendar access without participant login.';
