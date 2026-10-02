-- Run against a migrated database. All test writes are rolled back; no email is sent.
begin;
do $$
declare
  f public.facilitator_profiles;
  other_id uuid;
  number_one bigint;
  number_two bigint;
  original_id uuid;
  later_id uuid;
  reply_id uuid;
  body text := 'Regression test ' || gen_random_uuid();
begin
  select * into f from public.facilitator_profiles where profile_id is not null limit 1;
  select id into other_id from public.facilitator_profiles where id<>f.id limit 1;
  if f.id is null or other_id is null then raise exception 'Test requires two facilitator fixtures'; end if;
  select message_number into number_one from public.send_facilitator_support_message(f.id,f.profile_id,'Regression test',body);
  select message_number into number_two from public.send_facilitator_support_message(f.id,f.profile_id,'Regression test',body);
  if number_one<>number_two then raise exception 'Repeat submission created a duplicate'; end if;
  select id into original_id from public.facilitator_admin_messages where message_number=number_one;
  insert into public.facilitator_admin_messages(facilitator_id,profile_id,type,status,subject,message,created_at)
    values(f.id,f.profile_id,'message','unread','Later message',body,clock_timestamp()) returning id into later_id;
  insert into public.facilitator_admin_messages(facilitator_id,profile_id,type,status,subject,message,in_reply_to)
    values(f.id,f.profile_id,'admin_reply','unread','Response',body,original_id) returning id into reply_id;
  if not exists(select 1 from public.facilitator_admin_messages where id=original_id and answered_by=reply_id and answered_at is not null) then
    raise exception 'Original message was not marked answered';
  end if;
  if not exists(select 1 from public.facilitator_admin_messages where id=later_id and answered_at is null) then
    raise exception 'Newer message was incorrectly marked answered';
  end if;
  begin
    insert into public.facilitator_admin_messages(facilitator_id,profile_id,type,status,subject,message,in_reply_to)
      values(other_id,f.profile_id,'admin_reply','unread','Invalid response',body,original_id);
    raise exception 'Cross-conversation reply was incorrectly accepted';
  exception when raise_exception then
    if sqlerrm <> 'Invalid reply target' then raise; end if;
  end;
  if has_function_privilege('authenticated','public.send_facilitator_support_message(uuid,uuid,text,text)','execute')
    or has_function_privilege('anon','public.send_facilitator_support_message(uuid,uuid,text,text)','execute') then
    raise exception 'Support message RPC is accessible outside trusted server actions';
  end if;
end $$;
rollback;
