alter table public.facilitator_profiles
  add column if not exists is_experienced_host boolean not null default false;

comment on column public.facilitator_profiles.is_experienced_host is
  'Admin-styret badge for arrangører med erfaring fra afholdte events og tilmeldinger på SoulEvents.';

notify pgrst, 'reload schema';
