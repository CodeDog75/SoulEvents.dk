create or replace function public.cleanup_old_facilitator_admin_messages()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.facilitator_admin_messages
  where created_at < now() - interval '3 months';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_old_facilitator_admin_messages() from public;
grant execute on function public.cleanup_old_facilitator_admin_messages() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $cron$
      select cron.unschedule(jobid)
      from cron.job
      where jobname = 'cleanup-old-facilitator-admin-messages'
    $cron$;

    execute $cron$
      select cron.schedule(
        'cleanup-old-facilitator-admin-messages',
        '23 3 * * *',
        'select public.cleanup_old_facilitator_admin_messages();'
      )
    $cron$;
  end if;
end $$;
