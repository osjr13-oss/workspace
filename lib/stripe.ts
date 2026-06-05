import Stripe from "stripe";
import { requireEnv } from "@/lib/env";

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
