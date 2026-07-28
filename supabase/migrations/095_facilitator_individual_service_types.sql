alter table public.facilitator_profiles
  add column if not exists individual_service_types text[] not null default '{}',
  add column if not exists individual_service_other_title text;

update public.facilitator_profiles
set individual_service_types = coalesce(
  (
    select (array_agg(mapped order by first_position))[1:2]
    from (
      select mapped, min(position) as first_position
      from (
        select
          case item
            when 'treatment_table' then 'treatment'
            when 'one_to_one_conversation' then 'conversation'
            when 'online_session' then 'nature'
            when 'group_program' then 'community'
            when 'workshop' then 'teaching'
            when 'ceremony' then 'fire_ceremony'
            when 'mentoring' then 'energy'
            when 'treatment' then 'treatment'
            when 'hands' then 'hands'
            when 'heart' then 'heart'
            when 'nature' then 'nature'
            when 'conversation' then 'conversation'
            when 'teaching' then 'teaching'
            when 'community' then 'community'
            when 'lotus' then 'lotus'
            when 'energy' then 'energy'
            when 'moon' then 'moon'
            when 'sun' then 'sun'
            when 'meditation' then 'meditation'
            when 'sound' then 'sound'
            when 'water' then 'water'
            when 'fire_ceremony' then 'fire_ceremony'
            when 'reflection' then 'reflection'
            when 'other' then 'other'
            else null
          end as mapped,
          position
        from unnest(individual_service_types) with ordinality as service_type(item, position)
      ) mapped_values
      where mapped is not null
      group by mapped
    ) deduplicated_values
  ),
  '{}'
)
where cardinality(individual_service_types) > 0;

alter table public.facilitator_profiles
  drop constraint if exists facilitator_profiles_individual_service_types_check;

alter table public.facilitator_profiles
  add constraint facilitator_profiles_individual_service_types_check
  check (
    cardinality(individual_service_types) <= 2
    and individual_service_types <@ array[
      'treatment',
      'hands',
      'heart',
      'nature',
      'conversation',
      'teaching',
      'community',
      'lotus',
      'energy',
      'moon',
      'sun',
      'meditation',
      'sound',
      'water',
      'fire_ceremony',
      'reflection',
      'other'
    ]::text[]
  );

comment on column public.facilitator_profiles.individual_service_types is
  'Structured optional service types selected by the facilitator for individual services.';

comment on column public.facilitator_profiles.individual_service_other_title is
  'Short custom label used when the facilitator selects Other as an individual service type.';

notify pgrst, 'reload schema';
