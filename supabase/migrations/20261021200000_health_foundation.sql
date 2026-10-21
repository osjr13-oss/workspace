-- Health foundation: the profile and targets behind Today, food and weight logs.
--
-- Owner decision 2026-10-21: Selrano is a personal health and weight-loss app.
-- Every table belongs to one user and is guarded by row-level security, except
-- `foods`, a shared cache of public nutrition data (USDA FoodData Central and
-- Open Food Facts) that only the server writes.
--
-- Calendar days are stored as plain dates in the user's own timezone
-- (`local_date`), because "today" means the user's today, not UTC's.
--
-- Idempotent: safe to run more than once. Nothing existing is altered.

-- Profile -------------------------------------------------------------------

create table if not exists public.health_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  birth_date date,
  sex_for_calc text not null default 'unspecified',
  height_cm numeric(5,1),
  activity_level text not null default 'light',
  goal text not null default 'lose',
  goal_weight_kg numeric(5,2),
  weekly_rate_kg numeric(4,2) not null default 0.5,
  units text not null default 'metric',
  timezone text not null default 'UTC',
  target_mode text not null default 'auto',
  manual_calories integer,
  protein_g_per_kg numeric(3,1) not null default 1.6,
  caution_flags text[] not null default '{}',
  coach_mode text not null default 'standard',
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table public.health_profiles add constraint health_profiles_sex_check
    check (sex_for_calc = any (array['male','female','unspecified']));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.health_profiles add constraint health_profiles_height_check
    check (height_cm is null or height_cm between 100 and 250);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.health_profiles add constraint health_profiles_activity_check
    check (activity_level = any (array['sedentary','light','moderate','active','very_active']));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.health_profiles add constraint health_profiles_goal_check
    check (goal = any (array['lose','maintain','gain']));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.health_profiles add constraint health_profiles_goal_weight_check
    check (goal_weight_kg is null or goal_weight_kg between 30 and 300);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.health_profiles add constraint health_profiles_rate_check
    check (weekly_rate_kg between 0 and 1);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.health_profiles add constraint health_profiles_units_check
    check (units = any (array['metric','imperial']));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.health_profiles add constraint health_profiles_target_mode_check
    check (target_mode = any (array['auto','manual']));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.health_profiles add constraint health_profiles_manual_calories_check
    check (manual_calories is null or manual_calories between 1000 and 6000);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.health_profiles add constraint health_profiles_protein_check
    check (protein_g_per_kg between 0.8 and 2.5);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.health_profiles add constraint health_profiles_flags_check
    check (caution_flags <@ array['pregnant','breastfeeding','diabetes_meds','ed_history','kidney','other_condition']::text[]);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.health_profiles add constraint health_profiles_coach_mode_check
    check (coach_mode = any (array['standard','gentle']));
exception when duplicate_object then null; end $$;

-- Targets -------------------------------------------------------------------
-- A snapshot per change, so editing targets never rewrites past days. The
-- target for a day is the row with the latest effective_date on or before it.

create table if not exists public.daily_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  effective_date date not null,
  calories integer not null,
  protein_g integer not null,
  carbs_g integer not null,
  fat_g integer not null,
  method text not null,
  tdee_estimate integer,
  inputs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, effective_date)
);

do $$ begin
  alter table public.daily_targets add constraint daily_targets_calories_check
    check (calories between 1000 and 6000);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.daily_targets add constraint daily_targets_macros_check
    check (protein_g between 0 and 500 and carbs_g between 0 and 1000 and fat_g between 0 and 400);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.daily_targets add constraint daily_targets_method_check
    check (method = any (array['mifflin','adaptive','manual']));
exception when duplicate_object then null; end $$;

-- Weight --------------------------------------------------------------------

create table if not exists public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_at timestamptz not null default now(),
  local_date date not null,
  weight_kg numeric(5,2) not null,
  note text,
  source text not null default 'manual',
  client_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);

do $$ begin
  alter table public.weight_entries add constraint weight_entries_weight_check
    check (weight_kg between 20 and 400);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.weight_entries add constraint weight_entries_source_check
    check (source = any (array['manual','chat','healthkit']));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.weight_entries add constraint weight_entries_note_check
    check (note is null or length(note) <= 500);
exception when duplicate_object then null; end $$;

create index if not exists weight_entries_user_date_idx
  on public.weight_entries (user_id, local_date desc);

-- Food database cache -------------------------------------------------------
-- Public nutrition data, values per 100 g. Shared by every account; written
-- only by the server.

create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_id text not null,
  barcode text,
  name text not null,
  brand text,
  kcal_100g numeric(7,2) not null,
  protein_100g numeric(6,2) not null default 0,
  carbs_100g numeric(6,2) not null default 0,
  fat_100g numeric(6,2) not null default 0,
  fiber_100g numeric(6,2),
  servings jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now(),
  unique (source, source_id)
);

do $$ begin
  alter table public.foods add constraint foods_source_check
    check (source = any (array['usda','off']));
exception when duplicate_object then null; end $$;

create index if not exists foods_barcode_idx on public.foods (barcode) where barcode is not null;

-- Food log ------------------------------------------------------------------
-- One row per item eaten. Nutrition is stored on the row, so later changes to
-- a cached food never change what was logged.

create table if not exists public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  logged_at timestamptz not null default now(),
  meal text not null,
  name text not null,
  brand text,
  quantity numeric(8,2) not null default 1,
  unit text not null default 'serving',
  grams numeric(7,1),
  kcal numeric(7,1) not null,
  protein_g numeric(6,1) not null default 0,
  carbs_g numeric(6,1) not null default 0,
  fat_g numeric(6,1) not null default 0,
  fiber_g numeric(6,1),
  source text not null,
  food_id uuid references public.foods(id) on delete set null,
  confidence text,
  estimate_id uuid,
  photo_path text,
  client_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);

do $$ begin
  alter table public.food_entries add constraint food_entries_meal_check
    check (meal = any (array['breakfast','lunch','dinner','snack']));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.food_entries add constraint food_entries_name_check
    check (length(btrim(name)) between 1 and 200);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.food_entries add constraint food_entries_amounts_check
    check (
      quantity > 0 and quantity <= 10000
      and (grams is null or grams between 0 and 5000)
      and kcal between 0 and 10000
      and protein_g between 0 and 1000 and carbs_g between 0 and 1000 and fat_g between 0 and 1000
      and (fiber_g is null or fiber_g between 0 and 1000)
    );
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.food_entries add constraint food_entries_source_check
    check (source = any (array['usda','off','ai_text','ai_photo','manual','saved']));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.food_entries add constraint food_entries_confidence_check
    check (confidence is null or confidence = any (array['high','medium','low']));
exception when duplicate_object then null; end $$;

create index if not exists food_entries_user_date_idx
  on public.food_entries (user_id, local_date);
create index if not exists food_entries_user_logged_idx
  on public.food_entries (user_id, logged_at desc);

-- Saved meals (favorites and custom foods) -----------------------------------

create table if not exists public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  items jsonb not null,
  use_count integer not null default 0,
  last_used_at timestamptz,
  favorite boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table public.saved_meals add constraint saved_meals_name_check
    check (length(btrim(name)) between 1 and 120);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.saved_meals add constraint saved_meals_items_check
    check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 20);
exception when duplicate_object then null; end $$;

create index if not exists saved_meals_user_idx on public.saved_meals (user_id, last_used_at desc nulls last);

-- Day status ----------------------------------------------------------------
-- "This day is fully logged." Adaptive targets later trust only complete days.

create table if not exists public.food_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date)
);

-- Timestamps ----------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['health_profiles','daily_targets','weight_entries','food_entries','saved_meals','food_days'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- Row-level security ----------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['health_profiles','daily_targets','weight_entries','food_entries','saved_meals','food_days'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || ' all own', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t || ' all own', t
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

alter table public.foods enable row level security;
drop policy if exists "foods read" on public.foods;
create policy "foods read" on public.foods for select to authenticated using (true);
grant select on public.foods to authenticated;
grant all on public.foods to service_role;
