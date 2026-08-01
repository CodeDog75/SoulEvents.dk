create or replace function public.enforce_event_gallery_image_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*)
    from public.event_images
    where event_id = new.event_id
      and id is distinct from new.id
  ) >= 3 then
    raise exception 'An event can have at most three gallery images.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_event_gallery_image_limit on public.event_images;

create trigger enforce_event_gallery_image_limit
before insert or update of event_id on public.event_images
for each row
execute function public.enforce_event_gallery_image_limit();

notify pgrst, 'reload schema';
