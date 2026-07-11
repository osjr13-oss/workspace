import { NextResponse } from "next/server";
import { serializeError } from "@/lib/serialize-error";
import { getOrCreateReferralCode, getReferralStats } from "@/lib/referrals";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/brand";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [referralCode, stats] = await Promise.all([
      getOrCreateReferralCode(user.id),
      getReferralStats(supabase, user.id)
    ]);

    return NextResponse.json({
      referralCode,
      referralLink: absoluteUrl(`/signup?ref=${referralCode}`),
      ...stats
    });
  } catch (error) {
    const message = serializeError(error);
    console.error("[referrals]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
