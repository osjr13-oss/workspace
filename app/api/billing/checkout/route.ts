import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/brand";
import { serializeError } from "@/lib/serialize-error";
import { getProPriceId, getStripe } from "@/lib/stripe";
import { getUserLimits } from "@/lib/tier";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!user.email) return NextResponse.json({ error: "Email required for checkout" }, { status: 400 });

    const limits = await getUserLimits(supabase, user.id);
    const stripe = getStripe();

    let customerId = limits.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id }
      });
      customerId = customer.id;
      const admin = createSupabaseAdminClient();
      await admin.from("user_limits").upsert(
        { user_id: user.id, tier: "free", daily_requests: 20, stripe_customer_id: customerId },
        { onConflict: "user_id" }
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: getProPriceId(), quantity: 1 }],
      success_url: absoluteUrl("/settings?billing=success"),
      cancel_url: absoluteUrl("/pricing?canceled=1"),
      client_reference_id: user.id,
      metadata: { user_id: user.id },
      subscription_data: {
        metadata: { user_id: user.id }
      },
      allow_promotion_codes: true
    });

    if (!session.url) {
      return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = serializeError(error);
    console.error("[billing/checkout]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
