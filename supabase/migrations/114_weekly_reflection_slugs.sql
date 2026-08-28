alter table public.weekly_reflections
  add column if not exists slug text,
  add column if not exists published_at timestamptz;

do $$
declare
  reflection record;
  base_slug text;
  candidate_slug text;
  suffix integer;
begin
  for reflection in
    select id, title
    from public.weekly_reflections
    where slug is null
    order by created_at, id
  loop
    base_slug := lower(coalesce(nullif(trim(reflection.title), ''), 'ugens-refleksion'));
    base_slug := replace(replace(replace(base_slug, 'æ', 'ae'), 'ø', 'oe'), 'å', 'aa');
    base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
    base_slug := regexp_replace(base_slug, '(^-|-$)', '', 'g');

    if base_slug = '' then
      base_slug := 'ugens-refleksion';
    end if;

    candidate_slug := base_slug;
    suffix := 2;

    while exists (
      select 1
      from public.weekly_reflections
      where slug = candidate_slug
        and id <> reflection.id
    ) loop
      candidate_slug := base_slug || '-' || suffix;
      suffix := suffix + 1;
    end loop;

    update public.weekly_reflections
    set slug = candidate_slug
    where id = reflection.id;
  end loop;
end $$;

update public.weekly_reflections
set published_at = coalesce(created_at, now())
where published_at is null
  and is_active = true
  and (start_date is null or start_date <= current_date);

create unique index if not exists weekly_reflections_slug_unique_idx
on public.weekly_reflections (slug)
where slug is not null;

create index if not exists weekly_reflections_public_archive_idx
on public.weekly_reflections (published_at desc, created_at desc)
where published_at is not null;

create or replace function public.set_weekly_reflection_public_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_slug text;
  candidate_slug text;
  suffix integer;
begin
  if new.slug is null or trim(new.slug) = '' then
    base_slug := lower(coalesce(nullif(trim(new.title), ''), 'ugens-refleksion'));
    base_slug := replace(replace(replace(base_slug, 'æ', 'ae'), 'ø', 'oe'), 'å', 'aa');
    base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
    base_slug := regexp_replace(base_slug, '(^-|-$)', '', 'g');

    if base_slug = '' then
      base_slug := 'ugens-refleksion';
    end if;

    candidate_slug := base_slug;
    suffix := 2;

    while exists (
      select 1
      from public.weekly_reflections
      where slug = candidate_slug
        and id <> new.id
    ) loop
      candidate_slug := base_slug || '-' || suffix;
      suffix := suffix + 1;
    end loop;

    new.slug := candidate_slug;
  end if;

  if new.published_at is not null then
    return new;
  end if;

  if new.is_active = true and (new.start_date is null or new.start_date <= current_date) then
    new.published_at := now();
  elsif tg_op = 'UPDATE'
    and old.is_active = true
    and (old.start_date is null or old.start_date <= current_date)
    and new.is_active = false then
    new.published_at := now();
  end if;

  return new;
end $$;

drop trigger if exists weekly_reflections_set_public_fields on public.weekly_reflections;
create trigger weekly_reflections_set_public_fields
before insert or update of title, is_active, slug, published_at, start_date
on public.weekly_reflections
for each row
execute function public.set_weekly_reflection_public_fields();

drop policy if exists "Public can read active weekly reflections" on public.weekly_reflections;
drop policy if exists "Public can read published weekly reflections" on public.weekly_reflections;
create policy "Public can read published weekly reflections"
on public.weekly_reflections for select
using (
  (published_at is not null or is_active = true)
  and (start_date is null or start_date <= current_date)
);
