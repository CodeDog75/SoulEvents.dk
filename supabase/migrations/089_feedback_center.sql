-- Feedback Center V1
-- Isolated survey foundation for admin-created feedback forms.

create table if not exists public.feedback_surveys (
  id uuid primary key default gen_random_uuid(),
  token text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  title text not null,
  introduction text,
  thank_you_text text not null default 'Din feedback hjælper os med at gøre SoulEvents endnu bedre.',
  status text not null default 'draft',
  response_mode text not null default 'named',
  placement text not null default 'link_only',
  homepage_display_frequency text not null default 'once',
  final_question_enabled boolean not null default false,
  final_question_text text not null default 'Er der andet du synes vi bør vide?',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

alter table public.feedback_surveys
  add column if not exists token text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  add column if not exists title text not null default 'Nyt spørgeskema',
  add column if not exists introduction text,
  add column if not exists thank_you_text text not null default 'Din feedback hjælper os med at gøre SoulEvents endnu bedre.',
  add column if not exists status text not null default 'draft',
  add column if not exists response_mode text not null default 'named',
  add column if not exists placement text not null default 'link_only',
  add column if not exists homepage_display_frequency text not null default 'once',
  add column if not exists final_question_enabled boolean not null default false,
  add column if not exists final_question_text text not null default 'Er der andet du synes vi bør vide?',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists archived_at timestamptz;

alter table public.feedback_surveys drop constraint if exists feedback_surveys_token_not_blank;
alter table public.feedback_surveys add constraint feedback_surveys_token_not_blank
  check (length(trim(token)) >= 24);

alter table public.feedback_surveys drop constraint if exists feedback_surveys_title_not_blank;
alter table public.feedback_surveys add constraint feedback_surveys_title_not_blank
  check (length(trim(title)) > 0);

alter table public.feedback_surveys drop constraint if exists feedback_surveys_status_check;
alter table public.feedback_surveys add constraint feedback_surveys_status_check
  check (status in ('draft', 'active', 'closed', 'archived'));

alter table public.feedback_surveys drop constraint if exists feedback_surveys_response_mode_check;
alter table public.feedback_surveys add constraint feedback_surveys_response_mode_check
  check (response_mode in ('named', 'anonymous'));

alter table public.feedback_surveys drop constraint if exists feedback_surveys_placement_check;
alter table public.feedback_surveys add constraint feedback_surveys_placement_check
  check (placement in ('link_only', 'homepage_link'));

alter table public.feedback_surveys drop constraint if exists feedback_surveys_homepage_display_frequency_check;
alter table public.feedback_surveys add constraint feedback_surveys_homepage_display_frequency_check
  check (homepage_display_frequency in ('once', 'after_30_days', 'every_visit'));

create unique index if not exists feedback_surveys_token_key
  on public.feedback_surveys(token);

create index if not exists feedback_surveys_status_created_at_idx
  on public.feedback_surveys(status, created_at desc);

create index if not exists feedback_surveys_homepage_active_idx
  on public.feedback_surveys(status, placement, created_at desc)
  where status = 'active' and placement = 'homepage_link';

drop trigger if exists feedback_surveys_set_updated_at on public.feedback_surveys;
create trigger feedback_surveys_set_updated_at
before update on public.feedback_surveys
for each row execute function set_updated_at();

create table if not exists public.feedback_questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.feedback_surveys(id) on delete cascade,
  question_text text not null,
  question_type text not null,
  sort_order integer not null default 0,
  is_required boolean not null default true,
  rating_comment_enabled boolean not null default false,
  options jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.feedback_questions
  add column if not exists survey_id uuid references public.feedback_surveys(id) on delete cascade,
  add column if not exists question_text text not null default 'Spørgsmål',
  add column if not exists question_type text not null default 'free_text',
  add column if not exists sort_order integer not null default 0,
  add column if not exists is_required boolean not null default true,
  add column if not exists rating_comment_enabled boolean not null default false,
  add column if not exists options jsonb not null default '[]'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.feedback_questions drop constraint if exists feedback_questions_text_not_blank;
alter table public.feedback_questions add constraint feedback_questions_text_not_blank
  check (length(trim(question_text)) > 0);

alter table public.feedback_questions drop constraint if exists feedback_questions_type_check;
alter table public.feedback_questions add constraint feedback_questions_type_check
  check (question_type in ('rating', 'free_text', 'yes_no', 'multiple_choice'));

alter table public.feedback_questions drop constraint if exists feedback_questions_options_array_check;
alter table public.feedback_questions add constraint feedback_questions_options_array_check
  check (jsonb_typeof(options) = 'array');

create index if not exists feedback_questions_survey_sort_idx
  on public.feedback_questions(survey_id, sort_order, created_at);

drop trigger if exists feedback_questions_set_updated_at on public.feedback_questions;
create trigger feedback_questions_set_updated_at
before update on public.feedback_questions
for each row execute function set_updated_at();

create table if not exists public.feedback_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.feedback_surveys(id) on delete restrict,
  source text not null default 'direct',
  respondent_name text,
  respondent_email text,
  response_identity_hash text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.feedback_responses
  add column if not exists survey_id uuid references public.feedback_surveys(id) on delete restrict,
  add column if not exists source text not null default 'direct',
  add column if not exists respondent_name text,
  add column if not exists respondent_email text,
  add column if not exists response_identity_hash text,
  add column if not exists submitted_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now();

alter table public.feedback_responses drop constraint if exists feedback_responses_source_check;
alter table public.feedback_responses add constraint feedback_responses_source_check
  check (source in ('homepage', 'direct'));

create index if not exists feedback_responses_survey_submitted_idx
  on public.feedback_responses(survey_id, submitted_at desc);

create table if not exists public.feedback_answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.feedback_responses(id) on delete cascade,
  question_id uuid references public.feedback_questions(id) on delete set null,
  question_text_snapshot text not null,
  question_type text not null,
  rating_value integer,
  text_value text,
  boolean_value boolean,
  option_value text,
  rating_comment text,
  created_at timestamptz not null default now()
);

alter table public.feedback_answers
  add column if not exists response_id uuid references public.feedback_responses(id) on delete cascade,
  add column if not exists question_id uuid references public.feedback_questions(id) on delete set null,
  add column if not exists question_text_snapshot text not null default 'Spørgsmål',
  add column if not exists question_type text not null default 'free_text',
  add column if not exists rating_value integer,
  add column if not exists text_value text,
  add column if not exists boolean_value boolean,
  add column if not exists option_value text,
  add column if not exists rating_comment text,
  add column if not exists created_at timestamptz not null default now();

alter table public.feedback_answers drop constraint if exists feedback_answers_type_check;
alter table public.feedback_answers add constraint feedback_answers_type_check
  check (question_type in ('rating', 'free_text', 'yes_no', 'multiple_choice', 'final_text'));

alter table public.feedback_answers drop constraint if exists feedback_answers_rating_range_check;
alter table public.feedback_answers add constraint feedback_answers_rating_range_check
  check (rating_value is null or (rating_value >= 1 and rating_value <= 10));

create index if not exists feedback_answers_response_idx
  on public.feedback_answers(response_id);

create index if not exists feedback_answers_question_idx
  on public.feedback_answers(question_id);

alter table public.feedback_surveys enable row level security;
alter table public.feedback_questions enable row level security;
alter table public.feedback_responses enable row level security;
alter table public.feedback_answers enable row level security;

drop policy if exists "Public can read active feedback surveys" on public.feedback_surveys;
create policy "Public can read active feedback surveys"
on public.feedback_surveys
for select
to anon, authenticated
using (status = 'active' or private.is_admin());

drop policy if exists "Admins manage feedback surveys" on public.feedback_surveys;
create policy "Admins manage feedback surveys"
on public.feedback_surveys
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "Public can read questions for active feedback surveys" on public.feedback_questions;
create policy "Public can read questions for active feedback surveys"
on public.feedback_questions
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.feedback_surveys s
    where s.id = feedback_questions.survey_id
      and (s.status = 'active' or private.is_admin())
  )
);

drop policy if exists "Admins manage feedback questions" on public.feedback_questions;
create policy "Admins manage feedback questions"
on public.feedback_questions
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "Admins can read feedback responses" on public.feedback_responses;
create policy "Admins can read feedback responses"
on public.feedback_responses
for select
to authenticated
using (private.is_admin());

drop policy if exists "Admins can read feedback answers" on public.feedback_answers;
create policy "Admins can read feedback answers"
on public.feedback_answers
for select
to authenticated
using (private.is_admin());

drop policy if exists "Service role manages feedback responses" on public.feedback_responses;
create policy "Service role manages feedback responses"
on public.feedback_responses
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role manages feedback answers" on public.feedback_answers;
create policy "Service role manages feedback answers"
on public.feedback_answers
for all
to service_role
using (true)
with check (true);
