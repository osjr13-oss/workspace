-- Growth feature: referral unlock. Every user gets a personal referral code;
-- once 3 people sign up through it, the referrer gets 30 days of Pro-equivalent
-- limits, tracked independently of Stripe subscription state.

alter table public.user_limits
  add column if not exists referral_code text;

create unique index if not exists user_limits_referral_code_key
  on public.user_limits (referral_code)
  where referral_code is not null;

alter table public.user_limits
  add column if not exists referral_bonus_active boolean not null default false;

alter table public.user_limits
  add column if not exists referral_bonus_until timestamptz;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_id uuid not null references auth.users(id) on delete cascade unique,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'referrals_no_self_referral'
  ) then
    alter table public.referrals
      add constraint referrals_no_self_referral check (referrer_id <> referred_id);
  end if;
end;
$$;

create index if not exists referrals_referrer_idx on public.referrals (referrer_id);

alter table public.referrals enable row level security;

-- Users may only ever read referrals they are the referrer on. All inserts
-- happen server-side via the service role (see lib/referrals.ts) after a new
-- signup is confirmed — never directly from the client.
drop policy if exists "referrals select own" on public.referrals;
create policy "referrals select own" on public.referrals
  for select
  using (auth.uid() = referrer_id);

revoke insert, update, delete on public.referrals from anon, authenticated;
grant select on public.referrals to authenticated;

-- Extend the existing atomic AI-quota reservation to also treat an active
-- referral bonus as Pro-equivalent, alongside (not instead of) the Stripe
-- check. Without this, the bonus would show 500/day in the UI but still be
-- capped at 20/day by this function, which is the actual enforcement path
-- used by app/api/ai/chat/route.ts.
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

  perform pg_advisory_xact_lock(hashtextextended(v_user::text || (current_date)::text, 0));

  select case
           when tier = 'pro' and subscription_status in ('active', 'trialing') then 500
           when referral_bonus_active and referral_bonus_until > now() then 500
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

-- Same extension for the project/deck creation limit trigger, so an active
-- referral bonus actually lifts the free-plan resource caps at the DB layer,
-- not just in the UI.
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
    if v_count >= 5 then raise exception 'Free plan deck limit reached'; end if;
  end if;

  return new;
end;
$$;
