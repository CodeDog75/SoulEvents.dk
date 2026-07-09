create or replace function public.cleanup_demo_data(
  p_facilitator_ids uuid[] default '{}',
  p_host_reference_ids text[] default '{}',
  p_profile_emails text[] default '{}',
  p_execute boolean default false
)
returns table(table_name text, records bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_selector_count integer;
  v_matched_count integer;
  v_unmatched_ids uuid[];
  v_unmatched_refs text[];
  v_unmatched_emails text[];
begin
  if not (private.is_admin() or current_user in ('postgres', 'service_role', 'supabase_admin')) then
    raise exception 'Kun administratorer kan køre demo-oprydning.';
  end if;

  v_selector_count :=
    coalesce(array_length(p_facilitator_ids, 1), 0) +
    coalesce(array_length(p_host_reference_ids, 1), 0) +
    coalesce(array_length(p_profile_emails, 1), 0);

  if v_selector_count = 0 then
    raise exception 'Angiv mindst én eksplicit demo-arrangør via id, arrangør-ID eller e-mail. Funktionen gætter ikke.';
  end if;

  create temp table if not exists demo_cleanup_facilitators (
    id uuid primary key,
    profile_id uuid not null
  ) on commit drop;
  truncate demo_cleanup_facilitators;

  insert into demo_cleanup_facilitators (id, profile_id)
  select distinct fp.id, fp.profile_id
  from public.facilitator_profiles fp
  join public.profiles p on p.id = fp.profile_id
  where fp.id = any(p_facilitator_ids)
     or fp.host_reference_id = any(p_host_reference_ids)
     or lower(p.email) in (select lower(email) from unnest(p_profile_emails) as email);

  select count(*) into v_matched_count from demo_cleanup_facilitators;

  if v_matched_count = 0 then
    raise exception 'Ingen arrangører matchede de angivne demo-selektorer. Ingen data er ændret.';
  end if;

  select array_agg(input_id)
  into v_unmatched_ids
  from unnest(p_facilitator_ids) as input_id
  where not exists (select 1 from demo_cleanup_facilitators where id = input_id);

  select array_agg(input_ref)
  into v_unmatched_refs
  from unnest(p_host_reference_ids) as input_ref
  where not exists (
    select 1
    from public.facilitator_profiles fp
    join demo_cleanup_facilitators dcf on dcf.id = fp.id
    where fp.host_reference_id = input_ref
  );

  select array_agg(input_email)
  into v_unmatched_emails
  from unnest(p_profile_emails) as input_email
  where not exists (
    select 1
    from public.profiles p
    join demo_cleanup_facilitators dcf on dcf.profile_id = p.id
    where lower(p.email) = lower(input_email)
  );

  if coalesce(array_length(v_unmatched_ids, 1), 0) > 0
    or coalesce(array_length(v_unmatched_refs, 1), 0) > 0
    or coalesce(array_length(v_unmatched_emails, 1), 0) > 0
  then
    raise exception 'Nogle demo-selektorer kunne ikke matches. ids=%, refs=%, emails=%',
      coalesce(v_unmatched_ids, '{}'),
      coalesce(v_unmatched_refs, '{}'),
      coalesce(v_unmatched_emails, '{}');
  end if;

  if exists (
    select 1
    from public.profiles p
    join demo_cleanup_facilitators dcf on dcf.profile_id = p.id
    where p.role = 'admin'
  ) then
    raise exception 'Oprydning stoppet: mindst én valgt arrangør er admin. Admin-profiler slettes aldrig.';
  end if;

  create temp table if not exists demo_cleanup_events (id uuid primary key) on commit drop;
  truncate demo_cleanup_events;

  insert into demo_cleanup_events (id)
  select e.id
  from public.events e
  join demo_cleanup_facilitators dcf on dcf.id = e.facilitator_id;

  create temp table if not exists demo_cleanup_bookings (id uuid primary key) on commit drop;
  truncate demo_cleanup_bookings;

  insert into demo_cleanup_bookings (id)
  select distinct b.id
  from public.bookings b
  where b.facilitator_id in (select id from demo_cleanup_facilitators)
     or b.event_id in (select id from demo_cleanup_events);

  create temp table if not exists demo_cleanup_invoice_drafts (id uuid primary key) on commit drop;
  truncate demo_cleanup_invoice_drafts;

  insert into demo_cleanup_invoice_drafts (id)
  select id
  from public.invoice_drafts
  where facilitator_id in (select id from demo_cleanup_facilitators);

  create temp table if not exists demo_cleanup_reminders (id uuid primary key) on commit drop;
  truncate demo_cleanup_reminders;

  insert into demo_cleanup_reminders (id)
  select id
  from public.facilitator_event_reminders
  where facilitator_id in (select id from demo_cleanup_facilitators);

  create temp table if not exists demo_cleanup_counts (
    table_name text primary key,
    records bigint not null
  ) on commit drop;
  truncate demo_cleanup_counts;

  insert into demo_cleanup_counts values
    ('admin_audit_log', (select count(*) from public.admin_audit_log where facilitator_id in (select id from demo_cleanup_facilitators) or event_id in (select id from demo_cleanup_events))),
    ('bookings', (select count(*) from demo_cleanup_bookings)),
    ('email_logs', (select count(*) from public.email_logs where booking_id in (select id from demo_cleanup_bookings) or event_id in (select id from demo_cleanup_events))),
    ('event_categories', (select count(*) from public.event_categories where event_id in (select id from demo_cleanup_events))),
    ('event_exposure_stats', (select count(*) from public.event_exposure_stats where event_id in (select id from demo_cleanup_events) or facilitator_id in (select id from demo_cleanup_facilitators))),
    ('event_images', (select count(*) from public.event_images where event_id in (select id from demo_cleanup_events))),
    ('event_main_categories', (select count(*) from public.event_main_categories where event_id in (select id from demo_cleanup_events))),
    ('event_subcategories', (select count(*) from public.event_subcategories where event_id in (select id from demo_cleanup_events))),
    ('event_tags', (select count(*) from public.event_tags where event_id in (select id from demo_cleanup_events))),
    ('events', (select count(*) from demo_cleanup_events)),
    ('facilitator_admin_messages', (select count(*) from public.facilitator_admin_messages where facilitator_id in (select id from demo_cleanup_facilitators) or profile_id in (select profile_id from demo_cleanup_facilitators))),
    ('facilitator_categories', (select count(*) from public.facilitator_categories where facilitator_id in (select id from demo_cleanup_facilitators))),
    ('facilitator_event_reference_counters', (select count(*) from public.facilitator_event_reference_counters where facilitator_id in (select id from demo_cleanup_facilitators))),
    ('facilitator_event_reminder_notifications', (select count(*) from public.facilitator_event_reminder_notifications where reminder_id in (select id from demo_cleanup_reminders) or event_id in (select id from demo_cleanup_events))),
    ('facilitator_event_reminders', (select count(*) from demo_cleanup_reminders)),
    ('facilitator_images', (select count(*) from public.facilitator_images where facilitator_id in (select id from demo_cleanup_facilitators))),
    ('facilitator_profile_views', (select count(*) from public.facilitator_profile_views where facilitator_id in (select id from demo_cleanup_facilitators))),
    ('facilitator_profiles', (select count(*) from demo_cleanup_facilitators)),
    ('facilitator_service_titles', (select count(*) from public.facilitator_service_titles where facilitator_id in (select id from demo_cleanup_facilitators))),
    ('facilitator_tags', (select count(*) from public.facilitator_tags where facilitator_id in (select id from demo_cleanup_facilitators))),
    ('homepage_event_collection_events', (select count(*) from public.homepage_event_collection_events where event_id in (select id from demo_cleanup_events))),
    ('invoice_draft_lines', (select count(*) from public.invoice_draft_lines where booking_id in (select id from demo_cleanup_bookings) or invoice_draft_id in (select id from demo_cleanup_invoice_drafts))),
    ('invoice_drafts', (select count(*) from demo_cleanup_invoice_drafts)),
    ('monthly_reports', (select count(*) from public.monthly_reports where facilitator_id in (select id from demo_cleanup_facilitators)));

  if p_execute then
    delete from public.invoice_draft_lines where booking_id in (select id from demo_cleanup_bookings) or invoice_draft_id in (select id from demo_cleanup_invoice_drafts);
    delete from public.email_logs where booking_id in (select id from demo_cleanup_bookings) or event_id in (select id from demo_cleanup_events);
    delete from public.facilitator_event_reminder_notifications where reminder_id in (select id from demo_cleanup_reminders) or event_id in (select id from demo_cleanup_events);
    delete from public.homepage_event_collection_events where event_id in (select id from demo_cleanup_events);
    delete from public.admin_audit_log where facilitator_id in (select id from demo_cleanup_facilitators) or event_id in (select id from demo_cleanup_events);
    delete from public.facilitator_admin_messages where facilitator_id in (select id from demo_cleanup_facilitators) or profile_id in (select profile_id from demo_cleanup_facilitators);
    delete from public.event_exposure_stats where event_id in (select id from demo_cleanup_events) or facilitator_id in (select id from demo_cleanup_facilitators);
    delete from public.invoice_drafts where id in (select id from demo_cleanup_invoice_drafts);
    delete from public.monthly_reports where facilitator_id in (select id from demo_cleanup_facilitators);
    delete from public.bookings where id in (select id from demo_cleanup_bookings);
    delete from public.event_images where event_id in (select id from demo_cleanup_events);
    delete from public.event_categories where event_id in (select id from demo_cleanup_events);
    delete from public.event_main_categories where event_id in (select id from demo_cleanup_events);
    delete from public.event_subcategories where event_id in (select id from demo_cleanup_events);
    delete from public.event_tags where event_id in (select id from demo_cleanup_events);
    delete from public.events where id in (select id from demo_cleanup_events);
    delete from public.facilitator_event_reminders where id in (select id from demo_cleanup_reminders);
    delete from public.facilitator_profile_views where facilitator_id in (select id from demo_cleanup_facilitators);
    delete from public.facilitator_images where facilitator_id in (select id from demo_cleanup_facilitators);
    delete from public.facilitator_categories where facilitator_id in (select id from demo_cleanup_facilitators);
    delete from public.facilitator_tags where facilitator_id in (select id from demo_cleanup_facilitators);
    delete from public.facilitator_service_titles where facilitator_id in (select id from demo_cleanup_facilitators);
    delete from public.facilitator_event_reference_counters where facilitator_id in (select id from demo_cleanup_facilitators);
    delete from public.facilitator_profiles where id in (select id from demo_cleanup_facilitators);
  end if;

  return query
  select demo_cleanup_counts.table_name, demo_cleanup_counts.records
  from demo_cleanup_counts
  where demo_cleanup_counts.records > 0
  order by demo_cleanup_counts.table_name;
end;
$$;

revoke all on function public.cleanup_demo_data(uuid[], text[], text[], boolean) from public;
grant execute on function public.cleanup_demo_data(uuid[], text[], text[], boolean) to authenticated;

comment on function public.cleanup_demo_data(uuid[], text[], text[], boolean) is
  'Admin-only cleanup for explicitly selected demo facilitators. Dry run by default. Does not delete auth.users or public.profiles.';

notify pgrst, 'reload schema';
