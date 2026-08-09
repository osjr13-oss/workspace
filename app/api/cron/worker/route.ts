import { NextResponse } from "next/server";
import { serializeError } from "@/lib/serialize-error";
import { runScheduledWorkerBatch } from "@/lib/worker/schedule";
import { sendDailyDigestBatch } from "@/lib/email/daily-digest";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorizeCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Daily scheduled worker, followed by the morning digest.
 *
 * Both halves are individually gated and both default to OFF
 * (WORKER_CRON_ENABLED, DAILY_DIGEST_ENABLED). This endpoint is safe to have
 * live on a schedule before either is turned on: it authorizes, reports that it
 * is disabled, and does nothing else.
 *
 * The digest runs after the worker batch in the same invocation so it can see
 * the items that batch just produced.
 */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const worker = await runScheduledWorkerBatch();
    const digest = await sendDailyDigestBatch();
    console.info("[cron/worker] completed", { worker, digest });
    return NextResponse.json({ success: true, worker, digest });
  } catch (error) {
    const message = serializeError(error);
    console.error("[cron/worker]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
