import type { SupabaseClient } from "@supabase/supabase-js";
import { dailyAiLimit, effectiveTier, getUserLimits } from "@/lib/tier";

function startOfUtcDay() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export async function assertWithinLimit(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const limits = await getUserLimits(supabase, userId);
  const tier = effectiveTier(limits);
  const limit = dailyAiLimit(limits);
  const since = startOfUtcDay();

  const { count, error } = await supabase
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  if (error) {
    console.error("[ai-usage] limit check failed", error);
    return null;
  }

  if ((count || 0) >= limit) {
    return `Daily AI limit reached (${limit} requests on ${tier === "pro" ? "Pro" : "Free"}). ${
      tier === "pro" ? "Try again tomorrow." : "Upgrade to Pro for 500/day."
    }`;
  }

  return null;
}

export async function recordUsage(
  supabase: SupabaseClient,
  userId: string,
  route: string,
  meta: { model: string; input_chars: number }
) {
  const { error } = await supabase.from("ai_usage_events").insert({
    user_id: userId,
    route,
    model: meta.model,
    input_chars: meta.input_chars
  });

  if (error) {
    console.error("[ai-usage] record failed", error);
  }
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
