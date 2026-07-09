create or replace function public.complete_expired_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.events
  set status = 'completed'
  where status in ('active', 'sold_out')
    and coalesce(ends_at, starts_at) < now();

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.complete_expired_events() from public;
grant execute on function public.complete_expired_events() to service_role;

drop policy if exists "Public can read active approved events" on public.events;
create policy "Public can read active approved events"
on public.events for select
using (
  public.is_admin()
  or exists (
    select 1
    from public.facilitator_profiles fp
    where fp.id = events.facilitator_id
      and fp.profile_id = auth.uid()
  )
  or (
    status in ('active', 'sold_out')
    and coalesce(ends_at, starts_at) >= now()
    and exists (
      select 1
      from public.facilitator_profiles fp
      where fp.id = events.facilitator_id
        and fp.status = 'approved'
    )
  )
);

drop policy if exists "Public can read event images for visible events" on public.event_images;
create policy "Public can read event images for visible events"
on public.event_images for select
using (
  exists (
    select 1
    from public.events e
    join public.facilitator_profiles fp on fp.id = e.facilitator_id
    where e.id = event_images.event_id
      and (
        public.is_admin()
        or fp.profile_id = auth.uid()
        or (e.status in ('active', 'sold_out') and coalesce(e.ends_at, e.starts_at) >= now() and fp.status = 'approved')
      )
  )
);

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $cron$
      select cron.unschedule(jobid)
      from cron.job
      where jobname = 'complete-expired-events'
    $cron$;

    execute $cron$
      select cron.schedule(
        'complete-expired-events',
        '17 * * * *',
        'select public.complete_expired_events();'
      )
    $cron$;
  end if;
end $$;

notify pgrst, 'reload schema';
