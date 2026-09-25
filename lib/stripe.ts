import Stripe from "stripe";
import { requireEnv } from "@/lib/env";
import { PLANS } from "@/lib/plans";

let stripeClient: Stripe | null = null;

export function getStripe() {
  if (!stripeClient) stripeClient = new Stripe(requireEnv("STRIPE_SECRET_KEY"));
  return stripeClient;
}

export function getProPriceId() {
  return requireEnv("STRIPE_PRO_PRICE_ID");
}

export async function assertFoundingProPrice() {
  const stripe = getStripe();
  const priceId = getProPriceId();
  const price = await stripe.prices.retrieve(priceId);
  const expectedCents = PLANS.pro.stripePriceAmountCents;
  const actualCents = price.unit_amount;
  const interval = price.recurring?.interval;
  if (actualCents !== expectedCents || interval !== "month") {
    throw new Error(
      `STRIPE_PRO_PRICE_ID must be a monthly price of ${expectedCents} cents. Got unit_amount=${actualCents ?? "null"}, interval=${interval ?? "none"}.`
    );
  }
  return price;
}
