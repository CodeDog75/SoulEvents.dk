alter table public.tags
  add column if not exists color_hex text not null default '#87A878';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tags_color_hex_check'
  ) then
    alter table public.tags
      add constraint tags_color_hex_check
      check (color_hex ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end $$;

insert into public.tags (name, slug, description, color_hex, is_active, sort_order)
select
  categories.name,
  categories.slug,
  categories.description,
  categories.color_hex,
  categories.is_active,
  greatest(categories.sort_order, 0) + 1000
from public.categories
on conflict (slug) do update
set
  color_hex = excluded.color_hex,
  description = coalesce(public.tags.description, excluded.description),
  is_active = public.tags.is_active or excluded.is_active;

notify pgrst, 'reload schema';
