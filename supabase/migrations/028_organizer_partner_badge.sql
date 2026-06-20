alter table public.facilitator_profiles
  add column if not exists is_partner boolean not null default false;

comment on column public.facilitator_profiles.is_partner is 'Viser SoulEvents Partner-badge på arrangørkort, arrangørprofil og eventsider.';
