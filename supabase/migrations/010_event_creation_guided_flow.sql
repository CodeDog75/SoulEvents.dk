alter type event_status add value if not exists 'pending_review';
alter type event_status add value if not exists 'rejected';
alter type event_status add value if not exists 'archived';

alter table events add column if not exists contact_name text;
alter table events add column if not exists practical_information text;
alter table events add column if not exists event_format text not null default 'physical';
alter table events add column if not exists online_description text;
alter table events add column if not exists online_url_or_note text;
alter table events add column if not exists country text not null default 'Danmark';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'events_event_format_check'
  ) then
    alter table events add constraint events_event_format_check
    check (event_format in ('physical', 'online', 'hybrid'));
  end if;
end $$;
