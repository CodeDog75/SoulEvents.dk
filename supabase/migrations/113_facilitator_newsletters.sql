create table if not exists public.facilitator_newsletter_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  facilitator_id uuid not null unique references public.facilitator_profiles(id) on delete cascade,
  status text not null default 'unsubscribed',
  consented_at timestamptz,
  consent_source text,
  unsubscribed_at timestamptz,
  unsubscribe_source text,
  unsubscribe_token_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint facilitator_newsletter_preferences_status_check check (status in ('subscribed', 'unsubscribed')),
  constraint facilitator_newsletter_preferences_consent_source_check check (
    consent_source is null or consent_source in ('signup', 'account_settings', 'migration_existing_consent')
  ),
  constraint facilitator_newsletter_preferences_unsubscribe_source_check check (
    unsubscribe_source is null or unsubscribe_source in ('signup', 'account_settings', 'admin', 'unsubscribe_link')
  )
);

create unique index if not exists facilitator_newsletter_preferences_token_hash_idx
  on public.facilitator_newsletter_preferences(unsubscribe_token_hash)
  where unsubscribe_token_hash is not null;

create index if not exists facilitator_newsletter_preferences_status_idx
  on public.facilitator_newsletter_preferences(status);

insert into public.facilitator_newsletter_preferences (
  profile_id,
  facilitator_id,
  status,
  consented_at,
  consent_source
)
select
  fp.profile_id,
  fp.id,
  'subscribed',
  now(),
  'migration_existing_consent'
from public.facilitator_profiles fp
join public.profiles p on p.id = fp.profile_id
where p.role = 'facilitator'
on conflict (profile_id) do nothing;

create table if not exists public.facilitator_newsletter_consent_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  facilitator_id uuid not null references public.facilitator_profiles(id) on delete cascade,
  action text not null,
  source text not null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint facilitator_newsletter_consent_events_action_check check (action in ('subscribed', 'unsubscribed')),
  constraint facilitator_newsletter_consent_events_source_check check (
    source in ('signup', 'account_settings', 'admin', 'unsubscribe_link', 'migration_existing_consent')
  )
);

create index if not exists facilitator_newsletter_consent_events_facilitator_idx
  on public.facilitator_newsletter_consent_events(facilitator_id, created_at desc);

insert into public.facilitator_newsletter_consent_events (
  profile_id,
  facilitator_id,
  action,
  source
)
select
  fp.profile_id,
  fp.id,
  'subscribed',
  'migration_existing_consent'
from public.facilitator_profiles fp
join public.profiles p on p.id = fp.profile_id
where p.role = 'facilitator'
  and exists (
    select 1
    from public.facilitator_newsletter_preferences pref
    where pref.profile_id = fp.profile_id
      and pref.consent_source = 'migration_existing_consent'
  );

create table if not exists public.admin_newsletters (
  id uuid primary key default gen_random_uuid(),
  subject text not null default '',
  preheader text,
  target_segment text not null default 'all',
  status text not null default 'draft',
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  locked_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_newsletters_target_segment_check check (target_segment in ('all', 'active', 'paused', 'onboarding')),
  constraint admin_newsletters_status_check check (status in ('draft', 'sending', 'sent', 'failed', 'cancelled'))
);

create index if not exists admin_newsletters_status_updated_idx
  on public.admin_newsletters(status, updated_at desc);

create table if not exists public.admin_newsletter_sections (
  id uuid primary key default gen_random_uuid(),
  newsletter_id uuid not null references public.admin_newsletters(id) on delete cascade,
  sort_order int not null default 0,
  heading text,
  body text,
  image_path text,
  image_layout text not null default 'none',
  image_focus text not null default 'center',
  button_label text,
  button_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_newsletter_sections_image_layout_check check (image_layout in ('none', 'wide', 'square')),
  constraint admin_newsletter_sections_image_focus_check check (image_focus in ('center', 'top', 'bottom', 'left', 'right'))
);

create index if not exists admin_newsletter_sections_newsletter_sort_idx
  on public.admin_newsletter_sections(newsletter_id, sort_order);

create table if not exists public.admin_newsletter_recipients (
  id uuid primary key default gen_random_uuid(),
  newsletter_id uuid not null references public.admin_newsletters(id) on delete cascade,
  facilitator_id uuid not null references public.facilitator_profiles(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  recipient_email text not null,
  recipient_name text,
  status text not null default 'pending',
  unsubscribe_token_hash text,
  resend_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_newsletter_recipients_status_check check (status in ('pending', 'sending', 'sent', 'failed', 'skipped', 'unsubscribed')),
  constraint admin_newsletter_recipients_unique_recipient unique (newsletter_id, profile_id)
);

create index if not exists admin_newsletter_recipients_newsletter_status_idx
  on public.admin_newsletter_recipients(newsletter_id, status);

create unique index if not exists admin_newsletter_recipients_token_hash_idx
  on public.admin_newsletter_recipients(unsubscribe_token_hash)
  where unsubscribe_token_hash is not null;

drop trigger if exists facilitator_newsletter_preferences_set_updated_at on public.facilitator_newsletter_preferences;
create trigger facilitator_newsletter_preferences_set_updated_at
before update on public.facilitator_newsletter_preferences
for each row execute function public.set_updated_at();

drop trigger if exists admin_newsletters_set_updated_at on public.admin_newsletters;
create trigger admin_newsletters_set_updated_at
before update on public.admin_newsletters
for each row execute function public.set_updated_at();

drop trigger if exists admin_newsletter_sections_set_updated_at on public.admin_newsletter_sections;
create trigger admin_newsletter_sections_set_updated_at
before update on public.admin_newsletter_sections
for each row execute function public.set_updated_at();

drop trigger if exists admin_newsletter_recipients_set_updated_at on public.admin_newsletter_recipients;
create trigger admin_newsletter_recipients_set_updated_at
before update on public.admin_newsletter_recipients
for each row execute function public.set_updated_at();

alter table public.facilitator_newsletter_preferences enable row level security;
alter table public.facilitator_newsletter_consent_events enable row level security;
alter table public.admin_newsletters enable row level security;
alter table public.admin_newsletter_sections enable row level security;
alter table public.admin_newsletter_recipients enable row level security;

drop policy if exists "Admins manage facilitator newsletter preferences" on public.facilitator_newsletter_preferences;
create policy "Admins manage facilitator newsletter preferences"
on public.facilitator_newsletter_preferences for all
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "Facilitators can read own newsletter preference" on public.facilitator_newsletter_preferences;
create policy "Facilitators can read own newsletter preference"
on public.facilitator_newsletter_preferences for select
using (profile_id = auth.uid());

drop policy if exists "Admins read facilitator newsletter consent history" on public.facilitator_newsletter_consent_events;
create policy "Admins read facilitator newsletter consent history"
on public.facilitator_newsletter_consent_events for select
using (private.is_admin());

drop policy if exists "Admins insert facilitator newsletter consent history" on public.facilitator_newsletter_consent_events;
create policy "Admins insert facilitator newsletter consent history"
on public.facilitator_newsletter_consent_events for insert
with check (private.is_admin());

drop policy if exists "Facilitators can read own newsletter consent history" on public.facilitator_newsletter_consent_events;
create policy "Facilitators can read own newsletter consent history"
on public.facilitator_newsletter_consent_events for select
using (profile_id = auth.uid());

drop policy if exists "Admins manage newsletters" on public.admin_newsletters;
create policy "Admins manage newsletters"
on public.admin_newsletters for all
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "Admins manage newsletter sections" on public.admin_newsletter_sections;
create policy "Admins manage newsletter sections"
on public.admin_newsletter_sections for all
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "Admins manage newsletter recipients" on public.admin_newsletter_recipients;
create policy "Admins manage newsletter recipients"
on public.admin_newsletter_recipients for all
using (private.is_admin())
with check (private.is_admin());

create table if not exists public.potential_facilitator_invitation_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Standard invitation',
  subject text not null default 'En varm invitation til SoulEvents',
  preheader text,
  intro text,
  body text not null,
  button_label text not null default 'Bliv arrangør på SoulEvents',
  button_url text not null default '/bliv-arrangoer',
  signoff text not null default 'De bedste hilsner
Rasmus
SoulEvents.dk',
  is_default boolean not null default false,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists potential_facilitator_invitation_templates_default_idx
  on public.potential_facilitator_invitation_templates(is_default)
  where is_default;

insert into public.potential_facilitator_invitation_templates (
  name,
  subject,
  preheader,
  body,
  button_label,
  button_url,
  signoff,
  is_default
)
values (
  'Standard invitation',
  'En varm invitation til SoulEvents',
  'En personlig og uforpligtende invitation til at blive arrangør på SoulEvents.',
  'Kære [navn]

[personlig_indledning]

Jeg har fået øje på dit arbejde og vil gerne sende dig en personlig invitation til at blive en del af SoulEvents.

SoulEvents er en ny platform for spirituelle events, personlig udvikling, nærvær og fællesskab. Ambitionen er at skabe et roligt og inspirerende sted, hvor dygtige arrangører og deres events bliver præsenteret med fokus på kvalitet.

Det er gratis at oprette en arrangørprofil og synliggøre dine events – både i hele Danmark og i udlandet. På din profil kan du samle din præsentation, billeder, videoer, kontaktoplysninger og kommende events, så interesserede lettere kan lære dig og dit arbejde at kende.

Sociale medier er stadig værdifulde, men i dag er det en fordel ikke kun at være afhængig af Facebook, Instagram og deres skiftende algoritmer. Indhold forsvinder hurtigt i strømmen, mens en selvstændig profil på SoulEvents giver dine events et mere varigt sted at blive fundet – også gennem Google og de nye AI-assistenter som ChatGPT, Claude og Gemini.

Jeg synes, at dit arbejde fortjener at blive fremhævet på en platform, hvor kvalitet og det spirituelle univers er i centrum.

SoulEvents er stadig ny og vokser stille og bevidst. Som arrangør får du derfor mulighed for at være med fra begyndelsen og vokse sammen med platformen og flere spændende arrangører fra hele landet.

Du kan læse mere og oprette din gratis profil her:

[Bliv arrangør på SoulEvents]

Invitationen er naturligvis helt uforpligtende.',
  'Bliv arrangør på SoulEvents',
  '/bliv-arrangoer',
  'De bedste hilsner
Rasmus
SoulEvents.dk',
  true
)
on conflict do nothing;

create table if not exists public.potential_facilitator_contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  contact_source text not null,
  lawful_contact_basis text not null,
  lawful_contact_confirmed_at timestamptz,
  lawful_contact_confirmed_by_profile_id uuid references public.profiles(id) on delete set null,
  invitation_status text not null default 'not_sent',
  invitation_sent_at timestamptz,
  response_notes text,
  no_contact_at timestamptz,
  no_contact_source text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  registered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint potential_facilitator_contacts_email_normalized_check check (email = lower(btrim(email))),
  constraint potential_facilitator_contacts_status_check check (
    invitation_status in ('not_sent', 'invited', 'replied', 'declined', 'no_contact')
  ),
  constraint potential_facilitator_contacts_no_contact_source_check check (
    no_contact_source is null or no_contact_source in ('admin', 'recipient_link', 'reply')
  )
);

create unique index if not exists potential_facilitator_contacts_email_idx
  on public.potential_facilitator_contacts(lower(email));

create index if not exists potential_facilitator_contacts_status_idx
  on public.potential_facilitator_contacts(invitation_status, updated_at desc);

create table if not exists public.potential_facilitator_invitation_suppressions (
  email text primary key,
  contact_id uuid references public.potential_facilitator_contacts(id) on delete set null,
  reason text,
  source text not null,
  suppressed_at timestamptz not null default now(),
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  constraint potential_facilitator_invitation_suppressions_email_normalized_check check (email = lower(btrim(email))),
  constraint potential_facilitator_invitation_suppressions_source_check check (
    source in ('admin', 'recipient_link', 'reply')
  )
);

create table if not exists public.potential_facilitator_invitation_sends (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.potential_facilitator_contacts(id) on delete set null,
  template_id uuid references public.potential_facilitator_invitation_templates(id) on delete set null,
  recipient_email text not null,
  recipient_name text,
  subject text not null,
  body_snapshot text not null,
  personal_intro_snapshot text,
  status text not null default 'pending',
  is_test boolean not null default false,
  unsubscribe_token_hash text,
  resend_message_id text,
  error_message text,
  sent_at timestamptz,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint potential_facilitator_invitation_sends_email_normalized_check check (recipient_email = lower(btrim(recipient_email))),
  constraint potential_facilitator_invitation_sends_status_check check (
    status in ('pending', 'sent', 'failed', 'suppressed')
  )
);

create unique index if not exists potential_facilitator_invitation_sends_token_hash_idx
  on public.potential_facilitator_invitation_sends(unsubscribe_token_hash)
  where unsubscribe_token_hash is not null;

create index if not exists potential_facilitator_invitation_sends_contact_idx
  on public.potential_facilitator_invitation_sends(contact_id, created_at desc);

create unique index if not exists potential_facilitator_invitation_sends_single_active_contact_idx
  on public.potential_facilitator_invitation_sends(contact_id)
  where contact_id is not null
    and is_test = false
    and status in ('pending', 'sent');

drop trigger if exists potential_facilitator_invitation_templates_set_updated_at on public.potential_facilitator_invitation_templates;
create trigger potential_facilitator_invitation_templates_set_updated_at
before update on public.potential_facilitator_invitation_templates
for each row execute function public.set_updated_at();

drop trigger if exists potential_facilitator_contacts_set_updated_at on public.potential_facilitator_contacts;
create trigger potential_facilitator_contacts_set_updated_at
before update on public.potential_facilitator_contacts
for each row execute function public.set_updated_at();

drop trigger if exists potential_facilitator_invitation_sends_set_updated_at on public.potential_facilitator_invitation_sends;
create trigger potential_facilitator_invitation_sends_set_updated_at
before update on public.potential_facilitator_invitation_sends
for each row execute function public.set_updated_at();

alter table public.potential_facilitator_invitation_templates enable row level security;
alter table public.potential_facilitator_contacts enable row level security;
alter table public.potential_facilitator_invitation_suppressions enable row level security;
alter table public.potential_facilitator_invitation_sends enable row level security;

drop policy if exists "Admins manage facilitator invitation templates" on public.potential_facilitator_invitation_templates;
create policy "Admins manage facilitator invitation templates"
on public.potential_facilitator_invitation_templates for all
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "Admins manage potential facilitator contacts" on public.potential_facilitator_contacts;
create policy "Admins manage potential facilitator contacts"
on public.potential_facilitator_contacts for all
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "Admins manage potential facilitator suppressions" on public.potential_facilitator_invitation_suppressions;
create policy "Admins manage potential facilitator suppressions"
on public.potential_facilitator_invitation_suppressions for all
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "Admins manage potential facilitator invitation sends" on public.potential_facilitator_invitation_sends;
create policy "Admins manage potential facilitator invitation sends"
on public.potential_facilitator_invitation_sends for all
using (private.is_admin())
with check (private.is_admin());
