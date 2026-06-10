create type homepage_tile_type as enum ('navigation', 'category', 'campaign', 'nearby');

create table if not exists homepage_tiles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  image_path text,
  href text not null default '/#events',
  tile_type homepage_tile_type not null default 'navigation',
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger homepage_tiles_set_updated_at
before update on homepage_tiles
for each row execute function set_updated_at();

alter table homepage_tiles enable row level security;

create policy "Public can read active homepage tiles"
on homepage_tiles for select
using (is_active = true or public.is_admin());

create policy "Admins manage homepage tiles"
on homepage_tiles for all
using (public.is_admin())
with check (public.is_admin());

insert into homepage_tiles (title, description, href, tile_type, sort_order) values
('Events nær dig', 'Find oplevelser tæt på din aktuelle placering.', '/#events', 'nearby', 10),
('Alle events på kort', 'Udforsk events visuelt på kortet.', '/#map', 'navigation', 20),
('Online events', 'Find events du kan deltage i hjemmefra.', '/?q=online#events', 'navigation', 30),
('Facilitatorer', 'Gå på opdagelse blandt SoulEvents facilitatorer.', '/#facilitators', 'navigation', 40),
('Alle events', 'Se kommende events i kronologisk rækkefølge.', '/#events', 'navigation', 50),
('Meditation & Nærvær', 'Rolige events med meditation, mindfulness og fordybelse.', '/?category_label=Meditation#events', 'category', 60),
('Lyd & Musik', 'Lydbade, kirtan, mantra og musikalske oplevelser.', '/?category_label=Lydbad#events', 'category', 70),
('Bevægelse & Krop', 'Yoga, breathwork, dans og kropslige praksisser.', '/?category_label=Yoga#events', 'category', 80),
('Ceremonier & Ritualer', 'Ritualer, cirkler og ceremonielle fællesskaber.', '/?category_label=Ceremoni#events', 'category', 90),
('Sauna & Velvære', 'Saunagus, sanselige pauser og velvære.', '/?category_label=Saunagus#events', 'category', 100)
on conflict do nothing;
