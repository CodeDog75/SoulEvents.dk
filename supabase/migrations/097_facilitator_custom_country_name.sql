alter table public.facilitator_profiles
  add column if not exists country_name text;

comment on column public.facilitator_profiles.country_name is
  'Optional free-text country name when country is stored as OTHER for facilitator profiles outside the supported European country list.';

notify pgrst, 'reload schema';
