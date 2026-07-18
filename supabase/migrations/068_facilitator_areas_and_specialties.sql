alter table public.facilitator_profiles
  add column if not exists specialties text;

alter table public.facilitator_profiles
  drop constraint if exists facilitator_profiles_specialties_length_check;

alter table public.facilitator_profiles
  add constraint facilitator_profiles_specialties_length_check
  check (specialties is null or char_length(btrim(specialties)) <= 160);

with new_categories(name, slug, description, color_hex, icon_name, sort_order) as (
  values
    ('Yoga', 'yoga', 'yogalærer, yin yoga, hatha, ashtanga, kundalini', '#87A878', 'leaf', 10),
    ('Meditation', 'meditation', 'mindfulness, guidede meditationer, stilhedsmeditation', '#87A878', 'moon', 20),
    ('Breathwork', 'breathwork', 'breathwork, åndedrætsterapi, rebirthing', '#87A878', 'waves', 30),
    ('Lyd & vibration', 'lyd-vibration', 'lydbad, gong, syngeskåle, frekvensterapi', '#87A878', 'music', 40),
    ('Ceremonier & ritualer', 'ceremonier-ritualer', 'cacao, kakao, fuldmåne, årshjul, ritualer', '#87A878', 'flower-2', 50),
    ('Natur & udeliv', 'natur-udeliv', 'naturterapi, skovbadning, vandring, bushcraft, vildmarksoplevelser', '#87A878', 'leaf', 60),
    ('Sauna & kulde', 'sauna-kulde', 'saunagus, isbad, kuldetræning', '#87A878', 'flame', 70),
    ('Kropsbehandling', 'kropsbehandling', 'massage, kraniosakral, zoneterapi, bindevæv, akupressur, fysiurgisk massage', '#87A878', 'hand-heart', 80),
    ('Energi & healing', 'energi-healing', 'Reiki, healing, healingmassage, chakra, pranic healing, magnetisme', '#87A878', 'sparkles', 90),
    ('Personlig udvikling', 'personlig-udvikling', 'coaching, mentor, psykoterapi, traumeterapi, ACT, NLP, psykolog, samtaleterapi', '#87A878', 'brain', 100),
    ('Spiritualitet & bevidsthed', 'spiritualitet-bevidsthed', 'clairvoyance, mediumskab, kanalisering, astrologi, numerologi, Human Design, tarot', '#87A878', 'sparkles', 110),
    ('Kreativitet & kunst', 'kreativitet-kunst', 'maleworkshops, intuitiv kunst, keramik, skrivning, dans, musik', '#87A878', 'palette', 120),
    ('Musik & sang', 'musik-sang', 'kirtan, koncert, lydoplevelser, fællessang, chanting', '#87A878', 'music', 130),
    ('Bevægelse', 'bevaegelse', 'qigong, tai chi, fri dans, ecstatic dance, pilates', '#87A878', 'dumbbell', 140),
    ('Kost & livsstil', 'kost-livsstil', 'ayurveda, ernæring, urter, fermentering, sundhed', '#87A878', 'leaf', 150),
    ('Retreats & forløb', 'retreats-forloeb', 'retreats, weekendforløb, længere udviklingsforløb', '#87A878', 'mountain', 160),
    ('Familie & relationer', 'familie-relationer', 'parterapi, familieworkshops, forældrekurser, børneyoga', '#87A878', 'heart', 170)
)
insert into public.categories (name, slug, description, color_hex, icon_name, is_active, sort_order)
select name, slug, description, color_hex, icon_name, true, sort_order
from new_categories
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  color_hex = excluded.color_hex,
  icon_name = excluded.icon_name,
  is_active = true,
  sort_order = excluded.sort_order,
  updated_at = now();

with category_mapping(old_slug, new_slug) as (
  values
    ('lydbad', 'lyd-vibration'),
    ('kropsarbejde', 'kropsbehandling'),
    ('healing', 'energi-healing'),
    ('coaching', 'personlig-udvikling'),
    ('naturforlob', 'natur-udeliv'),
    ('saunagus', 'sauna-kulde'),
    ('spirituel-udvikling', 'spiritualitet-bevidsthed'),
    ('retreat', 'retreats-forloeb')
),
resolved_mapping as (
  select old_category.id as old_id, new_category.id as new_id
  from category_mapping
  join public.categories old_category on old_category.slug = category_mapping.old_slug
  join public.categories new_category on new_category.slug = category_mapping.new_slug
),
duplicates as (
  select old_relation.facilitator_id, old_relation.category_id
  from public.facilitator_categories old_relation
  join resolved_mapping on resolved_mapping.old_id = old_relation.category_id
  join public.facilitator_categories new_relation
    on new_relation.facilitator_id = old_relation.facilitator_id
   and new_relation.category_id = resolved_mapping.new_id
)
delete from public.facilitator_categories relation
using duplicates
where relation.facilitator_id = duplicates.facilitator_id
  and relation.category_id = duplicates.category_id;

with category_mapping(old_slug, new_slug) as (
  values
    ('lydbad', 'lyd-vibration'),
    ('kropsarbejde', 'kropsbehandling'),
    ('healing', 'energi-healing'),
    ('coaching', 'personlig-udvikling'),
    ('naturforlob', 'natur-udeliv'),
    ('saunagus', 'sauna-kulde'),
    ('spirituel-udvikling', 'spiritualitet-bevidsthed'),
    ('retreat', 'retreats-forloeb')
),
resolved_mapping as (
  select old_category.id as old_id, new_category.id as new_id
  from category_mapping
  join public.categories old_category on old_category.slug = category_mapping.old_slug
  join public.categories new_category on new_category.slug = category_mapping.new_slug
)
update public.facilitator_categories relation
set category_id = resolved_mapping.new_id
from resolved_mapping
where relation.category_id = resolved_mapping.old_id;

update public.categories
set is_active = false, updated_at = now()
where slug in (
  'ceremoni',
  'shamanisme',
  'foredrag',
  'mindfulness',
  'undervisning'
);
