alter table public.events
  add column if not exists registration_mode text not null default 'approval_required';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_registration_mode_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_registration_mode_check
        check (registration_mode in ('direct', 'approval_required'));
  end if;
end
$$;

comment on column public.events.registration_mode is
  'Controls participant registration flow. direct confirms the booking immediately; approval_required keeps the existing organizer approval flow.';

notify pgrst, 'reload schema';
