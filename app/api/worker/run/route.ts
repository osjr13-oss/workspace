import { NextResponse } from "next/server";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { runWorkerForUser } from "@/lib/worker/run";

export const runtime = "nodejs";
// A run does a judgment call plus up to three generate-and-check pairs.
export const maxDuration = 300;

/**
 * Run the worker once, on demand.
 *
 * Phase 1 has no scheduler; this is how runs happen. It always runs for the
 * caller's own account, never for a user id supplied by the client.
 */
export async function POST() {
  try {
    const { user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const summary = await runWorkerForUser(user.id, { force: true });
    return NextResponse.json(summary);
  } catch (error) {
    const message = serializeError(error);
    console.error("[worker/run]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
