alter table public.facilitator_profiles
  drop constraint if exists facilitator_profiles_facilitator_hero_key_check;

alter table public.facilitator_profiles
  add constraint facilitator_profiles_facilitator_hero_key_check
  check (
    facilitator_hero_key is null
    or facilitator_hero_key in (
      'soulevents_mist',
      'soulevents_sunrise',
      'soulevents_forest',
      'soulevents_lotus',
      'soulevents_meadow',
      'soulevents_fire',
      'mood_1',
      'mood_2',
      'mood_3',
      'custom'
    )
  );

comment on column public.facilitator_profiles.facilitator_hero_key is
  'Selected public profile hero. Use mood_1, mood_2 or mood_3 for facilitator mood images. The legacy custom value is interpreted as mood_1.';
