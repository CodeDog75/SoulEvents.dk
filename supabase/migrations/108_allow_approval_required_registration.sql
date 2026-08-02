alter table public.facilitator_profiles
  add column if not exists allow_approval_required_registration boolean not null default false;

comment on column public.facilitator_profiles.allow_approval_required_registration is
  'Admin-controlled permission for using approval-required event registration. Defaults to false and only affects future event form choices.';

notify pgrst, 'reload schema';
