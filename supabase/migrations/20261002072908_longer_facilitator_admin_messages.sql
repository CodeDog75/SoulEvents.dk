alter table public.facilitator_admin_messages
  drop constraint facilitator_admin_messages_message_check;
alter table public.facilitator_admin_messages
  add constraint facilitator_admin_messages_message_check
  check (char_length(message) <= 5000);
