import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/brand";
import { serializeError } from "@/lib/serialize-error";
import { getStripe } from "@/lib/stripe";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { getUserLimits } from "@/lib/tier";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const limits = await getUserLimits(supabase, user.id);
    if (!limits.stripe_customer_id) {
      return NextResponse.json({ error: "No billing account yet. Upgrade before managing billing." }, { status: 400 });
    }
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: limits.stripe_customer_id,
      return_url: absoluteUrl("/chats")
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json({ error: serializeError(error) }, { status: 500 });
  }
}
