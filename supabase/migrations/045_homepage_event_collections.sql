do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'homepage_event_collection_selection_mode'
  ) then
    create type homepage_event_collection_selection_mode as enum ('automatic', 'manual');
  end if;
end $$;

create table if not exists homepage_event_collections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  is_active boolean not null default false,
  sort_order integer not null default 0,
  show_on_mobile boolean not null default true,
  show_on_desktop boolean not null default true,
  selection_mode homepage_event_collection_selection_mode not null default 'automatic',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint homepage_event_collections_title_not_empty check (btrim(title) <> ''),
  constraint homepage_event_collections_visible_somewhere_check check (
    show_on_mobile = true
    or show_on_desktop = true
  )
);

drop trigger if exists homepage_event_collections_set_updated_at on homepage_event_collections;
create trigger homepage_event_collections_set_updated_at
  before update on homepage_event_collections
  for each row
  execute function set_updated_at();

create table if not exists homepage_event_collection_tags (
  collection_id uuid not null references homepage_event_collections(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (collection_id, tag_id)
);

create table if not exists homepage_event_collection_events (
  collection_id uuid not null references homepage_event_collections(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (collection_id, event_id)
);

create index if not exists homepage_event_collections_public_active_idx
  on homepage_event_collections (is_active, sort_order, updated_at desc)
  where is_active = true;

create index if not exists homepage_event_collection_tags_tag_idx
  on homepage_event_collection_tags (tag_id);

create index if not exists homepage_event_collection_events_event_idx
  on homepage_event_collection_events (event_id);

create index if not exists homepage_event_collection_events_sort_idx
  on homepage_event_collection_events (collection_id, sort_order);

alter table homepage_event_collections enable row level security;
alter table homepage_event_collection_tags enable row level security;
alter table homepage_event_collection_events enable row level security;

drop policy if exists "Public can read active homepage event collections" on homepage_event_collections;
create policy "Public can read active homepage event collections"
  on homepage_event_collections
  for select
  using (is_active = true or private.is_admin());

drop policy if exists "Admins manage homepage event collections" on homepage_event_collections;
create policy "Admins manage homepage event collections"
  on homepage_event_collections
  for all
  using (private.is_admin())
  with check (private.is_admin());

drop policy if exists "Public can read active homepage event collection tags" on homepage_event_collection_tags;
create policy "Public can read active homepage event collection tags"
  on homepage_event_collection_tags
  for select
  using (
    private.is_admin()
    or exists (
      select 1
      from homepage_event_collections
      where homepage_event_collections.id = homepage_event_collection_tags.collection_id
        and homepage_event_collections.is_active = true
    )
  );

drop policy if exists "Admins manage homepage event collection tags" on homepage_event_collection_tags;
create policy "Admins manage homepage event collection tags"
  on homepage_event_collection_tags
  for all
  using (private.is_admin())
  with check (private.is_admin());

drop policy if exists "Public can read active homepage event collection events" on homepage_event_collection_events;
create policy "Public can read active homepage event collection events"
  on homepage_event_collection_events
  for select
  using (
    private.is_admin()
    or exists (
      select 1
      from homepage_event_collections
      where homepage_event_collections.id = homepage_event_collection_events.collection_id
        and homepage_event_collections.is_active = true
    )
  );

drop policy if exists "Admins manage homepage event collection events" on homepage_event_collection_events;
create policy "Admins manage homepage event collection events"
  on homepage_event_collection_events
  for all
  using (private.is_admin())
  with check (private.is_admin());

with default_collections (title, sort_order, show_on_mobile, show_on_desktop) as (
  values
    ('Sauna & Velvære', 10, false, true),
    ('Yoga', 20, false, true),
    ('Meditation', 30, false, true),
    ('Retreats & Rejser', 40, true, true)
)
insert into homepage_event_collections (
  title,
  is_active,
  sort_order,
  show_on_mobile,
  show_on_desktop,
  selection_mode
)
select
  default_collections.title,
  true,
  default_collections.sort_order,
  default_collections.show_on_mobile,
  default_collections.show_on_desktop,
  'automatic'::homepage_event_collection_selection_mode
from default_collections
where not exists (
  select 1
  from homepage_event_collections
  where lower(homepage_event_collections.title) = lower(default_collections.title)
);

with default_collection_tags (title, tag_slug) as (
  values
    ('Sauna & Velvære', 'saunagus'),
    ('Yoga', 'yoga'),
    ('Meditation', 'guidet-meditation'),
    ('Retreats & Rejser', 'retreat')
)
insert into homepage_event_collection_tags (collection_id, tag_id)
select homepage_event_collections.id, tags.id
from default_collection_tags
join homepage_event_collections
  on lower(homepage_event_collections.title) = lower(default_collection_tags.title)
join tags
  on tags.slug = default_collection_tags.tag_slug
on conflict do nothing;
