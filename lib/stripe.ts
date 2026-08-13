import Stripe from "stripe";
import { requireEnv } from "@/lib/env";
import { PLANS } from "@/lib/plans";

let stripeClient: Stripe | null = null;

export function getStripe() {
  if (!stripeClient) {
    stripeClient = new Stripe(requireEnv("STRIPE_SECRET_KEY"));
  }
  return stripeClient;
}

export function getProPriceId() {
  return requireEnv("STRIPE_PRO_PRICE_ID");
}

/**
 * Confirm the configured Stripe Price matches the founding Pro amount ($6.99/mo).
 * Call before Checkout so a stale $19 price ID fails loudly in logs/UI.
 */
export async function assertFoundingProPrice() {
  const stripe = getStripe();
  const priceId = getProPriceId();
  const price = await stripe.prices.retrieve(priceId);

  const expectedCents = PLANS.pro.stripePriceAmountCents;
  const actualCents = price.unit_amount;
  const interval = price.recurring?.interval;

  if (actualCents !== expectedCents || interval !== "month") {
    throw new Error(
      `STRIPE_PRO_PRICE_ID must be a monthly price of ${expectedCents} cents (founding Pro). ` +
        `Got unit_amount=${actualCents ?? "null"}, interval=${interval ?? "none"} for ${priceId}. ` +
        `Create a new $6.99/mo price in Stripe and update the Vercel env var. See docs/BILLING.md.`
    );
  }

  return price;
}
