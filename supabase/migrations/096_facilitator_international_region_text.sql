alter table public.facilitator_profiles
  add column if not exists region_text text;

comment on column public.facilitator_profiles.region_text is
  'Optional free-text region, area, state, or province for facilitator profiles outside Denmark.';

notify pgrst, 'reload schema';
