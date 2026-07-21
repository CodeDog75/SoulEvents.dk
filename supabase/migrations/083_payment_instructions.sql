create or replace function public.generate_booking_payment_reference()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  candidate text;
  index_value integer;
begin
  loop
    candidate := 'SE-';

    for index_value in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
    end loop;

    exit when not exists (
      select 1
      from public.bookings
      where payment_reference = candidate
    );
  end loop;

  return candidate;
end;
$$;

revoke execute on function public.generate_booking_payment_reference() from public;
revoke execute on function public.generate_booking_payment_reference() from anon;
revoke execute on function public.generate_booking_payment_reference() from authenticated;
grant execute on function public.generate_booking_payment_reference() to service_role;

create table if not exists public.facilitator_payment_settings (
  facilitator_id uuid primary key references public.facilitator_profiles(id) on delete cascade,
  mobilepay_number text,
  bank_registration_number text,
  bank_account_number text,
  bank_account_name text,
  external_url text,
  instructions text,
  deadline_days integer not null default 14,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint facilitator_payment_settings_deadline_days_check check (deadline_days >= 0 and deadline_days <= 60)
);

drop trigger if exists set_facilitator_payment_settings_updated_at on public.facilitator_payment_settings;
create trigger set_facilitator_payment_settings_updated_at
before update on public.facilitator_payment_settings
for each row execute function public.set_updated_at();

alter table public.facilitator_payment_settings enable row level security;

drop policy if exists "Facilitators can read own payment settings" on public.facilitator_payment_settings;
create policy "Facilitators can read own payment settings"
on public.facilitator_payment_settings
for select
to authenticated
using (
  exists (
    select 1
    from public.facilitator_profiles fp
    where fp.id = facilitator_payment_settings.facilitator_id
      and fp.profile_id = auth.uid()
  )
  or private.is_admin()
);

drop policy if exists "Facilitators can insert own payment settings" on public.facilitator_payment_settings;
create policy "Facilitators can insert own payment settings"
on public.facilitator_payment_settings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.facilitator_profiles fp
    where fp.id = facilitator_payment_settings.facilitator_id
      and fp.profile_id = auth.uid()
  )
  or private.is_admin()
);

drop policy if exists "Facilitators can update own payment settings" on public.facilitator_payment_settings;
create policy "Facilitators can update own payment settings"
on public.facilitator_payment_settings
for update
to authenticated
using (
  exists (
    select 1
    from public.facilitator_profiles fp
    where fp.id = facilitator_payment_settings.facilitator_id
      and fp.profile_id = auth.uid()
  )
  or private.is_admin()
)
with check (
  exists (
    select 1
    from public.facilitator_profiles fp
    where fp.id = facilitator_payment_settings.facilitator_id
      and fp.profile_id = auth.uid()
  )
  or private.is_admin()
);

create table if not exists public.event_payment_settings (
  event_id uuid primary key references public.events(id) on delete cascade,
  facilitator_id uuid not null references public.facilitator_profiles(id) on delete cascade,
  method_source text not null default 'facilitator',
  mobilepay_number text,
  bank_registration_number text,
  bank_account_number text,
  bank_account_name text,
  external_url text,
  instructions text,
  deadline_days integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_payment_settings_method_source_check check (method_source in ('facilitator', 'custom', 'none')),
  constraint event_payment_settings_deadline_days_check check (deadline_days is null or (deadline_days >= 0 and deadline_days <= 60))
);

create index if not exists event_payment_settings_facilitator_id_idx
on public.event_payment_settings(facilitator_id);

drop trigger if exists set_event_payment_settings_updated_at on public.event_payment_settings;
create trigger set_event_payment_settings_updated_at
before update on public.event_payment_settings
for each row execute function public.set_updated_at();

alter table public.event_payment_settings enable row level security;

drop policy if exists "Facilitators can read own event payment settings" on public.event_payment_settings;
create policy "Facilitators can read own event payment settings"
on public.event_payment_settings
for select
to authenticated
using (
  exists (
    select 1
    from public.facilitator_profiles fp
    where fp.id = event_payment_settings.facilitator_id
      and fp.profile_id = auth.uid()
  )
  or private.is_admin()
);

drop policy if exists "Facilitators can insert own event payment settings" on public.event_payment_settings;
create policy "Facilitators can insert own event payment settings"
on public.event_payment_settings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.facilitator_profiles fp
    where fp.id = event_payment_settings.facilitator_id
      and fp.profile_id = auth.uid()
  )
  or private.is_admin()
);

drop policy if exists "Facilitators can update own event payment settings" on public.event_payment_settings;
create policy "Facilitators can update own event payment settings"
on public.event_payment_settings
for update
to authenticated
using (
  exists (
    select 1
    from public.facilitator_profiles fp
    where fp.id = event_payment_settings.facilitator_id
      and fp.profile_id = auth.uid()
  )
  or private.is_admin()
)
with check (
  exists (
    select 1
    from public.facilitator_profiles fp
    where fp.id = event_payment_settings.facilitator_id
      and fp.profile_id = auth.uid()
  )
  or private.is_admin()
);

alter table public.bookings
  add column if not exists payment_reference text,
  add column if not exists payment_instructions_snapshot jsonb,
  add column if not exists payment_due_at timestamptz,
  add column if not exists payment_snapshot_created_at timestamptz,
  add column if not exists manually_marked_paid_at timestamptz,
  add column if not exists manually_marked_paid_by uuid references public.profiles(id) on delete set null,
  add column if not exists manual_payment_note text;

update public.bookings
set payment_reference = public.generate_booking_payment_reference()
where payment_reference is null;

alter table public.bookings
  alter column payment_reference set default public.generate_booking_payment_reference(),
  alter column payment_reference set not null;

create unique index if not exists bookings_payment_reference_key
on public.bookings(payment_reference);

comment on table public.facilitator_payment_settings is
  'Private standard payment instructions for organizers. Not public-facing and not a payment integration.';

comment on table public.event_payment_settings is
  'Private per-event payment instructions. Participants receive a snapshot only after organizer confirmation.';

comment on column public.bookings.payment_reference is
  'Stable manual payment reference sent to participant after organizer confirmation for paid bookings.';

comment on column public.bookings.payment_instructions_snapshot is
  'Immutable snapshot of organizer payment instructions sent with booking confirmation. SoulEvents does not process payments.';

comment on column public.bookings.manually_marked_paid_at is
  'Manual organizer registration that a booking has been paid outside SoulEvents. This is not provider-verified.';

comment on column public.bookings.manually_marked_paid_by is
  'Profile that manually marked the booking as paid outside SoulEvents.';

comment on column public.bookings.manual_payment_note is
  'Private organizer note for manual payment registration. Never shown publicly or sent to participants.';

notify pgrst, 'reload schema';
