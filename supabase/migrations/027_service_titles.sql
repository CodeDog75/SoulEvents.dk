-- Admin-styrede behandlertitler / ydelsestyper til arrangørprofiler.

create table if not exists service_titles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger service_titles_set_updated_at
before update on service_titles
for each row execute function set_updated_at();

create table if not exists facilitator_service_titles (
  facilitator_id uuid not null references facilitator_profiles(id) on delete cascade,
  service_title_id uuid not null references service_titles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (facilitator_id, service_title_id)
);

alter table facilitator_profiles
  add column if not exists offers_services boolean not null default false,
  add column if not exists service_description text,
  add column if not exists service_other_title text,
  add column if not exists show_in_local_service_results boolean not null default false;

create index if not exists service_titles_active_sort_idx on service_titles(is_active, sort_order);
create index if not exists facilitator_service_titles_facilitator_idx on facilitator_service_titles(facilitator_id);
create index if not exists facilitator_profiles_services_idx on facilitator_profiles(offers_services, show_in_local_service_results, status);

alter table service_titles enable row level security;
alter table facilitator_service_titles enable row level security;

drop policy if exists "Public can read active service titles" on service_titles;
create policy "Public can read active service titles"
on service_titles for select
using (is_active = true or public.is_admin());

drop policy if exists "Admins manage service titles" on service_titles;
create policy "Admins manage service titles"
on service_titles for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read facilitator service titles" on facilitator_service_titles;
create policy "Public can read facilitator service titles"
on facilitator_service_titles for select
using (true);

drop policy if exists "Facilitators manage own service titles" on facilitator_service_titles;
create policy "Facilitators manage own service titles"
on facilitator_service_titles for all
using (
  exists (
    select 1
    from facilitator_profiles fp
    where fp.id = facilitator_service_titles.facilitator_id
      and fp.profile_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from facilitator_profiles fp
    where fp.id = facilitator_service_titles.facilitator_id
      and fp.profile_id = auth.uid()
  )
);

drop policy if exists "Admins manage facilitator service titles" on facilitator_service_titles;
create policy "Admins manage facilitator service titles"
on facilitator_service_titles for all
using (public.is_admin())
with check (public.is_admin());

insert into service_titles (name, slug, sort_order) values
  ('Healer', 'healer', 10),
  ('Coach', 'coach', 20),
  ('Terapeut', 'terapeut', 30),
  ('Massør', 'massor', 40),
  ('Kranio-sakral terapeut', 'kranio-sakral-terapeut', 50),
  ('Gusmester', 'gusmester', 60),
  ('Yogalærer', 'yogalaerer', 70),
  ('Meditationslærer', 'meditationslaerer', 80),
  ('Lydterapeut', 'lydterapeut', 90),
  ('Musiker', 'musiker', 100),
  ('Ceremonileder', 'ceremonileder', 110),
  ('Kropsbehandler', 'kropsbehandler', 120),
  ('Åndedrætsterapeut', 'aandedraetsterapeut', 130),
  ('Underviser', 'underviser', 140),
  ('Mentor', 'mentor', 150)
on conflict (slug) do nothing;

notify pgrst, 'reload schema';
