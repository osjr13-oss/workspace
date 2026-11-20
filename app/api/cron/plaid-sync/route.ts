import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { syncEveryone } from "@/lib/plaid";
import { upgradeStoredSecrets } from "@/lib/secret-upgrade";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Daily: refresh every connected bank so balances and transactions stay current without opening the app. */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    // Once TOKEN_ENCRYPTION_KEY exists, this re-locks any older stored logins. Otherwise it does nothing.
    const secrets = await upgradeStoredSecrets(createSupabaseAdminClient()).catch(() => ({ upgraded: 0, skipped: 0, failed: 1 }));
    if (secrets.upgraded || secrets.failed) console.info("[cron/plaid-sync] stored logins", secrets);
    const result = await syncEveryone();
    console.info("[cron/plaid-sync] completed", result);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[cron/plaid-sync] failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Bank sync failed" }, { status: 500 });
  }
}
