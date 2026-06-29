-- Allow SoulEvents administration to reply back to facilitators in the same message table.

do $$
declare
  constraint_name text;
begin
  select conname
    into constraint_name
  from pg_constraint
  where conrelid = 'public.facilitator_admin_messages'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%type%'
    and pg_get_constraintdef(oid) like '%closure_request%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.facilitator_admin_messages drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.facilitator_admin_messages
  add constraint facilitator_admin_messages_type_check
  check (type in ('message', 'closure_request', 'admin_reply'));

notify pgrst, 'reload schema';
