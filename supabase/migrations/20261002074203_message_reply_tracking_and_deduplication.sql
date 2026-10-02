alter table public.facilitator_admin_messages
  add column message_number bigint generated always as identity,
  add column in_reply_to uuid references public.facilitator_admin_messages(id) on delete set null,
  add column answered_at timestamptz,
  add column answered_by uuid references public.facilitator_admin_messages(id) on delete set null,
  add column duplicate_of uuid references public.facilitator_admin_messages(id) on delete set null;
create unique index facilitator_admin_message_number_idx on public.facilitator_admin_messages(message_number);

-- Preserve existing messages, while identifying rapid repeat submissions.
update public.facilitator_admin_messages m set duplicate_of = (
  select original.id from public.facilitator_admin_messages original
  where original.facilitator_id=m.facilitator_id and original.type=m.type
    and original.subject=m.subject and original.message=m.message
    and (original.created_at,original.id)<(m.created_at,m.id)
    and original.created_at >= m.created_at - interval '30 seconds'
  order by original.created_at,original.id limit 1
) where m.type='message';

-- Existing replies were saved without a link. Reconstruct conversation-level responses.
update public.facilitator_admin_messages m set
  answered_at=r.created_at, answered_by=r.id
from public.facilitator_admin_messages r
where m.type in ('message','closure_request') and r.type='admin_reply'
  and r.facilitator_id=m.facilitator_id and r.created_at>m.created_at
  and not exists (select 1 from public.facilitator_admin_messages earlier
    where earlier.facilitator_id=m.facilitator_id and earlier.type='admin_reply'
      and earlier.created_at>m.created_at and earlier.created_at<r.created_at);

create function public.track_facilitator_message_reply() returns trigger
language plpgsql security invoker set search_path=public as $$
declare original public.facilitator_admin_messages;
begin
  if new.type='admin_reply' and new.in_reply_to is not null then
    select * into original from public.facilitator_admin_messages where id=new.in_reply_to;
    if original.id is null or original.facilitator_id<>new.facilitator_id or original.type='admin_reply' then
      raise exception 'Invalid reply target';
    end if;
    update public.facilitator_admin_messages set answered_at=new.created_at,answered_by=new.id
    where facilitator_id=new.facilitator_id and type in ('message','closure_request')
      and answered_at is null and created_at<=original.created_at;
  end if;
  return new;
end $$;
create trigger track_facilitator_message_reply after insert on public.facilitator_admin_messages
for each row execute function public.track_facilitator_message_reply();

-- Only trusted server actions can call this function; caller resolves the authenticated profile.
create function public.send_facilitator_support_message(p_facilitator_id uuid,p_profile_id uuid,p_subject text,p_message text)
returns table(message_number bigint,already_sent boolean)
language plpgsql security invoker set search_path=public as $$
declare existing_number bigint;
begin
  if not exists(select 1 from public.facilitator_profiles where id=p_facilitator_id and profile_id=p_profile_id) then
    raise exception 'Invalid sender';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_facilitator_id::text,0));
  select m.message_number into existing_number from public.facilitator_admin_messages m
  where m.facilitator_id=p_facilitator_id and m.type='message'
    and m.subject=p_subject and m.message=p_message
    and m.created_at>=now()-interval '30 seconds'
  order by m.created_at desc limit 1;
  if existing_number is not null then
    return query select existing_number,true;
    return;
  end if;
  return query insert into public.facilitator_admin_messages(facilitator_id,profile_id,subject,message,type,status)
    values(p_facilitator_id,p_profile_id,p_subject,p_message,'message','unread')
    returning facilitator_admin_messages.message_number,false;
end $$;
revoke all on function public.send_facilitator_support_message(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.send_facilitator_support_message(uuid,uuid,text,text) to service_role;
