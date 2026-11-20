import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { runLifecycleEmailBatch } from "@/lib/lifecycle-emails";
import { serializeError } from "@/lib/serialize-error";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Sends only the opt-in weekly summary (lib/lifecycle-emails.ts).
    const weekly = await runLifecycleEmailBatch();
    console.info("[cron/lifecycle-emails] completed", { weekly });
    return NextResponse.json({ success: true, weekly });
  } catch (error) {
    const msg = serializeError(error);
    console.error("[cron/lifecycle-emails]", msg, error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
