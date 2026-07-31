alter table public.facilitator_profiles
  add column if not exists show_public_location boolean not null default true;

comment on column public.facilitator_profiles.show_public_location is
  'Controls whether postal code and city/area are shown on the public facilitator profile and public facilitator cards.';

notify pgrst, 'reload schema';
