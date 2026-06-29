-- Cleanup for Supabase Security Advisor warnings that can be fixed safely
-- without changing the app's public behaviour.

-- 1) Pin function search paths so functions cannot be affected by a mutable role search_path.
do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    execute 'alter function public.set_updated_at() set search_path = public';
  end if;

  if to_regprocedure('public.set_ads_updated_at()') is not null then
    execute 'alter function public.set_ads_updated_at() set search_path = public';
  end if;

  if to_regprocedure('public.increment_ad_clicks(uuid)') is not null then
    execute 'alter function public.increment_ad_clicks(uuid) set search_path = public';
  end if;

  if to_regprocedure('public.next_ad_reference_id()') is not null then
    execute 'alter function public.next_ad_reference_id() set search_path = public';
  end if;

  if to_regprocedure('public.assign_ad_reference_id()') is not null then
    execute 'alter function public.assign_ad_reference_id() set search_path = public';
  end if;

  if to_regprocedure('public.assign_host_reference_id()') is not null then
    execute 'alter function public.assign_host_reference_id() set search_path = public';
  end if;
end $$;

-- 2) Trigger/internal SECURITY DEFINER functions should not be callable as public RPCs.
do $$
begin
  if to_regprocedure('public.assign_event_reference_id()') is not null then
    execute 'revoke all on function public.assign_event_reference_id() from public';
    execute 'revoke all on function public.assign_event_reference_id() from anon';
    execute 'revoke all on function public.assign_event_reference_id() from authenticated';
    execute 'grant execute on function public.assign_event_reference_id() to service_role';
  end if;
end $$;

-- Ad click tracking is called from a server route with service role, not directly by clients.
do $$
begin
  if to_regprocedure('public.increment_ad_clicks(uuid)') is not null then
    execute 'revoke all on function public.increment_ad_clicks(uuid) from public';
    execute 'revoke all on function public.increment_ad_clicks(uuid) from anon';
    execute 'revoke all on function public.increment_ad_clicks(uuid) from authenticated';
    execute 'grant execute on function public.increment_ad_clicks(uuid) to service_role';
  end if;
end $$;

-- 3) Bookings are created through the server action with service role.
-- Direct anonymous inserts are no longer needed and are too broad.
drop policy if exists "Public can create bookings" on public.bookings;

-- 4) Public storage buckets can serve public object URLs without allowing clients
-- to list every object in the bucket.
drop policy if exists "Public can read media" on storage.objects;

notify pgrst, 'reload schema';
