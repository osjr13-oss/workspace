-- Founding pricing limits (2026-08):
-- Free: 20 AI/day, 3 projects, 20 MB files, 8 flashcard decks
-- Pro / referral-bonus: 1500 AI/month, unlimited projects and decks, 100 MB files
-- Idempotent: safe to re-run; replaces reserve_ai_usage and enforce_plan_resource_limits bodies.

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
  v_is_pro boolean := false;
  v_period_start timestamptz;
  v_lock_key text;
begin
  if v_user is null then
    return false;
  end if;

  select case
           when tier = 'pro' and subscription_status in ('active', 'trialing') then true
           when referral_bonus_active and referral_bonus_until > now() then true
           else false
         end
    into v_is_pro
  from public.user_limits
  where user_id = v_user;

  if coalesce(v_is_pro, false) then
    v_limit := 1500;
    v_period_start := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
    v_lock_key := v_user::text || ':month:' || to_char(v_period_start, 'YYYY-MM');
  else
    v_limit := 20;
    v_period_start := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
    v_lock_key := v_user::text || ':day:' || to_char(v_period_start, 'YYYY-MM-DD');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));

  select count(*)
    into v_count
  from public.ai_usage_events
  where user_id = v_user
    and created_at >= v_period_start;

  if v_count >= coalesce(v_limit, 20) then
    return false;
  end if;

  insert into public.ai_usage_events (user_id, route, model, input_chars)
  values (v_user, left(p_route, 80), p_model, greatest(coalesce(p_input_chars, 0), 0));

  return true;
end;
$$;

grant execute on function public.reserve_ai_usage(text, text, integer) to authenticated;

create or replace function public.enforce_plan_resource_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier text;
  v_status text;
  v_bonus_active boolean;
  v_bonus_until timestamptz;
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || ':' || tg_table_name, 0));

  select tier, subscription_status, referral_bonus_active, referral_bonus_until
    into v_tier, v_status, v_bonus_active, v_bonus_until
  from public.user_limits
  where user_id = new.user_id;

  if v_tier = 'pro' and v_status in ('active', 'trialing') then
    return new;
  end if;

  if v_bonus_active and v_bonus_until is not null and v_bonus_until > now() then
    return new;
  end if;

  if tg_table_name = 'projects' then
    select count(*) into v_count from public.projects where user_id = new.user_id;
    if v_count >= 3 then raise exception 'Free plan project limit reached'; end if;
  elsif tg_table_name = 'flashcard_decks' then
    select count(*) into v_count from public.flashcard_decks where user_id = new.user_id;
    if v_count >= 8 then raise exception 'Free plan deck limit reached'; end if;
  end if;

  return new;
end;
$$;
