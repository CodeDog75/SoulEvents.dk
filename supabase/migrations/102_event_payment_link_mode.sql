alter table public.event_payment_settings
  add column if not exists payment_link_mode text not null default 'payment_only';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'event_payment_settings_payment_link_mode_check'
      and conrelid = 'public.event_payment_settings'::regclass
  ) then
    alter table public.event_payment_settings
      add constraint event_payment_settings_payment_link_mode_check
        check (payment_link_mode in ('external_registration', 'payment_only'));
  end if;
end
$$;

comment on column public.event_payment_settings.payment_link_mode is
  'Defines whether a custom event payment link handles external registration and payment, or payment only after SoulEvents registration.';

notify pgrst, 'reload schema';
