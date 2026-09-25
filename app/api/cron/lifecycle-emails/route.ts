import { NextResponse } from "next/server";
import { runWelcomeEmailRecoveryBatch } from "@/lib/email/templates";
import { runLifecycleEmailBatch } from "@/lib/lifecycle-emails";
import { serializeError } from "@/lib/serialize-error";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorizeCron(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [welcome, lifecycle] = await Promise.all([runWelcomeEmailRecoveryBatch(), runLifecycleEmailBatch()]);
    return NextResponse.json({ success: true, welcome, lifecycle });
  } catch (error) {
    const message = serializeError(error);
    console.error("[cron/lifecycle-emails]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
