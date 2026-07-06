-- Fix and enable atomic AI quota reservation.
--
-- Background: migration 010 defined reserve_ai_usage() but its first line referenced
-- trigger-only variables (new.user_id / tg_table_name), so it errored on every call and
-- was never wired into the app. The app instead used a non-atomic "count then insert"
-- path, which let two concurrent requests both pass the check and exceed the daily limit.
--
-- This replaces it with a correct, atomic version: it takes a per-user, per-day advisory
-- lock, checks the limit, and records the usage row inside a single transaction — so
-- concurrent requests can no longer slip past the cap.

drop function if exists public.reserve_ai_usage(text);

create or replace function public.reserve_ai_usage(
  p_route text default 'ai',
  p_model text default null,
  p_input_chars integer default 0
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_limit integer := 20;
  v_count integer;
begin
  if v_user is null then
    return false;
  end if;

  -- Serialize this user's requests for the current UTC day so the count-then-insert
  -- below cannot race with a concurrent request from the same user.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || (current_date)::text, 0));

  select case
           when tier = 'pro' and subscription_status in ('active', 'trialing') then 500
           else 20
         end
    into v_limit
  from public.user_limits
  where user_id = v_user;

  select count(*)
    into v_count
  from public.ai_usage_events
  where user_id = v_user
    and created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc');

  if v_count >= coalesce(v_limit, 20) then
    return false;
  end if;

  insert into public.ai_usage_events (user_id, route, model, input_chars)
  values (v_user, left(p_route, 80), p_model, greatest(coalesce(p_input_chars, 0), 0));

  return true;
end;
$$;

grant execute on function public.reserve_ai_usage(text, text, integer) to authenticated;
