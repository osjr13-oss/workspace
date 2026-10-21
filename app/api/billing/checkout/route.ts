import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/brand";
import { serializeError } from "@/lib/serialize-error";
import { PLANS } from "@/lib/plans";
import { assertFoundingProPrice, getProPriceId, getStripe } from "@/lib/stripe";
import { getUserLimits, isProActive } from "@/lib/tier";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!user.email) return NextResponse.json({ error: "Email required for checkout" }, { status: 400 });

    const limits = await getUserLimits(supabase, user.id);
    if (isProActive(limits)) {
      return NextResponse.json({ error: "Your Pro subscription is already active." }, { status: 409 });
    }
    const stripe = getStripe();
    // Refuse checkout if STRIPE_PRO_PRICE_ID still points at the old $19 price.
    await assertFoundingProPrice();

    let customerId = limits.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id }
      });
      customerId = customer.id;
      const admin = createSupabaseAdminClient();
      const { error: customerSaveError } = await admin.from("user_limits").upsert(
        {
          user_id: user.id,
          tier: "free",
          daily_requests: PLANS.free.aiRequests,
          stripe_customer_id: customerId
        },
        { onConflict: "user_id" }
      );
      if (customerSaveError) throw customerSaveError;
    }

    // Idempotency key buckets rapid duplicate requests (double-click, two open
    // tabs) for the same user within a short window into a single Stripe
    // Checkout Session, closing the gap before the isProActive() check above
    // reflects a session that's already in flight.
    const idempotencyKey = `checkout-${user.id}-${Math.floor(Date.now() / 30000)}`;

    const session = await stripe.checkout.sessions.create(
      {
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: getProPriceId(), quantity: 1 }],
        success_url: absoluteUrl("/settings?billing=success&session_id={CHECKOUT_SESSION_ID}"),
        cancel_url: absoluteUrl("/settings?canceled=1"),
        client_reference_id: user.id,
        metadata: {
          user_id: user.id,
          price_kind: PLANS.pro.priceKind,
          founding_price_cents: String(PLANS.pro.stripePriceAmountCents)
        },
        subscription_data: {
          metadata: {
            user_id: user.id,
            price_kind: PLANS.pro.priceKind
          }
        },
        allow_promotion_codes: true
      },
      { idempotencyKey }
    );

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
