alter table public.external_event_participants
  alter column participant_name drop not null,
  alter column participant_email drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'external_event_participants_has_identifying_info_check'
      and conrelid = 'public.external_event_participants'::regclass
  ) then
    alter table public.external_event_participants
      add constraint external_event_participants_has_identifying_info_check
        check (
          nullif(btrim(coalesce(participant_name, '')), '') is not null
          or nullif(btrim(coalesce(participant_email, '')), '') is not null
          or nullif(btrim(coalesce(participant_phone, '')), '') is not null
          or nullif(btrim(coalesce(internal_note, '')), '') is not null
        );
  end if;
end
$$;

comment on constraint external_event_participants_has_identifying_info_check on public.external_event_participants is
  'Manual external participant rows must include at least one note or contact detail.';

notify pgrst, 'reload schema';
