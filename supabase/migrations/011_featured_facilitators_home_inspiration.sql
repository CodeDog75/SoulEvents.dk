alter table facilitator_profiles
add column if not exists is_featured boolean not null default false,
add column if not exists featured_sort_order int not null default 0,
add column if not exists approved_at timestamptz;

update facilitator_profiles
set approved_at = coalesce(approved_at, updated_at, created_at)
where status = 'approved' and approved_at is null;

insert into homepage_tiles (title, description, href, tile_type, sort_order) values
('Fuldmåne-events', 'Ceremonier, cirkler og oplevelser omkring fuldmånen.', '/?q=fuldmåne#events', 'campaign', 210),
('Populære saunagus-events', 'Varme, ro og velvære i saunaen.', '/?category_label=Saunagus#events', 'campaign', 220),
('Retreats denne måned', 'Find retreats og fordybende ophold i den kommende tid.', '/?category_label=Retreat#events', 'campaign', 230),
('Lydbade og lydhealing', 'Blide lydoplevelser, gong, klang og nærvær.', '/?category_label=Lydbad#events', 'campaign', 240),
('Online meditationer', 'Meditation og nærvær, du kan deltage i hjemmefra.', '/?format=online#events', 'campaign', 250)
on conflict do nothing;
