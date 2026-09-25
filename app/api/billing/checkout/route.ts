import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/brand";
import { PLANS } from "@/lib/plans";
import { serializeError } from "@/lib/serialize-error";
import { assertFoundingProPrice, getProPriceId, getStripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { getUserLimits, isProActive } from "@/lib/tier";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!user.email) return NextResponse.json({ error: "Email is required for checkout." }, { status: 400 });

    const limits = await getUserLimits(supabase, user.id);
    if (isProActive(limits)) {
      return NextResponse.json({ error: "Pro is already active." }, { status: 409 });
    }

    const stripe = getStripe();
    await assertFoundingProPrice();

    let customerId = limits.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id }
      });
      customerId = customer.id;
      const admin = createSupabaseAdminClient();
      const { error } = await admin.from("user_limits").upsert(
        {
          user_id: user.id,
          tier: "free",
          daily_requests: PLANS.free.aiRequests,
          stripe_customer_id: customerId
        },
        { onConflict: "user_id" }
      );
      if (error) throw error;
    }

    const session = await stripe.checkout.sessions.create(
      {
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: getProPriceId(), quantity: 1 }],
        success_url: absoluteUrl("/chats?billing=success"),
        cancel_url: absoluteUrl("/chats?billing=canceled"),
        client_reference_id: user.id,
        metadata: {
          user_id: user.id,
          price_kind: PLANS.pro.priceKind,
          founding_price_cents: String(PLANS.pro.stripePriceAmountCents)
        },
        subscription_data: {
          metadata: { user_id: user.id, price_kind: PLANS.pro.priceKind }
        },
        allow_promotion_codes: true
      },
      { idempotencyKey: `checkout-${user.id}-${Math.floor(Date.now() / 30000)}` }
    );

    if (!session.url) return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = serializeError(error);
    console.error("[billing/checkout]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
