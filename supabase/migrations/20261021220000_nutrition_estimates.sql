-- AI food logging: meal estimates from a sentence or a photo, private meal
-- photos, cards in chat, and a per-account AI allowance.
--
-- Idempotent. `reserve_ai_usage` keeps the exact behavior live in production on
-- 2026-10-21 (20 a UTC day on Free, 500 on Pro or an active referral bonus)
-- and only adds the per-account override.

-- Estimates -----------------------------------------------------------------
-- A draft the user reviews before anything is logged. Confirming it creates
-- food_entries; nothing is written to the log by the model alone.

create table if not exists public.food_estimates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  input_text text,
  photo_path text,
  items jsonb not null default '[]'::jsonb,
  provider text,
  model text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

do $$ begin
  alter table public.food_estimates add constraint food_estimates_kind_check
    check (kind = any (array['text','photo']));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.food_estimates add constraint food_estimates_status_check
    check (status = any (array['draft','confirmed','discarded']));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.food_estimates add constraint food_estimates_input_check
    check (input_text is null or length(input_text) <= 2000);
exception when duplicate_object then null; end $$;

create index if not exists food_estimates_user_created_idx on public.food_estimates (user_id, created_at desc);

alter table public.food_estimates enable row level security;
drop policy if exists "food_estimates all own" on public.food_estimates;
create policy "food_estimates all own" on public.food_estimates
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.food_estimates to authenticated;
grant all on public.food_estimates to service_role;

do $$ begin
  alter table public.food_entries add constraint food_entries_estimate_fk
    foreign key (estimate_id) references public.food_estimates(id) on delete set null;
exception when duplicate_object then null; end $$;

-- Chat cards ------------------------------------------------------------------
-- Structured attachments on an assistant reply (an estimate to confirm, a
-- logged weight with undo). Nullable; older messages are unchanged.

alter table public.chat_messages add column if not exists cards jsonb;

-- Per-account AI allowance ------------------------------------------------------

alter table public.user_limits add column if not exists ai_allowance_override integer;

do $$ begin
  alter table public.user_limits add constraint user_limits_ai_allowance_override_check
    check (ai_allowance_override is null or ai_allowance_override between 1 and 5000);
exception when duplicate_object then null; end $$;

create or replace function public.reserve_ai_usage(p_route text default 'ai'::text, p_model text default null::text, p_input_chars integer default 0)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_limit integer := 20;
  v_count integer;
begin
  if v_user is null then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text || (current_date)::text, 0));

  -- An override (requests per UTC day) wins over the plan allowance.
  select case
           when ai_allowance_override is not null then ai_allowance_override
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
$function$;

-- Meal photos -----------------------------------------------------------------
-- Private. Each user writes only inside a folder named with their own id.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', false, 2097152, array['image/jpeg','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "meal photos select own" on storage.objects;
create policy "meal photos select own" on storage.objects
for select to authenticated using (
  bucket_id = 'meal-photos' and (select auth.uid())::text = (storage.foldername(name))[1]
);

drop policy if exists "meal photos insert own" on storage.objects;
create policy "meal photos insert own" on storage.objects
for insert to authenticated with check (
  bucket_id = 'meal-photos' and (select auth.uid())::text = (storage.foldername(name))[1]
);

drop policy if exists "meal photos delete own" on storage.objects;
create policy "meal photos delete own" on storage.objects
for delete to authenticated using (
  bucket_id = 'meal-photos' and (select auth.uid())::text = (storage.foldername(name))[1]
);
