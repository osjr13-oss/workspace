/**
 * Cost and safety guardrails for the background Worker.
 *
 * All of these are config, not constants scattered through the code, because
 * they are the levers you reach for when the Worker misbehaves in production.
 */

function intFromEnv(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Global kill switch. Set WORKER_ENABLED=false to stop every run, including
 * manual ones, without a deploy.
 */
export function workerEnabled() {
  return process.env.WORKER_ENABLED?.trim().toLowerCase() !== "false";
}

/**
 * Whether the scheduled (cron) worker may run.
 *
 * Defaults to OFF, unlike workerEnabled(). The scheduler is fully built but
 * must not start acting on its own until the owner explicitly turns it on by
 * setting WORKER_CRON_ENABLED=true. Manual Run Now is unaffected, so the two
 * can be exercised independently.
 *
 * The cron entry in vercel.json still fires on schedule; this flag is what makes
 * the run a no-op, so turning it on is an environment variable change rather
 * than a deploy.
 */
export function workerCronEnabled() {
  return process.env.WORKER_CRON_ENABLED?.trim().toLowerCase() === "true";
}

/** How many users one scheduled invocation will process before stopping. */
export const CRON_USER_BATCH_SIZE = intFromEnv("WORKER_CRON_BATCH_SIZE", 25);

/**
 * Hard stop on tokens per user per day. Deliberately conservative: a run that
 * plans three actions spends roughly one judgment call plus one generation and
 * one self check per action.
 */
export const WORKER_DAILY_TOKEN_BUDGET = intFromEnv("WORKER_DAILY_TOKEN_BUDGET", 120_000);

/** A run that exceeds this is abandoned and its claim released. */
export const WORKER_RUN_TIMEOUT_MS = intFromEnv("WORKER_RUN_TIMEOUT_SECONDS", 240) * 1000;

/** Section 4.3: never more than three actions from a single run. */
export const MAX_ACTIONS_PER_RUN = 3;

/** How much of a source document the judgment and generation calls may read. */
export const MAX_SOURCE_CHARS = 12_000;

/** Sources changed within this window count as "recent" context for a run. */
export const RECENT_WINDOW_DAYS = intFromEnv("WORKER_RECENT_WINDOW_DAYS", 14);
