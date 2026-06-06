create or replace function public.current_app_role()
returns app_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_app_role() = 'admin', false)
$$;

create policy "Public can read regions"
on regions for select
using (true);

create policy "Public can read active categories"
on categories for select
using (is_active = true or public.is_admin());

create policy "Admins manage categories"
on categories for all
using (public.is_admin())
with check (public.is_admin());

create policy "Users can read own profile"
on profiles for select
using (id = auth.uid() or public.is_admin());

create policy "Users can update own profile basics"
on profiles for update
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy "Admins manage profiles"
on profiles for all
using (public.is_admin())
with check (public.is_admin());

create policy "Public can read approved facilitator profiles"
on facilitator_profiles for select
using (status = 'approved' or profile_id = auth.uid() or public.is_admin());

create policy "Facilitators can update own facilitator profile"
on facilitator_profiles for update
using (profile_id = auth.uid() or public.is_admin())
with check (profile_id = auth.uid() or public.is_admin());

create policy "Admins manage facilitator profiles"
on facilitator_profiles for all
using (public.is_admin())
with check (public.is_admin());

create policy "Public can read facilitator categories"
on facilitator_categories for select
using (true);

create policy "Facilitators manage own categories"
on facilitator_categories for all
using (
  public.is_admin()
  or exists (
    select 1
    from facilitator_profiles fp
    where fp.id = facilitator_categories.facilitator_id
      and fp.profile_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from facilitator_profiles fp
    where fp.id = facilitator_categories.facilitator_id
      and fp.profile_id = auth.uid()
  )
);

create policy "Public can read approved facilitator images"
on facilitator_images for select
using (
  exists (
    select 1
    from facilitator_profiles fp
    where fp.id = facilitator_images.facilitator_id
      and (fp.status = 'approved' or fp.profile_id = auth.uid() or public.is_admin())
  )
);

create policy "Facilitators manage own images"
on facilitator_images for all
using (
  public.is_admin()
  or exists (
    select 1
    from facilitator_profiles fp
    where fp.id = facilitator_images.facilitator_id
      and fp.profile_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from facilitator_profiles fp
    where fp.id = facilitator_images.facilitator_id
      and fp.profile_id = auth.uid()
  )
);

create policy "Public can read active approved events"
on events for select
using (
  public.is_admin()
  or exists (
    select 1
    from facilitator_profiles fp
    where fp.id = events.facilitator_id
      and fp.profile_id = auth.uid()
  )
  or (
    status = 'active'
    and starts_at >= now()
    and exists (
      select 1
      from facilitator_profiles fp
      where fp.id = events.facilitator_id
        and fp.status = 'approved'
    )
  )
);

create policy "Facilitators manage own events"
on events for all
using (
  public.is_admin()
  or exists (
    select 1
    from facilitator_profiles fp
    where fp.id = events.facilitator_id
      and fp.profile_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from facilitator_profiles fp
    where fp.id = events.facilitator_id
      and fp.profile_id = auth.uid()
  )
);

create policy "Public can read event categories"
on event_categories for select
using (true);

create policy "Facilitators manage own event categories"
on event_categories for all
using (
  public.is_admin()
  or exists (
    select 1
    from events e
    join facilitator_profiles fp on fp.id = e.facilitator_id
    where e.id = event_categories.event_id
      and fp.profile_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from events e
    join facilitator_profiles fp on fp.id = e.facilitator_id
    where e.id = event_categories.event_id
      and fp.profile_id = auth.uid()
  )
);

create policy "Public can read event images for visible events"
on event_images for select
using (
  exists (
    select 1
    from events e
    join facilitator_profiles fp on fp.id = e.facilitator_id
    where e.id = event_images.event_id
      and (
        public.is_admin()
        or fp.profile_id = auth.uid()
        or (e.status = 'active' and e.starts_at >= now() and fp.status = 'approved')
      )
  )
);

create policy "Facilitators manage own event images"
on event_images for all
using (
  public.is_admin()
  or exists (
    select 1
    from events e
    join facilitator_profiles fp on fp.id = e.facilitator_id
    where e.id = event_images.event_id
      and fp.profile_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from events e
    join facilitator_profiles fp on fp.id = e.facilitator_id
    where e.id = event_images.event_id
      and fp.profile_id = auth.uid()
  )
);

create policy "Facilitators and admins can read relevant bookings"
on bookings for select
using (
  public.is_admin()
  or exists (
    select 1
    from facilitator_profiles fp
    where fp.id = bookings.facilitator_id
      and fp.profile_id = auth.uid()
  )
);

create policy "Facilitators and admins can update booking status"
on bookings for update
using (
  public.is_admin()
  or exists (
    select 1
    from facilitator_profiles fp
    where fp.id = bookings.facilitator_id
      and fp.profile_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from facilitator_profiles fp
    where fp.id = bookings.facilitator_id
      and fp.profile_id = auth.uid()
  )
);
