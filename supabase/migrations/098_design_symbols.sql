create table if not exists public.design_symbols (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category text not null default 'Generelt',
  svg_path text not null,
  original_svg_path text,
  background_color text not null default '#EEF5EA',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint design_symbols_name_check check (char_length(trim(name)) between 1 and 80),
  constraint design_symbols_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint design_symbols_background_color_check check (background_color ~ '^#[0-9A-Fa-f]{6}$')
);

create table if not exists public.facilitator_profile_symbols (
  facilitator_id uuid not null references public.facilitator_profiles(id) on delete cascade,
  symbol_id uuid not null references public.design_symbols(id) on delete restrict,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (facilitator_id, symbol_id),
  constraint facilitator_profile_symbols_facilitator_sort_order_key unique (facilitator_id, sort_order),
  constraint facilitator_profile_symbols_sort_order_check check (sort_order >= 0 and sort_order < 2)
);

create index if not exists design_symbols_active_order_idx
  on public.design_symbols (is_active, sort_order, name);

create index if not exists facilitator_profile_symbols_symbol_idx
  on public.facilitator_profile_symbols (symbol_id);

drop trigger if exists design_symbols_set_updated_at on public.design_symbols;
create trigger design_symbols_set_updated_at
before update on public.design_symbols
for each row execute function public.set_updated_at();

alter table public.design_symbols enable row level security;
alter table public.facilitator_profile_symbols enable row level security;

drop policy if exists "Public can read active design symbols" on public.design_symbols;
create policy "Public can read active design symbols"
on public.design_symbols for select
to anon, authenticated
using (is_active = true or private.is_admin());

drop policy if exists "Admins can manage design symbols" on public.design_symbols;
create policy "Admins can manage design symbols"
on public.design_symbols for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "Public can read facilitator profile symbols" on public.facilitator_profile_symbols;
create policy "Public can read facilitator profile symbols"
on public.facilitator_profile_symbols for select
to anon, authenticated
using (
  (
    exists (
      select 1
      from public.design_symbols ds
      where ds.id = facilitator_profile_symbols.symbol_id
        and ds.is_active = true
    )
    and (
      exists (
        select 1
        from public.facilitator_profiles fp
        where fp.id = facilitator_profile_symbols.facilitator_id
          and public.facilitator_is_public(fp)
      )
      or exists (
        select 1
        from public.facilitator_profiles fp
        where fp.id = facilitator_profile_symbols.facilitator_id
          and fp.profile_id = auth.uid()
      )
    )
  )
  or private.is_admin()
);

drop policy if exists "Facilitators can manage own profile symbols" on public.facilitator_profile_symbols;
create policy "Facilitators can manage own profile symbols"
on public.facilitator_profile_symbols for all
to authenticated
using (
  exists (
    select 1
    from public.facilitator_profiles fp
    where fp.id = facilitator_profile_symbols.facilitator_id
      and fp.profile_id = auth.uid()
  )
  or private.is_admin()
)
with check (
  (
    exists (
      select 1
      from public.facilitator_profiles fp
      where fp.id = facilitator_profile_symbols.facilitator_id
        and fp.profile_id = auth.uid()
    )
    and exists (
      select 1
      from public.design_symbols ds
      where ds.id = facilitator_profile_symbols.symbol_id
        and ds.is_active = true
    )
  )
  or private.is_admin()
);

notify pgrst, 'reload schema';
