alter table public.facilitator_profiles
  add column if not exists is_active_host boolean not null default false;

comment on column public.facilitator_profiles.is_active_host is
  'Admin-styret badge for arrangører, der løbende opretter events på SoulEvents.';

notify pgrst, 'reload schema';
