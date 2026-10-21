import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlan, PLANS, type TierId } from "@/lib/plans";

export type UserLimitsRow = {
  user_id: string;
  tier: TierId;
  daily_requests: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  referral_bonus_active?: boolean;
  referral_bonus_until?: string | null;
};

export async function getUserLimits(supabase: SupabaseClient, userId: string): Promise<UserLimitsRow> {
  const { data } = await supabase.from("user_limits").select("*").eq("user_id", userId).maybeSingle();

  if (data) {
    return data as UserLimitsRow;
  }

  const plan = getPlan("free");
  return {
    user_id: userId,
    tier: "free",
    daily_requests: plan.aiRequests,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    subscription_status: null,
    current_period_end: null,
    referral_bonus_active: false,
    referral_bonus_until: null
  };
}

export function isProActive(limits: UserLimitsRow) {
  return limits.tier === "pro" && ["active", "trialing"].includes(limits.subscription_status || "");
}

/** Referral growth loop: 3 successful referrals unlock 30 days of Pro-equivalent limits. */
export function hasReferralBonus(limits: UserLimitsRow) {
  return Boolean(limits.referral_bonus_active) && Boolean(limits.referral_bonus_until) && new Date(limits.referral_bonus_until as string) > new Date();
}

export function effectiveTier(limits: UserLimitsRow): TierId {
  return isProActive(limits) || hasReferralBonus(limits) ? "pro" : "free";
}

/** AI request allowance for the user's effective plan (20/day free, 1500/month pro). */
export function aiRequestLimit(limits: UserLimitsRow) {
  return getPlan(effectiveTier(limits)).aiRequests;
}
