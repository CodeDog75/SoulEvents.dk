create table if not exists public.rate_limits (
  key text primary key,
  action text not null,
  ip_hash text not null,
  window_start timestamptz not null default now(),
  count integer not null default 0,
  blocked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rate_limits enable row level security;

revoke all on public.rate_limits from anon;
revoke all on public.rate_limits from authenticated;

create index if not exists rate_limits_action_ip_idx
  on public.rate_limits (action, ip_hash);

create index if not exists rate_limits_cleanup_idx
  on public.rate_limits (window_start, blocked_until);

create or replace function public.check_rate_limit(
  p_action text,
  p_ip_hash text,
  p_limit integer,
  p_window_seconds integer,
  p_block_seconds integer
)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := p_action || ':' || p_ip_hash;
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_count integer;
  v_blocked_until timestamptz;
  v_retry_after integer;
begin
  insert into public.rate_limits (key, action, ip_hash, window_start, count, blocked_until, updated_at)
  values (v_key, p_action, p_ip_hash, v_now, 0, null, v_now)
  on conflict (key) do nothing;

  select window_start, count, blocked_until
  into v_window_start, v_count, v_blocked_until
  from public.rate_limits
  where key = v_key
  for update;

  if v_blocked_until is not null and v_blocked_until > v_now then
    v_retry_after := greatest(1, ceil(extract(epoch from (v_blocked_until - v_now)))::integer);
    return query select false, v_retry_after;
    return;
  end if;

  if v_window_start <= v_now - make_interval(secs => p_window_seconds) then
    update public.rate_limits
    set
      window_start = v_now,
      count = 1,
      blocked_until = null,
      updated_at = v_now
    where key = v_key;

    return query select true, 0;
    return;
  end if;

  if v_count >= p_limit then
    update public.rate_limits
    set
      blocked_until = v_now + make_interval(secs => greatest(p_block_seconds, p_window_seconds)),
      updated_at = v_now
    where key = v_key;

    return query select false, greatest(p_block_seconds, p_window_seconds);
    return;
  end if;

  update public.rate_limits
  set
    count = count + 1,
    blocked_until = null,
    updated_at = v_now
  where key = v_key;

  return query select true, 0;
end;
$$;

revoke all on function public.check_rate_limit(text, text, integer, integer, integer) from public;
grant execute on function public.check_rate_limit(text, text, integer, integer, integer) to service_role;
