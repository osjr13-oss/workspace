import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlan, PLANS } from "@/lib/plans";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { aiRequestLimit, effectiveTier, getUserLimits } from "@/lib/tier";

function startOfUtcDay() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function startOfUtcMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/**
 * Atomically reserve one AI request against the user's quota.
 *
 * Free: 20 requests per UTC day. Pro (and active referral bonus): 1500 per UTC month.
 * Delegates to reserve_ai_usage() in Postgres for the locked check + insert.
 *
 * Returns null when the request is allowed, or a user-facing message when the limit
 * has been reached (send it back with HTTP 429).
 */
export async function reserveAiRequest(
  supabase: SupabaseClient,
  userId: string,
  route: string,
  meta: { model: string; input_chars: number }
): Promise<string | null> {
  const { data, error } = await supabase.rpc("reserve_ai_usage", {
    p_route: route,
    p_model: meta.model,
    p_input_chars: meta.input_chars
  });

  if (error) {
    // Fail open on infrastructure errors so a transient DB issue never blocks usage.
    console.error("[ai-usage] reserve failed", route, error);
    return null;
  }

  if (data === true) return null;

  const limits = await getUserLimits(supabase, userId);
  const tier = effectiveTier(limits);
  const plan = getPlan(tier);
  const limit = aiRequestLimit(limits);
  const periodLabel = plan.aiPeriod === "month" ? "month" : "day";
  const retryHint =
    tier === "pro"
      ? "Try again when your monthly allowance resets."
      : `Upgrade to Pro for ${PLANS.pro.aiRequests}/month.`;

  return `AI limit reached (${limit} requests per ${periodLabel} on ${tier === "pro" ? "Pro" : "Free"}). ${retryHint}`;
}

export async function getUsageCountSince(supabase: SupabaseClient, userId: string, sinceIso: string) {
  const { count } = await supabase
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", sinceIso);
  return count || 0;
}

export async function getTodayUsageCount(supabase: SupabaseClient, userId: string) {
  return getUsageCountSince(supabase, userId, startOfUtcDay());
}

export async function getMonthUsageCount(supabase: SupabaseClient, userId: string) {
  return getUsageCountSince(supabase, userId, startOfUtcMonth());
}

/** Usage for the caller's current plan period (UTC day on Free, UTC month on Pro). */
export async function getPeriodUsageCount(supabase: SupabaseClient, userId: string, period: "day" | "month") {
  return period === "month" ? getMonthUsageCount(supabase, userId) : getTodayUsageCount(supabase, userId);
}

/**
 * Gives back the request just reserved when the model could not answer, so a
 * failure never costs the user one of their messages. Best effort only.
 */
export async function refundAiRequest(userId: string, route: string) {
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("ai_usage_events")
      .select("id")
      .eq("user_id", userId)
      .eq("route", route)
      .order("created_at", { ascending: false })
      .limit(1);
    const id = data?.[0]?.id;
    if (id) await admin.from("ai_usage_events").delete().eq("id", id);
  } catch (error) {
    console.error("[ai-usage] refund failed", error);
  }
}
