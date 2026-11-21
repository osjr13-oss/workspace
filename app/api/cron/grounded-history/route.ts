import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { expireGroundedHistory } from "@/lib/grounded-history";

export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const admin = createSupabaseAdminClient();
    await expireGroundedHistory(admin);
    // Temporary chats are removed a day after they were last used.
    const { error } = await admin
      .from("chat_threads")
      .delete()
      .eq("temporary", true)
      .lt("updated_at", new Date(Date.now() - 86_400_000).toISOString());
    if (error) console.error("[grounded-history] temporary chat cleanup failed", error.message);
    return NextResponse.json({ success: true });
  } catch {
    console.error("[grounded-history] cleanup failed");
    return NextResponse.json({ error: "History cleanup failed" }, { status: 500 });
  }
}
