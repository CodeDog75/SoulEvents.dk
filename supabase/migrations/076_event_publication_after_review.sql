alter table public.events
  add column if not exists published_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;

update public.events
set published_at = coalesce(published_at, created_at)
where status in ('active', 'sold_out')
  and published_at is null;

create index if not exists events_published_at_idx
  on public.events(published_at desc);

create index if not exists events_reviewed_at_idx
  on public.events(reviewed_at);

create index if not exists events_public_after_review_idx
  on public.events(status, reviewed_at, published_at desc)
  where status in ('active', 'sold_out');
