import { NextResponse } from "next/server";
import { formatPlanPrice, PLANS } from "@/lib/plans";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { getUserLimits, isProActive } from "@/lib/tier";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const limits = await getUserLimits(supabase, user.id);
    return NextResponse.json({
      tier: limits.tier,
      status: limits.subscription_status,
      pro: isProActive(limits),
      priceLabel: `${formatPlanPrice(PLANS.pro.priceMonthly)}/month`,
      canManage: Boolean(limits.stripe_customer_id)
    });
  } catch (error) {
    return NextResponse.json({ error: serializeError(error) }, { status: 500 });
  }
}
