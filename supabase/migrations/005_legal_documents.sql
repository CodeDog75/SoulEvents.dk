create type legal_document_type as enum ('terms', 'privacy', 'guidelines');

create table legal_documents (
  id uuid primary key default gen_random_uuid(),
  type legal_document_type not null unique,
  title text not null,
  slug text not null unique,
  body text not null default '',
  is_published boolean not null default true,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger legal_documents_set_updated_at
before update on legal_documents
for each row execute function set_updated_at();

alter table legal_documents enable row level security;

create policy "Public can read published legal documents"
on legal_documents for select
using (is_published = true or public.is_admin());

create policy "Admins manage legal documents"
on legal_documents for all
using (public.is_admin())
with check (public.is_admin());

insert into legal_documents (type, title, slug, body, is_published, published_at)
values
  (
    'terms',
    'Handelsbetingelser',
    'handelsbetingelser',
    'Indsæt handelsbetingelser for SoulEvents.dk her.',
    true,
    now()
  ),
  (
    'privacy',
    'Privatlivspolitik',
    'privatlivspolitik',
    'Indsæt privatlivspolitik for SoulEvents.dk her.',
    true,
    now()
  ),
  (
    'guidelines',
    'SoulEvents retningslinjer',
    'platformens-retningslinjer',
    'Indsæt SoulEvents retningslinjer her.',
    true,
    now()
  )
on conflict (type) do nothing;
