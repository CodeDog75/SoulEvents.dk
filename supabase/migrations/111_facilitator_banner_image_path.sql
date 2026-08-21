alter table public.facilitator_profiles
  add column if not exists facilitator_banner_image_path text;

comment on column public.facilitator_profiles.facilitator_banner_image_path is
  'Optional custom banner image path for public facilitator profiles. If null, SoulEvents default banner is shown.';

notify pgrst, 'reload schema';
