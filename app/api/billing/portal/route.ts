import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/brand";
import { serializeError } from "@/lib/serialize-error";
import { getStripe } from "@/lib/stripe";
import { getUserLimits } from "@/lib/tier";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limits = await getUserLimits(supabase, user.id);
    if (!limits.stripe_customer_id) {
      return NextResponse.json({ error: "No billing account found" }, { status: 400 });
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: limits.stripe_customer_id,
      return_url: absoluteUrl("/settings")
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = serializeError(error);
    console.error("[billing/portal]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
