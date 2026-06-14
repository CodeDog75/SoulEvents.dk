create sequence if not exists ad_reference_id_seq start 100;

alter table ads
add column if not exists ad_reference_id text unique;

create or replace function next_ad_reference_id()
returns text
language plpgsql
as $$
declare
  next_number bigint;
  next_reference text;
begin
  loop
    next_number := nextval('ad_reference_id_seq');
    next_reference := 'R' || next_number::text;
    exit when not exists (select 1 from ads where ad_reference_id = next_reference);
  end loop;

  return next_reference;
end;
$$;

create or replace function assign_ad_reference_id()
returns trigger
language plpgsql
as $$
begin
  if new.ad_reference_id is null or btrim(new.ad_reference_id) = '' then
    new.ad_reference_id := next_ad_reference_id();
  end if;

  return new;
end;
$$;

with existing_max as (
  select greatest(
    99,
    coalesce(max(nullif(regexp_replace(ad_reference_id, '[^0-9]', '', 'g'), '')::bigint), 99)
  ) as max_number
  from ads
)
select setval('ad_reference_id_seq', max_number, true)
from existing_max;

with ordered_ads as (
  select id, row_number() over (order by created_at, id) as row_number
  from ads
  where ad_reference_id is null
)
update ads
set ad_reference_id = next_ad_reference_id()
from ordered_ads
where ads.id = ordered_ads.id;

with existing_max as (
  select greatest(
    99,
    coalesce(max(nullif(regexp_replace(ad_reference_id, '[^0-9]', '', 'g'), '')::bigint), 99)
  ) as max_number
  from ads
)
select setval('ad_reference_id_seq', max_number, true)
from existing_max;

drop trigger if exists ads_assign_reference_id on ads;
create trigger ads_assign_reference_id
before insert on ads
for each row execute function assign_ad_reference_id();
