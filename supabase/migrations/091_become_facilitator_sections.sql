create table if not exists public.become_facilitator_sections (
  id uuid primary key default gen_random_uuid(),
  section_key text not null,
  title text not null,
  body text not null,
  image_url text,
  image_path text,
  image_alt text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.become_facilitator_sections
  add column if not exists section_key text,
  add column if not exists title text not null default '',
  add column if not exists body text not null default '',
  add column if not exists image_url text,
  add column if not exists image_path text,
  add column if not exists image_alt text not null default '',
  add column if not exists sort_order integer not null default 0,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

update public.become_facilitator_sections
set section_key = id::text
where section_key is null;

alter table public.become_facilitator_sections
  alter column section_key set not null;

alter table public.become_facilitator_sections drop constraint if exists become_facilitator_sections_key_check;
alter table public.become_facilitator_sections add constraint become_facilitator_sections_key_check
  check (section_key in ('section_1', 'section_2', 'section_3'));

alter table public.become_facilitator_sections drop constraint if exists become_facilitator_sections_title_not_blank;
alter table public.become_facilitator_sections add constraint become_facilitator_sections_title_not_blank
  check (length(trim(title)) > 0);

alter table public.become_facilitator_sections drop constraint if exists become_facilitator_sections_body_not_blank;
alter table public.become_facilitator_sections add constraint become_facilitator_sections_body_not_blank
  check (length(trim(body)) > 0);

alter table public.become_facilitator_sections drop constraint if exists become_facilitator_sections_image_source_check;
alter table public.become_facilitator_sections add constraint become_facilitator_sections_image_source_check
  check (
    image_url is null
    or image_path is null
  );

create unique index if not exists become_facilitator_sections_section_key_key
  on public.become_facilitator_sections(section_key);

create index if not exists become_facilitator_sections_active_sort_idx
  on public.become_facilitator_sections(is_active, sort_order);

drop trigger if exists become_facilitator_sections_set_updated_at on public.become_facilitator_sections;
create trigger become_facilitator_sections_set_updated_at
before update on public.become_facilitator_sections
for each row execute function set_updated_at();

alter table public.become_facilitator_sections enable row level security;

drop policy if exists "Public can read active become facilitator sections" on public.become_facilitator_sections;
create policy "Public can read active become facilitator sections"
on public.become_facilitator_sections for select
to anon, authenticated
using (
  is_active = true
  or private.is_admin()
);

drop policy if exists "Admins can manage become facilitator sections" on public.become_facilitator_sections;
create policy "Admins can manage become facilitator sections"
on public.become_facilitator_sections for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

insert into public.become_facilitator_sections (
  section_key,
  title,
  body,
  image_url,
  image_path,
  image_alt,
  sort_order,
  is_active
)
values
  (
    'section_1',
    'Bliv fundet af de rigtige deltagere',
    'Se hvordan en arrangørprofil kan gøre dine events, ydelser og fællesskaber mere synlige på SoulEvents.',
    '/facilitator/arrangoer-praesentation-1.png',
    null,
    'Informationsgrafik om fordelene ved at blive arrangør på SoulEvents',
    1,
    true
  ),
  (
    'section_2',
    'Skab ro omkring dit eventflow',
    'En enkel visning af hvordan SoulEvents samler profil, events, tilmeldinger og dialog ét sted.',
    '/facilitator/arrangoer-praesentation-2.png',
    null,
    'Informationsgrafik om arrangørens eventflow på SoulEvents',
    2,
    true
  ),
  (
    'section_3',
    'Derfor vælger arrangører SoulEvents',
    'Se, hvordan SoulEvents hjælper dig med at blive fundet, opbygge et publikum og skabe overblik – så du kan bruge mere tid på det, du brænder for.',
    '/facilitator/soulevents-mere-end-eventplatform-newversion.png',
    null,
    'Informationsgrafik om hvorfor arrangører vælger SoulEvents',
    3,
    true
  )
on conflict (section_key) do nothing;
