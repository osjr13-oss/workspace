import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CRON_USER_BATCH_SIZE, workerCronEnabled, workerEnabled } from "@/lib/worker/config";
import { runWorkerForUser, type RunSummary } from "@/lib/worker/run";

/**
 * The scheduled worker: one run per user per day.
 *
 * Idempotency comes from background_jobs.idempotency_key being
 * `worker:{userId}:{YYYY-MM-DD}`, which carries a UNIQUE constraint. A second
 * invocation on the same day cannot create a second run for the same user, so
 * the cron firing twice (retry, overlapping deploy, manual replay) is harmless.
 * Manual Run Now deliberately forces a distinct key so testing by hand never
 * consumes the day's scheduled slot.
 *
 * Scheduling is a single daily UTC cron rather than per-user local time. Doing
 * 4am-local properly needs an hourly cron and a timezone column on profiles;
 * that was cut from scope. Each user is still claimed individually inside the
 * job, so moving to per-user local time later is a queue change here rather
 * than a rewrite of the run itself.
 */

export type ScheduledBatchSummary = {
  ran: boolean;
  reason: string;
  usersConsidered: number;
  runsExecuted: number;
  itemsCreated: number;
  noActionRuns: number;
  failures: number;
};

/** Users who do not already have a completed run recorded for today. */
async function usersNeedingRun(day: string, limit: number) {
  const admin = createSupabaseAdminClient();
  const candidates: string[] = [];
  let page = 1;

  while (candidates.length < limit) {
    const { data: list, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    if (!list.users.length) break;

    // One query per page rather than per user: fetch today's existing run keys
    // for this batch and diff locally.
    const keys = list.users.map((user) => `worker:${user.id}:${day}`);
    const { data: existing } = await admin
      .from("background_jobs")
      .select("idempotency_key")
      .in("idempotency_key", keys);

    const alreadyRan = new Set(
      ((existing || []) as Array<{ idempotency_key: string }>).map((row) => row.idempotency_key)
    );

    for (const user of list.users) {
      if (candidates.length >= limit) break;
      if (!alreadyRan.has(`worker:${user.id}:${day}`)) candidates.push(user.id);
    }

    if (list.users.length < 100) break;
    page += 1;
  }

  return candidates;
}

/**
 * Execute the day's scheduled runs.
 *
 * Returns without doing anything when either switch is off, and says which one,
 * so an operator reading logs can tell "disabled" apart from "nothing to do".
 */
export async function runScheduledWorkerBatch(): Promise<ScheduledBatchSummary> {
  const idle: ScheduledBatchSummary = {
    ran: false,
    reason: "",
    usersConsidered: 0,
    runsExecuted: 0,
    itemsCreated: 0,
    noActionRuns: 0,
    failures: 0
  };

  if (!workerEnabled()) {
    return { ...idle, reason: "worker_disabled" };
  }
  if (!workerCronEnabled()) {
    return { ...idle, reason: "cron_disabled" };
  }

  const day = new Date().toISOString().slice(0, 10);
  const users = await usersNeedingRun(day, CRON_USER_BATCH_SIZE);

  let runsExecuted = 0;
  let itemsCreated = 0;
  let noActionRuns = 0;
  let failures = 0;

  for (const userId of users) {
    let summary: RunSummary;
    try {
      // force:false so the day-scoped idempotency key is used, which is what
      // makes a duplicate cron invocation a no-op instead of a second run.
      summary = await runWorkerForUser(userId, { force: false });
    } catch (error) {
      failures += 1;
      console.error("[worker/cron] run threw", {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      continue;
    }

    if (summary.status === "failed") {
      failures += 1;
      continue;
    }
    if (summary.status === "skipped") continue;

    runsExecuted += 1;
    itemsCreated += summary.itemsCreated;
    if (summary.itemsCreated === 0) noActionRuns += 1;
  }

  return {
    ran: true,
    reason: "ok",
    usersConsidered: users.length,
    runsExecuted,
    itemsCreated,
    noActionRuns,
    failures
  };
}
