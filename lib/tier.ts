import type { SupabaseClient } from "@supabase/supabase-js";

export type UserLimits = {
  tier: string;
  daily_requests: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string;
  current_period_end: string | null;
};

export async function getUserLimits(supabase: SupabaseClient, userId: string): Promise<UserLimits> {
  const { data, error } = await supabase.from("user_limits").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return {
    tier: data?.tier || "free",
    daily_requests: data?.daily_requests ?? 20,
    stripe_customer_id: data?.stripe_customer_id || null,
    stripe_subscription_id: data?.stripe_subscription_id || null,
    subscription_status: data?.subscription_status || "none",
    current_period_end: data?.current_period_end || null
  };
}

export function isProActive(limits: UserLimits) {
  return limits.tier === "pro" && ["active", "trialing"].includes(limits.subscription_status);
}
