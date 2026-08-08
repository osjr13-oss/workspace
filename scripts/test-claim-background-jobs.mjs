/**
 * Behavior test for the claim_background_jobs() RPC.
 *
 * The background job tables were provisioned in production but never used by
 * any code, so the RPC has never actually run. This script exercises it against
 * real Postgres before the Worker is built on top of it.
 *
 * It runs against whatever database .env.local points at, which today is
 * production. That is safe only because these tables are unused: every row this
 * script creates is tagged with a TEST_TAG idempotency key prefix and deleted in
 * the finally block. It never touches rows it did not create.
 *
 * Usage: node scripts/test-claim-background-jobs.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const TEST_TAG = "test:claim-rpc:";

function loadEnv() {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

async function userId() {
  const { data, error } = await db.from("profiles").select("id").limit(1).single();
  if (error) throw error;
  return data.id;
}

async function seed(uid, jobs) {
  const rows = jobs.map((job, index) => ({
    user_id: uid,
    job_type: job.job_type ?? "analyze_file",
    status: job.status ?? "queued",
    priority: job.priority ?? 0,
    attempts: job.attempts ?? 0,
    max_attempts: job.max_attempts ?? 3,
    run_after: job.run_after ?? new Date().toISOString(),
    idempotency_key: `${TEST_TAG}${job.label ?? index}`,
    payload: { label: job.label ?? String(index) }
  }));
  const { error } = await db.from("background_jobs").insert(rows);
  if (error) throw error;
}

async function claim(worker, limit) {
  const { data, error } = await db.rpc("claim_background_jobs", { p_worker_id: worker, p_limit: limit });
  if (error) throw error;
  return data ?? [];
}

async function labelsOf(rows) {
  return rows.map((row) => row.payload?.label).sort();
}

async function cleanup() {
  // job_runs cascades from background_jobs; delete it first anyway for clarity.
  const { data: jobs } = await db.from("background_jobs").select("id").like("idempotency_key", `${TEST_TAG}%`);
  const ids = (jobs ?? []).map((job) => job.id);
  if (ids.length) {
    await db.from("job_runs").delete().in("job_id", ids);
    await db.from("background_jobs").delete().in("id", ids);
  }
  return ids.length;
}

async function main() {
  const uid = await userId();
  await cleanup();

  // ---- 1. basic claiming, locking, attempt counting -----------------------
  await seed(uid, [
    { label: "a", priority: 0 },
    { label: "b", priority: 0 },
    { label: "c", priority: 0 }
  ]);

  const first = await claim("worker-a", 2);
  check("claims up to the requested limit", first.length === 2, `got ${first.length}`);
  check(
    "sets status to processing",
    first.every((job) => job.status === "processing"),
    first.map((job) => job.status).join(",")
  );
  check(
    "records the claiming worker",
    first.every((job) => job.locked_by === "worker-a"),
    first.map((job) => job.locked_by).join(",")
  );
  check("stamps locked_at", first.every((job) => job.locked_at !== null));
  check("stamps started_at", first.every((job) => job.started_at !== null));
  check(
    "increments attempts to 1 on first claim",
    first.every((job) => job.attempts === 1),
    first.map((job) => job.attempts).join(",")
  );

  // ---- 2. a second worker never re-claims in-flight jobs ------------------
  const second = await claim("worker-b", 5);
  const overlap = second.filter((job) => first.some((prior) => prior.id === job.id));
  check("a second worker gets no overlapping jobs", overlap.length === 0, `overlap ${overlap.length}`);
  check("second worker gets the one remaining queued job", second.length === 1, `got ${second.length}`);

  const empty = await claim("worker-c", 5);
  check("claiming an exhausted queue returns nothing", empty.length === 0, `got ${empty.length}`);

  await cleanup();

  // ---- 3. ordering, scheduling, attempt ceiling ---------------------------
  await seed(uid, [
    { label: "low", priority: 1 },
    { label: "high", priority: 9 },
    { label: "future", priority: 9, run_after: new Date(Date.now() + 3600_000).toISOString() },
    { label: "exhausted", priority: 9, attempts: 3, max_attempts: 3 }
  ]);

  const ordered = await claim("worker-d", 10);
  const claimed = await labelsOf(ordered);
  check(
    "does not claim jobs scheduled in the future",
    !claimed.includes("future"),
    `claimed ${claimed.join(",")}`
  );
  check(
    "does not claim jobs that hit max_attempts",
    !claimed.includes("exhausted"),
    `claimed ${claimed.join(",")}`
  );
  check(
    "claims higher priority first",
    ordered[0]?.payload?.label === "high",
    `first was ${ordered[0]?.payload?.label}`
  );

  await cleanup();

  // ---- 4. retry counting across repeated claims --------------------------
  await seed(uid, [{ label: "retry", max_attempts: 3 }]);

  const attemptNumbers = [];
  for (let i = 0; i < 4; i += 1) {
    const rows = await claim("worker-e", 1);
    if (!rows.length) break;
    attemptNumbers.push(rows[0].attempts);
    // simulate a failed run releasing the job back to the queue
    await db.from("background_jobs").update({ status: "queued", locked_at: null, locked_by: null }).eq("id", rows[0].id);
  }
  check(
    "attempts increment on each re-claim",
    JSON.stringify(attemptNumbers) === JSON.stringify([1, 2, 3]),
    `saw [${attemptNumbers.join(",")}]`
  );
  check(
    "stops handing out the job once max_attempts is reached",
    attemptNumbers.length === 3,
    `claimed ${attemptNumbers.length} times`
  );

  await cleanup();

  // ---- 5. release on failure / stale lock recovery ------------------------
  await seed(uid, [{ label: "stale" }]);
  const [inFlight] = await claim("worker-f", 1);

  // Simulate a worker that died mid-run: status stays 'processing', lock is old.
  await db
    .from("background_jobs")
    .update({ locked_at: new Date(Date.now() - 3600_000).toISOString() })
    .eq("id", inFlight.id);

  const stillStuck = await claim("worker-g", 5);
  check(
    "a stranded job is not re-claimable until the reaper runs",
    !stillStuck.some((job) => job.id === inFlight.id),
    "claim alone cannot recover an abandoned job, which is why the reaper exists"
  );

  const { data: releasedCount, error: reapError } = await db.rpc("release_stale_background_jobs", {
    p_stale_after_seconds: 900
  });
  if (reapError) throw reapError;
  check("reaper reports the jobs it released", releasedCount === 1, `released ${releasedCount}`);

  const afterReap = await claim("worker-h", 5);
  const recovered = afterReap.find((job) => job.id === inFlight.id);
  check(
    "a job abandoned by a dead worker is re-claimable after the reaper runs",
    Boolean(recovered),
    recovered ? "" : "still stranded"
  );
  check(
    "the recovered job keeps counting attempts",
    recovered?.attempts === 2,
    `attempts ${recovered?.attempts}`
  );

  // A job that has already burned every attempt must terminate as failed rather
  // than cycling back into the queue forever.
  await db
    .from("background_jobs")
    .update({ attempts: 3, max_attempts: 3, locked_at: new Date(Date.now() - 3600_000).toISOString() })
    .eq("id", inFlight.id);
  await db.rpc("release_stale_background_jobs", { p_stale_after_seconds: 900 });

  const { data: exhausted } = await db
    .from("background_jobs")
    .select("status, last_error, completed_at")
    .eq("id", inFlight.id)
    .single();
  check(
    "a job out of attempts is failed, not requeued",
    exhausted?.status === "failed",
    `status ${exhausted?.status}`
  );
  check("a failed job records why it failed", Boolean(exhausted?.last_error), exhausted?.last_error ?? "");
  check("a failed job is stamped completed_at", Boolean(exhausted?.completed_at));

  // Fresh locks must be left alone, or the reaper would steal live work.
  await seed(uid, [{ label: "fresh" }]);
  const [live] = await claim("worker-i", 1);
  await db.rpc("release_stale_background_jobs", { p_stale_after_seconds: 900 });
  const { data: untouched } = await db
    .from("background_jobs")
    .select("status, locked_by")
    .eq("id", live.id)
    .single();
  check(
    "the reaper leaves a freshly claimed job alone",
    untouched?.status === "processing" && untouched?.locked_by === "worker-i",
    `status ${untouched?.status}, locked_by ${untouched?.locked_by}`
  );

  const stranded = await cleanup();

  console.log(`\ncleaned up ${stranded} test rows`);
  const failed = results.filter((result) => !result.passed);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("\nfailing checks:");
    for (const result of failed) console.log(`  - ${result.name}: ${result.detail}`);
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch(async (error) => {
  console.error("test run failed:", error.message);
  await cleanup();
  process.exit(1);
});
