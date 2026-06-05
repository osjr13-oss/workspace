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
      daily_requests: PLANS.pro.dailyAiRequests,
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
      daily_requests: PLANS.free.dailyAiRequests,
      stripe_subscription_id: null,
      subscription_status: "canceled",
      current_period_end: null,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", userId);
  if (error) throw error;
}
