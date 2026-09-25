import type Stripe from "stripe";
import { PLANS } from "@/lib/plans";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function setUserPro(params: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: string;
  currentPeriodEnd: Date | null;
}) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("user_limits").upsert(
    {
      user_id: params.userId,
      tier: "pro",
      daily_requests: PLANS.pro.aiRequests,
      stripe_customer_id: params.stripeCustomerId,
      stripe_subscription_id: params.stripeSubscriptionId,
      subscription_status: params.status,
      current_period_end: params.currentPeriodEnd?.toISOString() || null,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}

export async function setUserFree(userId: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("user_limits")
    .update({
      tier: "free",
      daily_requests: PLANS.free.aiRequests,
      stripe_subscription_id: null,
      subscription_status: "canceled",
      current_period_end: null,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", userId);
  if (error) throw error;
}

export function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const legacy = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end;
  if (typeof legacy === "number") return new Date(legacy * 1000);
  const item = subscription.items?.data?.[0] as { current_period_end?: number } | undefined;
  return typeof item?.current_period_end === "number" ? new Date(item.current_period_end * 1000) : null;
}

export function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const legacy = (invoice as Stripe.Invoice & { subscription?: string | { id?: string } | null }).subscription;
  if (typeof legacy === "string") return legacy;
  if (legacy && typeof legacy === "object" && legacy.id) return legacy.id;
  return null;
}
