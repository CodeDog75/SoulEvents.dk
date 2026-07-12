alter table public.facilitator_profiles
  add column if not exists max_ticket_price_per_person integer default 1200;

alter table public.facilitator_profiles
  drop constraint if exists facilitator_profiles_max_ticket_price_per_person_check;

alter table public.facilitator_profiles
  add constraint facilitator_profiles_max_ticket_price_per_person_check
  check (max_ticket_price_per_person is null or max_ticket_price_per_person >= 0);

comment on column public.facilitator_profiles.max_ticket_price_per_person is
  'Maksimal billetpris i kroner pr. deltager. NULL betyder ingen beløbsgrænse.';
