create table if not exists facilitator_tags (
  facilitator_id uuid not null references facilitator_profiles(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete restrict,
  primary key (facilitator_id, tag_id)
);

alter table facilitator_tags enable row level security;

drop policy if exists "Public can read facilitator tags" on facilitator_tags;
create policy "Public can read facilitator tags"
on facilitator_tags for select
using (true);

drop policy if exists "Facilitators manage own facilitator tags" on facilitator_tags;
create policy "Facilitators manage own facilitator tags"
on facilitator_tags for all
using (
  public.is_admin() or exists (
    select 1
    from facilitator_profiles fp
    where fp.id = facilitator_tags.facilitator_id
      and fp.profile_id = auth.uid()
  )
)
with check (
  public.is_admin() or exists (
    select 1
    from facilitator_profiles fp
    where fp.id = facilitator_tags.facilitator_id
      and fp.profile_id = auth.uid()
  )
);

drop policy if exists "Admins manage facilitator tags" on facilitator_tags;
create policy "Admins manage facilitator tags"
on facilitator_tags for all
using (public.is_admin())
with check (public.is_admin());
