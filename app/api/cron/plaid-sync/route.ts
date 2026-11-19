import { NextResponse } from "next/server";
import { syncEveryone } from "@/lib/plaid";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Daily: refresh every connected bank so balances and transactions stay current without opening the app. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await syncEveryone();
    console.info("[cron/plaid-sync] completed", result);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[cron/plaid-sync] failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Bank sync failed" }, { status: 500 });
  }
}
