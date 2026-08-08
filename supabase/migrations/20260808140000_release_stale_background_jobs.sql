-- Fix: background jobs had no stale-lock recovery.
--
-- claim_background_jobs() sets status='processing' and stamps locked_at, but
-- nothing ever reverses that. A worker that is killed mid-run (deploy, function
-- timeout, crash) leaves its job stranded in 'processing' forever: it is no
-- longer 'queued', so no future claim will ever pick it up again. Verified
-- against production with scripts/test-claim-background-jobs.mjs, which
-- reproduces the stranding.
--
-- The rebuild spec requires a per-run timeout where a hung run releases its
-- claim, so this is a prerequisite rather than a nice-to-have.
--
-- Recovery rule: a job whose lock is older than the staleness window goes back
-- to 'queued' if it has attempts remaining, or to 'failed' if it has already
-- burned max_attempts. attempts is incremented at claim time, so a job that
-- repeatedly hangs still terminates instead of looping forever.

create or replace function public.release_stale_background_jobs(p_stale_after_seconds integer default 900)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_released integer;
  v_cutoff timestamptz := now() - make_interval(secs => greatest(coalesce(p_stale_after_seconds, 900), 30));
begin
  with stale as (
    select id
    from public.background_jobs
    where status = 'processing'
      and locked_at is not null
      and locked_at < v_cutoff
    for update skip locked
  )
  update public.background_jobs as job
  set
    status = case when job.attempts >= job.max_attempts then 'failed' else 'queued' end,
    locked_at = null,
    locked_by = null,
    completed_at = case when job.attempts >= job.max_attempts then now() else null end,
    last_error = 'run did not finish; claim released after timeout',
    updated_at = now()
  from stale
  where job.id = stale.id;

  get diagnostics v_released = row_count;

  -- Close out the corresponding run rows so job_runs does not accumulate
  -- entries stuck in 'processing'.
  update public.job_runs as run
  set
    status = 'failed',
    finished_at = now(),
    duration_ms = coalesce(run.duration_ms, (extract(epoch from (now() - run.started_at)) * 1000)::integer),
    error_message = coalesce(run.error_message, 'run did not finish; claim released after timeout')
  where run.status = 'processing'
    and run.started_at < v_cutoff;

  return v_released;
end;
$$;

revoke all on function public.release_stale_background_jobs(integer) from public, anon, authenticated;
grant execute on function public.release_stale_background_jobs(integer) to service_role;
