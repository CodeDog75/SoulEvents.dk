update public.facilitator_profiles
set specialties = nullif(btrim(regexp_replace(specialties, '\s+', ' ', 'g')), '')
where specialties is not null
  and specialties is distinct from nullif(btrim(regexp_replace(specialties, '\s+', ' ', 'g')), '');

alter table public.facilitator_profiles
  drop constraint if exists facilitator_profiles_specialties_length_check;

alter table public.facilitator_profiles
  add constraint facilitator_profiles_specialties_length_check
  check (specialties is null or char_length(btrim(specialties)) <= 180);
