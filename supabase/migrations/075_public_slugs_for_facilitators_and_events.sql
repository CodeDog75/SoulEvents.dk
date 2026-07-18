create or replace function public.soulevents_slugify(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(lower(coalesce(input, '')),
              'æ', 'ae', 'g'),
            'ø', 'oe', 'g'),
          'å', 'aa', 'g'),
        '[^a-z0-9]+', '-', 'g'),
      '-+', '-', 'g'),
    '(^-|-$)', '', 'g'
  ));
$$;

create or replace function public.soulevents_unique_facilitator_slug(
  base_value text,
  current_id uuid default null
)
returns text
language plpgsql
as $$
declare
  base_slug text := coalesce(nullif(public.soulevents_slugify(base_value), ''), 'arrangoer');
  candidate text := base_slug;
  suffix int := 2;
begin
  while exists (
    select 1
    from public.facilitator_profiles
    where slug = candidate
      and (current_id is null or id <> current_id)
  ) loop
    candidate := base_slug || '-' || suffix::text;
    suffix := suffix + 1;
  end loop;

  return candidate;
end;
$$;

create or replace function public.soulevents_unique_event_slug(
  base_value text,
  current_id uuid default null
)
returns text
language plpgsql
as $$
declare
  base_slug text := coalesce(nullif(public.soulevents_slugify(base_value), ''), 'event');
  candidate text := base_slug;
  suffix int := 2;
begin
  while exists (
    select 1
    from public.events
    where slug = candidate
      and (current_id is null or id <> current_id)
  ) loop
    candidate := base_slug || '-' || suffix::text;
    suffix := suffix + 1;
  end loop;

  return candidate;
end;
$$;

alter table public.facilitator_profiles
  add column if not exists slug text;

do $$
declare
  row record;
  base_value text;
begin
  for row in
    select fp.id, fp.company_name, p.full_name, fp.host_reference_id
    from public.facilitator_profiles fp
    left join public.profiles p on p.id = fp.profile_id
    where fp.slug is null or btrim(fp.slug) = ''
    order by fp.created_at, fp.id
  loop
    base_value := coalesce(nullif(row.company_name, ''), nullif(row.full_name, ''), nullif(row.host_reference_id, ''), 'arrangoer');

    update public.facilitator_profiles
    set slug = public.soulevents_unique_facilitator_slug(base_value, row.id)
    where id = row.id;
  end loop;
end $$;

do $$
declare
  row record;
begin
  for row in
    select e.id, e.title, e.slug
    from public.events e
    where e.slug is null
       or btrim(e.slug) = ''
       or e.slug <> public.soulevents_slugify(e.slug)
       or exists (
         select 1
         from public.events duplicate
         where duplicate.slug = e.slug
           and duplicate.id <> e.id
       )
    order by e.created_at, e.id
  loop
    update public.events
    set slug = public.soulevents_unique_event_slug(coalesce(nullif(row.slug, ''), row.title, 'event'), row.id)
    where id = row.id;
  end loop;
end $$;

alter table public.facilitator_profiles
  alter column slug set not null;

drop index if exists facilitator_profiles_slug_unique_idx;
create unique index facilitator_profiles_slug_unique_idx
  on public.facilitator_profiles(slug);

drop index if exists events_slug_unique_idx;
create unique index events_slug_unique_idx
  on public.events(slug);

create index if not exists facilitator_profiles_public_slug_idx
  on public.facilitator_profiles(slug, status, is_paused, is_disabled);

create index if not exists events_public_slug_idx
  on public.events(slug, status, starts_at, ends_at);

create or replace function public.set_facilitator_profile_slug()
returns trigger
language plpgsql
as $$
declare
  profile_name text;
begin
  if new.slug is null or btrim(new.slug) = '' then
    select full_name into profile_name
    from public.profiles
    where id = new.profile_id;

    new.slug := public.soulevents_unique_facilitator_slug(
      coalesce(nullif(new.company_name, ''), nullif(profile_name, ''), nullif(new.host_reference_id, ''), 'arrangoer'),
      new.id
    );
  else
    new.slug := public.soulevents_unique_facilitator_slug(new.slug, new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists set_facilitator_profile_slug on public.facilitator_profiles;
create trigger set_facilitator_profile_slug
before insert on public.facilitator_profiles
for each row execute function public.set_facilitator_profile_slug();

comment on column public.facilitator_profiles.slug is
  'Public stable URL slug for arrangor profiles. Generated on create and kept stable unless changed manually by admin tooling.';

comment on column public.events.slug is
  'Public stable URL slug for events. Generated on create and kept stable unless changed manually by admin tooling.';
