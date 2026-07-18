do $$
begin
  if to_regclass('public.facilitator_service_titles') is not null
     and to_regclass('public.service_titles') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'facilitator_profiles'
         and column_name = 'service_other_title'
     ) then
    with title_summary as (
      select
        fst.facilitator_id,
        string_agg(distinct st.name, ', ' order by st.name) as title_names
      from public.facilitator_service_titles fst
      join public.service_titles st on st.id = fst.service_title_id
      group by fst.facilitator_id
    )
    update public.facilitator_profiles fp
    set service_description = btrim(concat_ws(E'\n\n',
      nullif(btrim(fp.service_description), ''),
      case
        when title_summary.title_names is not null then 'Tidligere ydelsestyper: ' || title_summary.title_names
        else null
      end,
      case
        when nullif(btrim(fp.service_other_title), '') is not null then 'Øvrige oplysninger: ' || btrim(fp.service_other_title)
        else null
      end
    ))
    from title_summary
    where fp.id = title_summary.facilitator_id
      and (
        title_summary.title_names is not null
        or nullif(btrim(fp.service_other_title), '') is not null
      );
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'facilitator_profiles'
      and column_name = 'service_other_title'
  ) then
    update public.facilitator_profiles
    set service_description = btrim(concat_ws(E'\n\n',
      nullif(btrim(service_description), ''),
      'Øvrige oplysninger: ' || btrim(service_other_title)
    ))
    where nullif(btrim(service_other_title), '') is not null
      and service_description not like '%' || btrim(service_other_title) || '%';

    alter table public.facilitator_profiles
      drop column if exists service_other_title;
  end if;
end $$;

drop table if exists public.facilitator_service_titles;
drop table if exists public.service_titles;

notify pgrst, 'reload schema';
