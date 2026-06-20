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
    daily_requests: plan.dailyAiRequests,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    subscription_status: null,
    current_period_end: null
  };
}

export function isProActive(limits: UserLimitsRow) {
  return limits.tier === "pro" && ["active", "trialing"].includes(limits.subscription_status || "");
}

export function effectiveTier(limits: UserLimitsRow): TierId {
  return isProActive(limits) ? "pro" : "free";
}

export function dailyAiLimit(limits: UserLimitsRow) {
  return getPlan(effectiveTier(limits)).dailyAiRequests;
}

export async function assertProjectLimit(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const limits = await getUserLimits(supabase, userId);
  const plan = getPlan(effectiveTier(limits));
  if (plan.maxProjects === null) return null;

  const { count, error } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    console.error("[tier] project count failed", error);
    return null;
  }

  if ((count || 0) >= plan.maxProjects) {
    return `Free plan allows up to ${plan.maxProjects} client workspaces. Upgrade to Pro for unlimited workspaces.`;
  }

  return null;
}

export async function assertDeckLimit(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const limits = await getUserLimits(supabase, userId);
  const plan = getPlan(effectiveTier(limits));
  if (plan.maxDecks === null) return null;

  const { count, error } = await supabase
    .from("flashcard_decks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    console.error("[tier] deck count failed", error);
    return null;
  }

  if ((count || 0) >= plan.maxDecks) {
    return `Free plan allows up to ${plan.maxDecks} brief decks. Upgrade to Pro for unlimited decks.`;
  }

  return null;
}

export function assertFileSizeLimit(bytes: number, limits: UserLimitsRow): string | null {
  const plan = getPlan(effectiveTier(limits));
  const maxBytes = plan.maxFileMb * 1024 * 1024;
  if (bytes > maxBytes) {
    return `${plan.name} plan allows files up to ${plan.maxFileMb} MB. Upgrade to Pro for ${PLANS.pro.maxFileMb} MB uploads.`;
  }
  return null;
}
