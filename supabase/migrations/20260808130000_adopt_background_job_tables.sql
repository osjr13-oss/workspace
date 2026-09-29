-- Bring the background job infrastructure into tracked migration history.
--
-- These five tables and the claim_background_jobs() RPC already exist in
-- production but appear in no migration in this repo and are referenced by no
-- code. They were provisioned and never wired up. The Worker is going to be
-- built on them, so the repo needs to own them.
--
-- Every statement here is idempotent and was derived by introspecting the live
-- schema, so applying this against production is a no-op. It exists so a fresh
-- database (a branch, a local stack, a rebuild) reproduces production exactly.
--
-- This migration deliberately mirrors production as-is, including its flaws.
-- The missing stale-lock recovery is fixed in a separate follow-up migration so
-- that this file stays a faithful record of what was already there.

-- ---------------------------------------------------------------- tables ----

create table if not exists public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_type text not null,
  status text not null default 'queued',
  priority integer not null default 0,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  started_at timestamptz,
  completed_at timestamptz,
  last_error text,
  idempotency_key text unique,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Allowed job_type values are intentionally narrow. The Worker will need to
-- extend this list in Phase 1; do that with an explicit migration rather than
-- dropping the constraint.
do $$ begin
  alter table public.background_jobs add constraint background_jobs_job_type_check
    check (job_type = any (array['process_file','analyze_file','refresh_project_summary','generate_flashcards']));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.background_jobs add constraint background_jobs_status_check
    check (status = any (array['queued','processing','succeeded','failed','canceled']));
exception when duplicate_object then null; end $$;

create table if not exists public.job_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.background_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt integer not null,
  status text not null default 'processing',
  worker_id text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  error_message text,
  result jsonb not null default '{}'::jsonb
);

do $$ begin
  alter table public.job_runs add constraint job_runs_status_check
    check (status = any (array['processing','succeeded','failed']));
exception when duplicate_object then null; end $$;

create table if not exists public.ai_request_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  job_id uuid references public.background_jobs(id) on delete set null,
  route text not null,
  provider text not null default 'groq',
  model text,
  input_chars integer,
  output_chars integer,
  latency_ms integer,
  success boolean not null default true,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.automation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  event_type text not null,
  source text not null default 'app',
  subject_type text,
  subject_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.project_summaries (
  project_id uuid primary key references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  summary text not null default ''::text,
  key_concepts text[] not null default '{}'::text[],
  source_counts jsonb not null default '{}'::jsonb,
  refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --------------------------------------------------------------- indexes ----

-- Partial index matching the claim query's predicate.
create index if not exists background_jobs_claim_idx
  on public.background_jobs (status, run_after, priority desc, created_at)
  where status = 'queued';
create index if not exists background_jobs_type_status_idx
  on public.background_jobs (job_type, status, created_at desc);
create index if not exists background_jobs_user_created_idx
  on public.background_jobs (user_id, created_at desc);
create index if not exists job_runs_job_started_idx
  on public.job_runs (job_id, started_at desc);
create index if not exists ai_request_logs_job_idx
  on public.ai_request_logs (job_id, created_at desc);
create index if not exists ai_request_logs_user_created_idx
  on public.ai_request_logs (user_id, created_at desc);
create index if not exists automation_events_subject_idx
  on public.automation_events (subject_type, subject_id, created_at desc);
create index if not exists automation_events_user_created_idx
  on public.automation_events (user_id, created_at desc);
create index if not exists project_summaries_user_refreshed_idx
  on public.project_summaries (user_id, refreshed_at desc);

-- -------------------------------------------------------------- triggers ----

drop trigger if exists background_jobs_updated_at on public.background_jobs;
create trigger background_jobs_updated_at
  before update on public.background_jobs
  for each row execute function public.set_updated_at();

drop trigger if exists project_summaries_updated_at on public.project_summaries;
create trigger project_summaries_updated_at
  before update on public.project_summaries
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------ RLS -----

-- Users may read their own rows. All writes go through the service role, so no
-- insert/update/delete policies exist by design.
alter table public.background_jobs enable row level security;
alter table public.job_runs enable row level security;
alter table public.ai_request_logs enable row level security;
alter table public.automation_events enable row level security;
alter table public.project_summaries enable row level security;

drop policy if exists "background_jobs select own" on public.background_jobs;
create policy "background_jobs select own" on public.background_jobs
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "job_runs select own" on public.job_runs;
create policy "job_runs select own" on public.job_runs
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "ai_request_logs select own" on public.ai_request_logs;
create policy "ai_request_logs select own" on public.ai_request_logs
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "automation_events select own" on public.automation_events;
create policy "automation_events select own" on public.automation_events
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "project_summaries select own" on public.project_summaries;
create policy "project_summaries select own" on public.project_summaries
  for select to authenticated using ((select auth.uid()) = user_id);

grant select on public.background_jobs, public.job_runs, public.ai_request_logs,
  public.automation_events, public.project_summaries to authenticated;

-- ------------------------------------------------------------------ RPC -----

-- Claims queued jobs for one worker. FOR UPDATE SKIP LOCKED makes concurrent
-- workers safe: each claim takes a disjoint set. attempts increments at claim
-- time, so a worker that dies mid-run still burns an attempt.
create or replace function public.claim_background_jobs(p_worker_id text, p_limit integer default 5)
returns setof public.background_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select id
    from public.background_jobs
    where status = 'queued'
      and run_after <= now()
      and attempts < max_attempts
    order by priority desc, run_after asc, created_at asc
    for update skip locked
    limit least(greatest(coalesce(p_limit, 5), 1), 20)
  )
  update public.background_jobs as job
  set
    status = 'processing',
    locked_at = now(),
    locked_by = left(coalesce(p_worker_id, 'worker'), 120),
    attempts = job.attempts + 1,
    started_at = coalesce(job.started_at, now()),
    completed_at = null,
    updated_at = now()
  from candidates
  where job.id = candidates.id
  returning job.*;
end;
$$;

revoke all on function public.claim_background_jobs(text, integer) from public, anon, authenticated;
grant execute on function public.claim_background_jobs(text, integer) to service_role;
