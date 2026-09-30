create or replace function public.enforce_event_co_organizer_limit()
returns trigger
language plpgsql
as $$
declare
  active_count integer;
  event_owner uuid;
begin
  select facilitator_id into event_owner
  from public.events
  where id = new.event_id;

  if event_owner is null then
    raise exception 'Event does not exist.';
  end if;

  if new.primary_organizer_profile_id <> event_owner then
    raise exception 'Primary organizer must match event owner.';
  end if;

  if new.co_organizer_profile_id = event_owner then
    raise exception 'Primary organizer cannot be invited as co-organizer.';
  end if;

  if new.status in ('pending', 'accepted') then
    select count(*) into active_count
    from public.event_co_organizers
    where event_id = new.event_id
      and status in ('pending', 'accepted')
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

    if active_count >= 15 then
      raise exception 'An event can have at most 15 co-organizers.';
    end if;
  end if;

  return new;
end;
$$;

