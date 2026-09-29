-- Production bug fix: restore the request rate limiter.
--
-- public.request_rate_limits and public.check_rate_limit() were defined in
-- 010_security_hardening.sql but that migration was never applied to production.
-- lib/rate-limit.ts calls check_rate_limit() and fails closed when the call
-- errors, so every support contact submission returned HTTP 429 with
-- "Too many requests" and no support request could reach the inbox.
--
-- This migration restores only the rate limiter. The rest of
-- 010_security_hardening.sql is already live, and its reserve_ai_usage()
-- definition is an older single-argument version that production has since
-- superseded (013_atomic_ai_quota.sql), so that file must not be replayed.
--
-- Note on search_path: pgcrypto is installed in the `extensions` schema on this
-- project, not `public`. The original definition set search_path to `public`
-- alone, which would leave digest() unresolvable and keep the function failing
-- at runtime. `extensions` is included below so digest() resolves.

create table if not exists public.request_rate_limits (
  scope text not null,
  key_hash text not null,
  window_start timestamptz not null,
  request_count integer not null default 1,
  primary key (scope, key_hash)
);

alter table public.request_rate_limits enable row level security;

-- Reached only through the security-definer function below, never directly by
-- a browser client.
revoke all on public.request_rate_limits from anon, authenticated;

create or replace function public.check_rate_limit(
  p_scope text,
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text := encode(digest(p_key, 'sha256'), 'hex');
  v_count integer;
begin
  insert into public.request_rate_limits (scope, key_hash, window_start, request_count)
  values (left(p_scope, 80), v_hash, now(), 1)
  on conflict (scope, key_hash) do update set
    window_start = case
      when request_rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
      then now()
      else request_rate_limits.window_start
    end,
    request_count = case
      when request_rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
      then 1
      else request_rate_limits.request_count + 1
    end
  returning request_count into v_count;

  return v_count <= p_limit;
end $$;

revoke all on function public.check_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, text, integer, integer) to service_role;
