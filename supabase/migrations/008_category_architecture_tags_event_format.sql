create table if not exists main_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_path text,
  color_hex text not null default '#87A878',
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists subcategories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_path text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists subcategory_main_categories (
  subcategory_id uuid not null references subcategories(id) on delete cascade,
  main_category_id uuid not null references main_categories(id) on delete cascade,
  primary key (subcategory_id, main_category_id)
);

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table events add column if not exists event_format text not null default 'physical';
alter table events add column if not exists online_description text;
alter table events add column if not exists online_url_or_note text;
alter table events add column if not exists country text not null default 'Danmark';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'events_event_format_check'
  ) then
    alter table events add constraint events_event_format_check
    check (event_format in ('physical', 'online', 'hybrid'));
  end if;
end $$;

create table if not exists event_main_categories (
  event_id uuid not null references events(id) on delete cascade,
  main_category_id uuid not null references main_categories(id) on delete restrict,
  primary key (event_id, main_category_id)
);

create table if not exists event_subcategories (
  event_id uuid not null references events(id) on delete cascade,
  subcategory_id uuid not null references subcategories(id) on delete restrict,
  primary key (event_id, subcategory_id)
);

create table if not exists event_tags (
  event_id uuid not null references events(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete restrict,
  primary key (event_id, tag_id)
);

create trigger main_categories_set_updated_at
before update on main_categories
for each row execute function set_updated_at();

create trigger subcategories_set_updated_at
before update on subcategories
for each row execute function set_updated_at();

create trigger tags_set_updated_at
before update on tags
for each row execute function set_updated_at();

alter table main_categories enable row level security;
alter table subcategories enable row level security;
alter table subcategory_main_categories enable row level security;
alter table tags enable row level security;
alter table event_main_categories enable row level security;
alter table event_subcategories enable row level security;
alter table event_tags enable row level security;

create policy "Public can read active main categories"
on main_categories for select
using (is_active = true or public.is_admin());

create policy "Public can read active subcategories"
on subcategories for select
using (is_active = true or public.is_admin());

create policy "Public can read subcategory relations"
on subcategory_main_categories for select
using (true);

create policy "Public can read active tags"
on tags for select
using (is_active = true or public.is_admin());

create policy "Public can read event main categories"
on event_main_categories for select
using (true);

create policy "Public can read event subcategories"
on event_subcategories for select
using (true);

create policy "Public can read event tags"
on event_tags for select
using (true);

create policy "Admins manage main categories"
on main_categories for all using (public.is_admin()) with check (public.is_admin());

create policy "Admins manage subcategories"
on subcategories for all using (public.is_admin()) with check (public.is_admin());

create policy "Admins manage subcategory relations"
on subcategory_main_categories for all using (public.is_admin()) with check (public.is_admin());

create policy "Admins manage tags"
on tags for all using (public.is_admin()) with check (public.is_admin());

create policy "Facilitators manage event main categories"
on event_main_categories for all
using (
  public.is_admin() or exists (
    select 1 from events e
    join facilitator_profiles fp on fp.id = e.facilitator_id
    where e.id = event_main_categories.event_id and fp.profile_id = auth.uid()
  )
)
with check (
  public.is_admin() or exists (
    select 1 from events e
    join facilitator_profiles fp on fp.id = e.facilitator_id
    where e.id = event_main_categories.event_id and fp.profile_id = auth.uid()
  )
);

create policy "Facilitators manage event subcategories"
on event_subcategories for all
using (
  public.is_admin() or exists (
    select 1 from events e
    join facilitator_profiles fp on fp.id = e.facilitator_id
    where e.id = event_subcategories.event_id and fp.profile_id = auth.uid()
  )
)
with check (
  public.is_admin() or exists (
    select 1 from events e
    join facilitator_profiles fp on fp.id = e.facilitator_id
    where e.id = event_subcategories.event_id and fp.profile_id = auth.uid()
  )
);

create policy "Facilitators manage event tags"
on event_tags for all
using (
  public.is_admin() or exists (
    select 1 from events e
    join facilitator_profiles fp on fp.id = e.facilitator_id
    where e.id = event_tags.event_id and fp.profile_id = auth.uid()
  )
)
with check (
  public.is_admin() or exists (
    select 1 from events e
    join facilitator_profiles fp on fp.id = e.facilitator_id
    where e.id = event_tags.event_id and fp.profile_id = auth.uid()
  )
);

insert into main_categories (name, slug, description, sort_order) values
('Meditation & Nærvær', 'meditation-naervaer', 'Meditation, mindfulness og nærværende praksisser.', 10),
('Bevægelse & Krop', 'bevaegelse-krop', 'Yoga, dans og kropslige praksisser.', 20),
('Lyd & Musik', 'lyd-musik', 'Lydbad, kirtan, gong og musikalske oplevelser.', 30),
('Ceremonier & Ritualer', 'ceremonier-ritualer', 'Cirkler, ritualer og ceremonielle fællesskaber.', 40),
('Breathwork & Energiarbejde', 'breathwork-energiarbejde', 'Åndedræt, healing og energiarbejde.', 50),
('Natur & Retreats', 'natur-retreats', 'Retreats, naturforløb og fordybelse.', 60),
('Personlig Udvikling', 'personlig-udvikling', 'Selvudvikling, coaching og læring.', 70),
('Sauna & Velvære', 'sauna-velvaere', 'Saunagus, velvære og sanselige pauser.', 80)
on conflict (slug) do nothing;

insert into subcategories (name, slug, sort_order) values
('Mindfulness', 'mindfulness', 10),
('Guidet meditation', 'guidet-meditation', 20),
('Lydbad', 'lydbad', 30),
('Gongbad', 'gongbad', 40),
('Klangskåle', 'klangskaale', 50),
('Ecstatic Dance', 'ecstatic-dance', 60),
('Intuitiv dans', 'intuitiv-dans', 70),
('Yoga', 'yoga', 80),
('Saunagus', 'saunagus', 90),
('Reiki', 'reiki', 100),
('Kirtan', 'kirtan', 110),
('Trommerejse', 'trommerejse', 120),
('Kvindecirkel', 'kvindecirkel', 130),
('Mandsgruppe', 'mandsgruppe', 140),
('Fuldmåneceremoni', 'fuldmaane-ceremoni', 150)
on conflict (slug) do nothing;

insert into tags (name, slug, sort_order) values
('Begyndervenlig', 'begyndervenlig', 10),
('Udendørs', 'udendoers', 20),
('Online', 'online', 30),
('Gratis', 'gratis', 40),
('Fuldmåne', 'fuldmaane', 50),
('Weekend', 'weekend', 60),
('Dansk', 'dansk', 70),
('Engelsk', 'engelsk', 80),
('Kvinder', 'kvinder', 90),
('Mænd', 'maend', 100),
('Par', 'par', 110),
('Familie', 'familie', 120),
('Retreat', 'retreat', 130),
('Natur', 'natur', 140),
('Healing', 'healing', 150),
('Energiarbejde', 'energiarbejde', 160),
('Aften', 'aften', 170)
on conflict (slug) do nothing;
