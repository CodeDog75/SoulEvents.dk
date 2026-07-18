alter table public.facilitator_profiles
  drop constraint if exists facilitator_profiles_specialties_length_check;

alter table public.facilitator_profiles
  add constraint facilitator_profiles_specialties_length_check
  check (specialties is null or char_length(btrim(specialties)) <= 150);
