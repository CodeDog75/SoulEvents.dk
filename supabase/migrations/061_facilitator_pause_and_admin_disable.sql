alter table public.facilitator_profiles
  add column if not exists is_paused boolean not null default false,
  add column if not exists is_disabled boolean not null default false,
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_by uuid references public.profiles(id) on delete set null,
  add column if not exists disabled_reason text;

update public.facilitator_profiles
set
  is_paused = true,
  status = 'approved'
where status = 'disabled'
  and is_paused = false
  and is_disabled = false;

create index if not exists facilitator_profiles_public_visibility_idx
  on public.facilitator_profiles(status, is_paused, is_disabled);

create or replace function public.facilitator_is_public(fp public.facilitator_profiles)
returns boolean
language sql
stable
as $$
  select fp.status = 'approved'
    and coalesce(fp.is_paused, false) = false
    and coalesce(fp.is_disabled, false) = false
$$;

create or replace function public.current_facilitator_is_enabled(facilitator_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.facilitator_profiles fp
    where fp.id = facilitator_profile_id
      and fp.profile_id = auth.uid()
      and coalesce(fp.is_disabled, false) = false
  )
$$;

drop policy if exists "Public can read approved facilitator profiles" on public.facilitator_profiles;
create policy "Public can read visible facilitator profiles"
on public.facilitator_profiles for select
using (
  public.facilitator_is_public(facilitator_profiles)
  or (profile_id = auth.uid() and coalesce(is_disabled, false) = false)
  or private.is_admin()
);

drop policy if exists "Facilitators can update own facilitator profile" on public.facilitator_profiles;
create policy "Enabled facilitators can update own facilitator profile"
on public.facilitator_profiles for update
using ((profile_id = auth.uid() and coalesce(is_disabled, false) = false) or private.is_admin())
with check ((profile_id = auth.uid() and coalesce(is_disabled, false) = false) or private.is_admin());

drop policy if exists "Public can read approved facilitator images" on public.facilitator_images;
create policy "Public can read visible facilitator images"
on public.facilitator_images for select
using (
  exists (
    select 1
    from public.facilitator_profiles fp
    where fp.id = facilitator_images.facilitator_id
      and (
        public.facilitator_is_public(fp)
        or (fp.profile_id = auth.uid() and coalesce(fp.is_disabled, false) = false)
        or private.is_admin()
      )
  )
);

drop policy if exists "Facilitators manage own images" on public.facilitator_images;
create policy "Enabled facilitators manage own images"
on public.facilitator_images for all
using (private.is_admin() or public.current_facilitator_is_enabled(facilitator_id))
with check (private.is_admin() or public.current_facilitator_is_enabled(facilitator_id));

drop policy if exists "Facilitators manage own categories" on public.facilitator_categories;
create policy "Enabled facilitators manage own categories"
on public.facilitator_categories for all
using (private.is_admin() or public.current_facilitator_is_enabled(facilitator_id))
with check (private.is_admin() or public.current_facilitator_is_enabled(facilitator_id));

drop policy if exists "Public can read active approved events" on public.events;
create policy "Public can read active visible events"
on public.events for select
using (
  private.is_admin()
  or public.current_facilitator_is_enabled(events.facilitator_id)
  or (
    status = 'active'
    and starts_at >= now()
    and exists (
      select 1
      from public.facilitator_profiles fp
      where fp.id = events.facilitator_id
        and public.facilitator_is_public(fp)
    )
  )
);

drop policy if exists "Facilitators manage own events" on public.events;
create policy "Enabled facilitators manage own events"
on public.events for all
using (private.is_admin() or public.current_facilitator_is_enabled(facilitator_id))
with check (private.is_admin() or public.current_facilitator_is_enabled(facilitator_id));

drop policy if exists "Facilitators manage own event categories" on public.event_categories;
create policy "Enabled facilitators manage own event categories"
on public.event_categories for all
using (
  private.is_admin()
  or exists (
    select 1
    from public.events e
    where e.id = event_categories.event_id
      and public.current_facilitator_is_enabled(e.facilitator_id)
  )
)
with check (
  private.is_admin()
  or exists (
    select 1
    from public.events e
    where e.id = event_categories.event_id
      and public.current_facilitator_is_enabled(e.facilitator_id)
  )
);
