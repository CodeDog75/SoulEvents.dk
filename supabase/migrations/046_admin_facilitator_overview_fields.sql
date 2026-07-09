alter table public.facilitator_profiles
  add column if not exists auto_approve_events boolean not null default false,
  add column if not exists is_featured boolean not null default false,
  add column if not exists featured_sort_order integer not null default 0,
  add column if not exists is_active_host boolean not null default false,
  add column if not exists is_experienced_host boolean not null default false;
