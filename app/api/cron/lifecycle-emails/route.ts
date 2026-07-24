import { NextResponse } from "next/server";
import { runLifecycleEmailBatch } from "@/lib/lifecycle-emails";
import { runWelcomeEmailRecoveryBatch } from "@/lib/email/welcome";
import { serializeError } from "@/lib/serialize-error";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorizeCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [welcome, lifecycle] = await Promise.all([
      runWelcomeEmailRecoveryBatch(),
      runLifecycleEmailBatch()
    ]);
    console.info("[cron/lifecycle-emails] completed", { welcome, lifecycle });
    return NextResponse.json({ success: true, welcome, lifecycle });
  } catch (error) {
    const msg = serializeError(error);
    console.error("[cron/lifecycle-emails]", msg, error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
