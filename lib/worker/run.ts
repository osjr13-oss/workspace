import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { executeAction } from "@/lib/worker/actions";
import {
  MAX_ACTIONS_PER_RUN,
  WORKER_DAILY_TOKEN_BUDGET,
  WORKER_RUN_TIMEOUT_MS,
  workerEnabled
} from "@/lib/worker/config";
import { gatherContext } from "@/lib/worker/context";
import { planActions } from "@/lib/worker/judgment";

/**
 * One worker run, end to end.
 *
 * A run is a background_jobs row claimed through claim_background_jobs, so a
 * manual run and a future scheduled run take the same path and cannot both act
 * at once. Doing nothing is a normal outcome and is still recorded, which is
 * what lets the feed say "nothing new needed today" with a date.
 */

export type RunSummary = {
  jobId: string | null;
  status: "succeeded" | "skipped" | "failed";
  actionsPlanned: number;
  itemsCreated: number;
  discarded: number;
  noActionReason: string | null;
  tokensUsed: number;
  message: string;
};

function workerId() {
  return `manual-${process.env.VERCEL_REGION || "local"}-${Date.now().toString(36)}`;
}

/** Tokens this user has already spent on worker runs today. */
async function tokensUsedToday(admin: SupabaseClient, userId: string) {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);

  const { data } = await admin
    .from("ai_request_logs")
    .select("input_tokens, output_tokens")
    .eq("user_id", userId)
    .eq("route", "worker")
    .gte("created_at", since.toISOString());

  return ((data || []) as Array<{ input_tokens: number; output_tokens: number }>).reduce(
    (total, row) => total + (row.input_tokens || 0) + (row.output_tokens || 0),
    0
  );
}

/** Record what a run spent, so the budget and any debugging have real numbers. */
async function logUsage(
  admin: SupabaseClient,
  userId: string,
  jobId: string | null,
  usage: { inputTokens: number; outputTokens: number },
  metadata: Record<string, unknown>
) {
  const { error } = await admin.from("ai_request_logs").insert({
    user_id: userId,
    job_id: jobId,
    route: "worker",
    provider: process.env.ANTHROPIC_API_KEY?.trim() ? "anthropic" : "groq",
    model: process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-6",
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    success: true,
    metadata
  });
  if (error) console.error("[worker] could not log usage", error.message);
}

async function finishJob(
  admin: SupabaseClient,
  jobId: string,
  status: "succeeded" | "failed",
  result: Record<string, unknown>,
  lastError?: string
) {
  await admin
    .from("background_jobs")
    .update({
      status,
      completed_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      result,
      last_error: lastError ?? null
    })
    .eq("id", jobId);
}

/**
 * Queue and immediately execute one run for a user.
 *
 * The idempotency key is per user per calendar day, so a second manual run on
 * the same day reuses the same job row rather than piling up duplicates. That is
 * also what the scheduler will rely on later.
 */
export async function runWorkerForUser(userId: string, options?: { force?: boolean }): Promise<RunSummary> {
  const empty: RunSummary = {
    jobId: null,
    status: "skipped",
    actionsPlanned: 0,
    itemsCreated: 0,
    discarded: 0,
    noActionReason: null,
    tokensUsed: 0,
    message: ""
  };

  if (!workerEnabled()) {
    return { ...empty, message: "The worker is currently disabled." };
  }

  const admin = createSupabaseAdminClient();

  const spent = await tokensUsedToday(admin, userId);
  if (spent >= WORKER_DAILY_TOKEN_BUDGET) {
    return {
      ...empty,
      tokensUsed: spent,
      message: "Daily token budget for background work is used up. Try again tomorrow."
    };
  }

  const day = new Date().toISOString().slice(0, 10);
  const idempotencyKey = options?.force ? `worker:${userId}:${day}:${Date.now()}` : `worker:${userId}:${day}`;

  // Queue the run. A conflict means today's run already exists; reuse it.
  const { data: inserted, error: insertError } = await admin
    .from("background_jobs")
    .insert({
      user_id: userId,
      job_type: "worker_run",
      status: "queued",
      priority: 5,
      idempotency_key: idempotencyKey,
      payload: { trigger: "manual", day }
    })
    .select("id")
    .maybeSingle();

  if (insertError && insertError.code !== "23505") {
    console.error("[worker] could not queue run", insertError);
    return { ...empty, status: "failed", message: "Could not queue the run." };
  }

  let jobId = inserted?.id as string | undefined;
  if (!jobId) {
    const { data: existing } = await admin
      .from("background_jobs")
      .select("id, status")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (!existing) return { ...empty, status: "failed", message: "Could not queue the run." };
    if (existing.status === "processing") {
      return { ...empty, message: "A run is already in progress." };
    }
    jobId = existing.id as string;
    // Put a previously finished job back in the queue so it can be claimed again.
    await admin
      .from("background_jobs")
      .update({ status: "queued", locked_at: null, locked_by: null, completed_at: null })
      .eq("id", jobId);
  }

  // Claim through the RPC so manual and scheduled runs share one locking path.
  const { data: claimed, error: claimError } = await admin.rpc("claim_background_jobs", {
    p_worker_id: workerId(),
    p_limit: 5
  });

  if (claimError) {
    console.error("[worker] claim failed", claimError);
    return { ...empty, jobId, status: "failed", message: "Could not claim the run." };
  }

  const claimedRows = (claimed || []) as Array<{ id: string; user_id: string; attempts: number }>;
  const ours = claimedRows.find((row) => row.id === jobId);
  if (!ours) {
    return { ...empty, jobId, message: "Another worker is already handling this run." };
  }

  const attempt = ours.attempts;
  const startedAt = Date.now();
  const { data: runRow } = await admin
    .from("job_runs")
    .insert({ job_id: jobId, user_id: userId, attempt, status: "processing", worker_id: workerId() })
    .select("id")
    .maybeSingle();

  const totalUsage = { inputTokens: 0, outputTokens: 0 };
  let itemsCreated = 0;
  let discarded = 0;

  try {
    const context = await gatherContext(admin, userId);
    const plan = await planActions(context);
    totalUsage.inputTokens += plan.usage.inputTokens;
    totalUsage.outputTokens += plan.usage.outputTokens;

    const bySource = new Map(context.sources.map((source) => [source.id, source]));

    for (const action of plan.actions.slice(0, MAX_ACTIONS_PER_RUN)) {
      if (Date.now() - startedAt > WORKER_RUN_TIMEOUT_MS) {
        console.error("[worker] run exceeded its time budget, stopping early", { jobId });
        break;
      }

      const spentNow = spent + totalUsage.inputTokens + totalUsage.outputTokens;
      if (spentNow >= WORKER_DAILY_TOKEN_BUDGET) {
        console.error("[worker] token budget exhausted mid-run", { jobId, spentNow });
        break;
      }

      const source = bySource.get(action.sourceId);
      if (!source) continue;

      const outcome = await executeAction(admin, userId, action, source);
      const outcomeUsage = outcome.ok ? outcome.item.usage : outcome.usage;
      totalUsage.inputTokens += outcomeUsage.inputTokens;
      totalUsage.outputTokens += outcomeUsage.outputTokens;

      if (!outcome.ok) {
        discarded += 1;
        continue;
      }

      const { error: feedError } = await admin.from("feed_items").insert({
        user_id: userId,
        job_id: jobId,
        action_type: action.type,
        title: outcome.item.title,
        reason: action.reason,
        payload: outcome.item.payload,
        source_type: source.kind,
        source_id: source.id,
        source_fingerprint: source.fingerprint
      });

      if (feedError) {
        console.error("[worker] could not write feed item", feedError.message);
        discarded += 1;
        continue;
      }

      itemsCreated += 1;
    }

    const result = {
      actions_planned: plan.actions.length,
      items_created: itemsCreated,
      discarded,
      no_action_reason: plan.noActionReason,
      judgment_attempts: plan.attempts,
      input_tokens: totalUsage.inputTokens,
      output_tokens: totalUsage.outputTokens
    };

    await finishJob(admin, jobId, "succeeded", result);
    if (runRow?.id) {
      await admin
        .from("job_runs")
        .update({
          status: "succeeded",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startedAt,
          result
        })
        .eq("id", runRow.id);
    }
    await logUsage(admin, userId, jobId, totalUsage, result);

    return {
      jobId,
      status: "succeeded",
      actionsPlanned: plan.actions.length,
      itemsCreated,
      discarded,
      noActionReason: plan.noActionReason,
      tokensUsed: totalUsage.inputTokens + totalUsage.outputTokens,
      message: itemsCreated
        ? `Added ${itemsCreated} item${itemsCreated === 1 ? "" : "s"} to your feed.`
        : plan.noActionReason || "Nothing new needed right now."
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[worker] run failed", { jobId, error: message });

    await finishJob(admin, jobId, "failed", { input_tokens: totalUsage.inputTokens, output_tokens: totalUsage.outputTokens }, message);
    if (runRow?.id) {
      await admin
        .from("job_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startedAt,
          error_message: message
        })
        .eq("id", runRow.id);
    }
    await logUsage(admin, userId, jobId, totalUsage, { failed: true });

    return {
      jobId,
      status: "failed",
      actionsPlanned: 0,
      itemsCreated,
      discarded,
      noActionReason: null,
      tokensUsed: totalUsage.inputTokens + totalUsage.outputTokens,
      message: "The run did not finish. Nothing was added to your feed."
    };
  }
}
