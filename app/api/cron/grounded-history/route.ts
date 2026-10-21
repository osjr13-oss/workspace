import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { expireGroundedHistory } from "@/lib/grounded-history";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await expireGroundedHistory(createSupabaseAdminClient());
    return NextResponse.json({ success: true });
  } catch {
    console.error("[grounded-history] cleanup failed");
    return NextResponse.json({ error: "History cleanup failed" }, { status: 500 });
  }
}
