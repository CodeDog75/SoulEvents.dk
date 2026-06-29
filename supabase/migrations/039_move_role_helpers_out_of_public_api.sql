-- Move internal RLS helper functions out of the public API schema.
-- Existing RLS policies depend on the function OIDs, so ALTER FUNCTION ... SET SCHEMA
-- preserves those dependencies while removing /rest/v1/rpc exposure from public.

create schema if not exists private;

grant usage on schema private to anon;
grant usage on schema private to authenticated;
grant usage on schema private to service_role;

do $$
begin
  if to_regprocedure('public.current_app_role()') is not null then
    execute 'alter function public.current_app_role() set schema private';
  end if;

  if to_regprocedure('public.is_admin()') is not null then
    execute 'alter function public.is_admin() set schema private';
  end if;
end $$;

create or replace function private.current_app_role()
returns public.app_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function private.is_admin()
returns boolean
language sql
security definer
set search_path = public, private
stable
as $$
  select coalesce(private.current_app_role() = 'admin', false)
$$;

revoke all on function private.current_app_role() from public;
revoke all on function private.is_admin() from public;

grant execute on function private.current_app_role() to anon;
grant execute on function private.current_app_role() to authenticated;
grant execute on function private.current_app_role() to service_role;

grant execute on function private.is_admin() to anon;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_admin() to service_role;

notify pgrst, 'reload schema';
