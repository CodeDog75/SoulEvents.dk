alter table public.facilitator_profiles
  add column if not exists facilitator_hero_key text;

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
      'custom'
    )
  );

comment on column public.facilitator_profiles.facilitator_hero_key is
  'Selected public profile hero. Null preserves legacy mood-image behavior until the facilitator chooses a fixed SoulEvents hero.';
