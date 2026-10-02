alter policy "Facilitators can create their own admin messages" on public.facilitator_admin_messages
  with check (
    type in ('message','closure_request')
    and profile_id=auth.uid()
    and in_reply_to is null and answered_at is null and answered_by is null and duplicate_of is null
    and exists(select 1 from public.facilitator_profiles f
      where f.id=facilitator_admin_messages.facilitator_id and f.profile_id=auth.uid())
  );
notify pgrst, 'reload schema';
