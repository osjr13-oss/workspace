-- The Feed: what the Worker produced, waiting for the user to review.
--
-- A run is a row in background_jobs (job_type 'worker_run'); its output is zero
-- or more feed_items pointing back at it. Runs that produced nothing still exist
-- as jobs, which is how the feed can honestly say "nothing new needed today"
-- with a date instead of showing an empty page.
--
-- Nothing here is filed into the workspace until the user approves it. Approving
-- creates the real deck or note and records what it became in filed_type/filed_id.

create table if not exists public.feed_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.background_jobs(id) on delete set null,
  action_type text not null,
  title text not null,
  -- The one-sentence reason the user reads. The Judgment layer must produce one
  -- for every action; an action without a stateable reason is dropped.
  reason text not null,
  -- The generated content itself, not yet filed: {cards:[...]} or {body:"..."}.
  payload jsonb not null default '{}'::jsonb,
  source_type text,
  source_id uuid,
  -- Snapshot of the source's last-modified marker at generation time. The
  -- Worker refuses to act twice on the same source unless this changes.
  source_fingerprint text,
  status text not null default 'pending',
  filed_type text,
  filed_id uuid,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

do $$ begin
  alter table public.feed_items add constraint feed_items_action_type_check
    check (action_type = any (array['generate_flashcards','write_study_brief']));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.feed_items add constraint feed_items_status_check
    check (status = any (array['pending','approved','dismissed']));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.feed_items add constraint feed_items_source_type_check
    check (source_type is null or source_type = any (array['note','file','project']));
exception when duplicate_object then null; end $$;

create index if not exists feed_items_user_created_idx
  on public.feed_items (user_id, created_at desc);

create index if not exists feed_items_user_status_idx
  on public.feed_items (user_id, status, created_at desc);

create index if not exists feed_items_job_idx
  on public.feed_items (job_id);

-- Backs the "have we already acted on this exact version of this source" check.
create index if not exists feed_items_source_idx
  on public.feed_items (user_id, source_type, source_id, source_fingerprint);

alter table public.feed_items enable row level security;

-- The user reads and decides on their own items. Creation is the Worker's job
-- and happens through the service role, so there is no insert policy.
drop policy if exists "feed_items select own" on public.feed_items;
create policy "feed_items select own" on public.feed_items
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "feed_items update own" on public.feed_items;
create policy "feed_items update own" on public.feed_items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, update on public.feed_items to authenticated;

-- The Worker needs its own job type. Extend the allowed list rather than
-- dropping the constraint.
do $$ begin
  alter table public.background_jobs drop constraint if exists background_jobs_job_type_check;
  alter table public.background_jobs add constraint background_jobs_job_type_check
    check (job_type = any (array[
      'process_file','analyze_file','refresh_project_summary','generate_flashcards','worker_run'
    ]));
end $$;

-- ai_request_logs recorded characters but not tokens, and the per-user daily
-- token budget needs tokens. Providers report them now, so store them.
alter table public.ai_request_logs add column if not exists input_tokens integer not null default 0;
alter table public.ai_request_logs add column if not exists output_tokens integer not null default 0;
