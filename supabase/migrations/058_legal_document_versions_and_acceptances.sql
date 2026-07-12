do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'legal_document_type'
      and n.nspname = 'public'
  ) then
    create type public.legal_document_type as enum ('terms', 'privacy', 'guidelines');
  end if;
end $$;

create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  type public.legal_document_type not null unique,
  title text not null,
  slug text not null unique,
  body text not null default '',
  is_published boolean not null default true,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.legal_documents
add column if not exists version text not null default '1.0',
add column if not exists effective_at timestamptz,
add column if not exists requires_acceptance boolean not null default true,
add column if not exists current_version_id uuid;

do $$
begin
  alter type public.legal_document_type add value if not exists 'organizer_terms';
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter type public.legal_document_type add value if not exists 'cookies';
exception
  when duplicate_object then null;
end $$;

alter table public.legal_documents enable row level security;

drop policy if exists "Public can read published legal documents" on public.legal_documents;
create policy "Public can read published legal documents"
on public.legal_documents for select
using (
  is_published = true
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins manage legal documents" on public.legal_documents;
create policy "Admins manage legal documents"
on public.legal_documents for all
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

insert into public.legal_documents (type, title, slug, body, is_published, published_at, effective_at, version, requires_acceptance)
values
  (
    'terms',
    'Handelsbetingelser',
    'handelsbetingelser',
    'Indsæt handelsbetingelser for SoulEvents.dk her.',
    true,
    now(),
    now(),
    '1.0',
    true
  ),
  (
    'privacy',
    'Privatlivspolitik',
    'privatlivspolitik',
    'Indsæt privatlivspolitik for SoulEvents.dk her.',
    true,
    now(),
    now(),
    '1.0',
    false
  ),
  (
    'guidelines',
    'SoulEvents retningslinjer',
    'platformens-retningslinjer',
    'Indsæt SoulEvents retningslinjer her.',
    true,
    now(),
    now(),
    '1.0',
    true
  )
on conflict (type) do nothing;

create table if not exists public.legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.legal_documents(id) on delete cascade,
  document_type public.legal_document_type not null,
  title text not null,
  slug text not null,
  body text not null,
  version text not null,
  published_at timestamptz not null default now(),
  effective_at timestamptz not null default now(),
  requires_acceptance boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(document_id, version)
);

alter table public.legal_document_versions enable row level security;

drop policy if exists "Public can read published legal document versions" on public.legal_document_versions;
create policy "Public can read published legal document versions"
on public.legal_document_versions for select
using (
  effective_at <= now()
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can insert legal document versions" on public.legal_document_versions;
create policy "Admins can insert legal document versions"
on public.legal_document_versions for insert
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can read all legal document versions" on public.legal_document_versions;
create policy "Admins can read all legal document versions"
on public.legal_document_versions for select
using (
  effective_at <= now()
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

create or replace function public.prevent_legal_document_version_changes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Published legal document versions are immutable';
end;
$$;

drop trigger if exists legal_document_versions_prevent_update on public.legal_document_versions;
create trigger legal_document_versions_prevent_update
before update or delete on public.legal_document_versions
for each row execute function public.prevent_legal_document_version_changes();

insert into public.legal_document_versions (
  document_id,
  document_type,
  title,
  slug,
  body,
  version,
  published_at,
  effective_at,
  requires_acceptance
)
select
  id,
  type,
  title,
  slug,
  body,
  coalesce(nullif(version, ''), '1.0'),
  coalesce(published_at, created_at, now()),
  coalesce(effective_at, published_at, created_at, now()),
  requires_acceptance
from public.legal_documents
where is_published = true
on conflict (document_id, version) do nothing;

update public.legal_documents d
set
  current_version_id = v.id,
  effective_at = coalesce(d.effective_at, v.effective_at),
  published_at = coalesce(d.published_at, v.published_at)
from public.legal_document_versions v
where v.document_id = d.id
  and v.version = d.version
  and d.current_version_id is null;

create table if not exists public.legal_document_acceptances (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  document_version_id uuid not null references public.legal_document_versions(id) on delete restrict,
  document_type public.legal_document_type not null,
  version text not null,
  action text not null,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(profile_id, document_version_id, action)
);

alter table public.legal_document_acceptances enable row level security;

drop policy if exists "Users can read own legal acceptances" on public.legal_document_acceptances;
create policy "Users can read own legal acceptances"
on public.legal_document_acceptances for select
using (
  profile_id = auth.uid()
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Users can insert own legal acceptances" on public.legal_document_acceptances;
create policy "Users can insert own legal acceptances"
on public.legal_document_acceptances for insert
with check (
  profile_id = auth.uid()
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can manage legal acceptances" on public.legal_document_acceptances;
create policy "Admins can manage legal acceptances"
on public.legal_document_acceptances for all
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

create table if not exists public.booking_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  participant_email text not null,
  terms_document_version_id uuid references public.legal_document_versions(id) on delete restrict,
  privacy_document_version_id uuid references public.legal_document_versions(id) on delete restrict,
  guidelines_document_version_id uuid references public.legal_document_versions(id) on delete restrict,
  event_terms_snapshot text,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(booking_id)
);

alter table public.booking_legal_acceptances enable row level security;

drop policy if exists "Admins can read booking legal acceptances" on public.booking_legal_acceptances;
create policy "Admins can read booking legal acceptances"
on public.booking_legal_acceptances for select
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Service role inserts booking legal acceptances" on public.booking_legal_acceptances;
create policy "Service role inserts booking legal acceptances"
on public.booking_legal_acceptances for insert
with check (false);
