import type { SupabaseClient } from "@supabase/supabase-js";
import { dailyAiLimit, effectiveTier, getUserLimits } from "@/lib/tier";

function startOfUtcDay() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

/**
 * Atomically reserve one AI request against the user's daily quota.
 *
 * Delegates to the reserve_ai_usage() Postgres function, which locks per user+day,
 * checks the limit, and records the usage row in a single transaction. This closes
 * the race where two concurrent requests could each pass a separate check and push
 * the user over their daily limit.
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
  const limit = dailyAiLimit(limits);
  return `Daily AI limit reached (${limit} requests on ${tier === "pro" ? "Pro" : "Free"}). ${
    tier === "pro" ? "Try again tomorrow." : "Upgrade to Pro for 500/day."
  }`;
}

export async function getTodayUsageCount(supabase: SupabaseClient, userId: string) {
  const since = startOfUtcDay();
  const { count } = await supabase
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  return count || 0;
}
