-- Safe local-only seed data for SoulEvents development.
-- Uses reserved .test email domains and fixed UUIDs. Never import production data here.

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  phone_change,
  phone_change_token,
  email_change_token_current,
  reauthentication_token,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'admin@soulevents.test',
    crypt('Test1234!', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Lokal Admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated',
    'authenticated',
    'arrangoer@soulevents.test',
    crypt('Test1234!', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Test Arrangør"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-4333-8333-333333333333',
    'authenticated',
    'authenticated',
    'deltager@soulevents.test',
    crypt('Test1234!', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Test Deltager"}'::jsonb,
    now(),
    now()
  )
on conflict (id) do update
set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  confirmation_token = excluded.confirmation_token,
  recovery_token = excluded.recovery_token,
  email_change_token_new = excluded.email_change_token_new,
  email_change = excluded.email_change,
  phone_change = excluded.phone_change,
  phone_change_token = excluded.phone_change_token,
  email_change_token_current = excluded.email_change_token_current,
  reauthentication_token = excluded.reauthentication_token,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    'admin@soulevents.test',
    '{"sub":"11111111-1111-4111-8111-111111111111","email":"admin@soulevents.test","email_verified":true}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-222222222222',
    'arrangoer@soulevents.test',
    '{"sub":"22222222-2222-4222-8222-222222222222","email":"arrangoer@soulevents.test","email_verified":true}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    '33333333-3333-4333-8333-333333333333',
    'deltager@soulevents.test',
    '{"sub":"33333333-3333-4333-8333-333333333333","email":"deltager@soulevents.test","email_verified":true}'::jsonb,
    'email',
    now(),
    now(),
    now()
  )
on conflict (provider, provider_id) do update
set
  identity_data = excluded.identity_data,
  updated_at = now();

insert into public.profiles (id, role, full_name, email, phone)
values
  ('11111111-1111-4111-8111-111111111111', 'admin', 'Lokal Admin', 'admin@soulevents.test', '+4500000001'),
  ('22222222-2222-4222-8222-222222222222', 'facilitator', 'Test Arrangør', 'arrangoer@soulevents.test', '+4500000002'),
  ('33333333-3333-4333-8333-333333333333', 'facilitator', 'Test Deltager', 'deltager@soulevents.test', '+4500000003')
on conflict (id) do update
set
  role = excluded.role,
  full_name = excluded.full_name,
  email = excluded.email,
  phone = excluded.phone;

insert into public.facilitator_profiles (
  id,
  profile_id,
  status,
  company_name,
  short_description,
  long_description,
  public_email,
  public_phone,
  address_line,
  postal_code,
  city,
  region_id,
  accepted_terms_at,
  accepted_privacy_at,
  accepted_guidelines_at
)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '22222222-2222-4222-8222-222222222222',
  'approved',
  'Lokal Test Arrangør',
  'Fiktiv arrangør til lokal udvikling.',
  'Denne profil er kun seedet i lokal Supabase og må aldrig repræsentere en rigtig person.',
  'arrangoer@soulevents.test',
  '+4500000002',
  'Testvej 1',
  '4000',
  'Roskilde',
  (select id from public.regions where slug = 'midtsjaelland' limit 1),
  now(),
  now(),
  now()
)
on conflict (profile_id) do update
set
  status = excluded.status,
  company_name = excluded.company_name,
  short_description = excluded.short_description,
  long_description = excluded.long_description,
  public_email = excluded.public_email,
  public_phone = excluded.public_phone,
  address_line = excluded.address_line,
  postal_code = excluded.postal_code,
  city = excluded.city,
  region_id = excluded.region_id,
  accepted_terms_at = excluded.accepted_terms_at,
  accepted_privacy_at = excluded.accepted_privacy_at,
  accepted_guidelines_at = excluded.accepted_guidelines_at;

insert into public.events (
  id,
  facilitator_id,
  status,
  title,
  slug,
  short_description,
  long_description,
  starts_at,
  ends_at,
  address_line,
  postal_code,
  city,
  region_id,
  price_cents,
  capacity,
  contact_email,
  contact_phone,
  event_format,
  country,
  registration_mode
)
values
  (
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'active',
    'Gratis lokal testcirkel',
    'gratis-lokal-testcirkel',
    'Gratis testevent til lokal udvikling.',
    'Fiktivt gratis event til test af SoulEvents-flowet.',
    now() + interval '14 days',
    now() + interval '14 days 2 hours',
    'Testvej 1',
    '4000',
    'Roskilde',
    (select id from public.regions where slug = 'midtsjaelland' limit 1),
    0,
    12,
    'arrangoer@soulevents.test',
    '+4500000002',
    'physical',
    'Danmark',
    'direct'
  ),
  (
    'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'active',
    'Betalt SoulEvents testevent',
    'betalt-soulevents-testevent',
    'Betalt testevent til booking og betalingsstatus.',
    'Fiktivt betalt event, hvor tilmelding håndteres i SoulEvents.',
    now() + interval '21 days',
    now() + interval '21 days 3 hours',
    'Testvej 2',
    '4000',
    'Roskilde',
    (select id from public.regions where slug = 'midtsjaelland' limit 1),
    25000,
    20,
    'arrangoer@soulevents.test',
    '+4500000002',
    'physical',
    'Danmark',
    'approval_required'
  ),
  (
    'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'active',
    'Ekstern tilmelding testevent',
    'ekstern-tilmelding-testevent',
    'Testevent hvor ekstern tilmelding bruges.',
    'Fiktivt event til test af ekstern registrering og manuelle deltagere.',
    now() + interval '28 days',
    now() + interval '28 days 2 hours',
    'Testvej 3',
    '4000',
    'Roskilde',
    (select id from public.regions where slug = 'midtsjaelland' limit 1),
    15000,
    30,
    'arrangoer@soulevents.test',
    '+4500000002',
    'physical',
    'Danmark',
    'approval_required'
  )
on conflict (id) do update
set
  status = excluded.status,
  title = excluded.title,
  slug = excluded.slug,
  short_description = excluded.short_description,
  long_description = excluded.long_description,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  price_cents = excluded.price_cents,
  capacity = excluded.capacity,
  registration_mode = excluded.registration_mode;

insert into public.event_payment_settings (
  event_id,
  facilitator_id,
  method_source,
  mobilepay_number,
  instructions,
  deadline_days,
  external_url,
  payment_link_mode
)
values
  (
    'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'custom',
    '00000000',
    'Lokal testbetaling. Send aldrig rigtige penge.',
    7,
    null,
    'payment_only'
  ),
  (
    'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'custom',
    null,
    'Ekstern testtilmelding. Linket er ikke en rigtig betalingsside.',
    7,
    'https://example.test/soulevents-ekstern-tilmelding',
    'external_registration'
  )
on conflict (event_id) do update
set
  method_source = excluded.method_source,
  mobilepay_number = excluded.mobilepay_number,
  instructions = excluded.instructions,
  deadline_days = excluded.deadline_days,
  external_url = excluded.external_url,
  payment_link_mode = excluded.payment_link_mode;

insert into public.bookings (
  id,
  event_id,
  facilitator_id,
  status,
  participant_name,
  participant_email,
  participant_phone,
  seats,
  message,
  event_title_snapshot,
  event_starts_at_snapshot,
  facilitator_name_snapshot,
  primary_category_snapshot,
  price_per_seat_cents,
  commission_calculated_at,
  reporting_month,
  booking_number,
  booking_reference,
  manually_marked_paid_at,
  manually_marked_paid_by,
  manual_payment_note
)
values
  (
    'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb',
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'confirmed',
    'Gratis Testdeltager',
    'gratis-deltager@soulevents.test',
    '+4500000101',
    1,
    'Seedet confirmed gratis booking.',
    'Gratis lokal testcirkel',
    now() + interval '14 days',
    'Lokal Test Arrangør',
    'Meditation',
    0,
    now(),
    date_trunc('month', now() + interval '14 days')::date,
    1,
    'SE-LOCAL-FREE-001',
    null,
    null,
    null
  ),
  (
    'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',
    'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'confirmed',
    'Betalt Testdeltager',
    'betalt-deltager@soulevents.test',
    '+4500000102',
    2,
    'Seedet confirmed booking markeret betalt.',
    'Betalt SoulEvents testevent',
    now() + interval '21 days',
    'Lokal Test Arrangør',
    'Meditation',
    25000,
    now(),
    date_trunc('month', now() + interval '21 days')::date,
    1,
    'SE-LOCAL-PAID-001',
    now(),
    '22222222-2222-4222-8222-222222222222',
    'Lokal seed: markeret betalt uden rigtig betaling.'
  ),
  (
    'bbbbbbbb-3333-4333-8333-bbbbbbbbbbbb',
    'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'pending',
    'Ubetalt Testdeltager',
    'ubetalt-deltager@soulevents.test',
    '+4500000103',
    1,
    'Seedet pending/ubetalt booking.',
    'Betalt SoulEvents testevent',
    now() + interval '21 days',
    'Lokal Test Arrangør',
    'Meditation',
    25000,
    now(),
    date_trunc('month', now() + interval '21 days')::date,
    2,
    'SE-LOCAL-PAID-002',
    null,
    null,
    null
  ),
  (
    'bbbbbbbb-4444-4444-8444-bbbbbbbbbbbb',
    'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'cancelled',
    'Annulleret Testdeltager',
    'annulleret-deltager@soulevents.test',
    '+4500000104',
    4,
    'Seedet cancelled booking. Skal ikke tælle med i kapacitet.',
    'Betalt SoulEvents testevent',
    now() + interval '21 days',
    'Lokal Test Arrangør',
    'Meditation',
    25000,
    now(),
    date_trunc('month', now() + interval '21 days')::date,
    3,
    'SE-LOCAL-PAID-003',
    null,
    null,
    null
  )
on conflict (id) do update
set
  status = excluded.status,
  seats = excluded.seats,
  message = excluded.message,
  manually_marked_paid_at = excluded.manually_marked_paid_at,
  booking_number = excluded.booking_number,
  booking_reference = excluded.booking_reference,
  manually_marked_paid_by = excluded.manually_marked_paid_by,
  manual_payment_note = excluded.manual_payment_note;

insert into public.external_event_participants (
  id,
  event_id,
  facilitator_id,
  participant_name,
  participant_email,
  participant_phone,
  seats,
  internal_note,
  source,
  created_by
)
values
  (
    'cccccccc-1111-4111-8111-cccccccccccc',
    'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Ekstern Testdeltager',
    'ekstern-deltager@soulevents.test',
    '+4500000201',
    3,
    'Seedet manuel ekstern deltager.',
    'manual',
    '22222222-2222-4222-8222-222222222222'
  )
on conflict (id) do update
set
  participant_name = excluded.participant_name,
  participant_email = excluded.participant_email,
  participant_phone = excluded.participant_phone,
  seats = excluded.seats,
  internal_note = excluded.internal_note;
