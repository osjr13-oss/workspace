import type { SupabaseClient } from "@supabase/supabase-js";

function getDailyLimit() {
  const raw = process.env.AI_DAILY_LIMIT;
  const parsed = raw ? Number.parseInt(raw, 10) : 100;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
}

function startOfUtcDay() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export async function assertWithinLimit(supabase: SupabaseClient, userId: string): Promise<string | null> {
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

  const limit = getDailyLimit();
  if ((count || 0) >= limit) {
    return `Daily AI limit reached (${limit} requests). Try again tomorrow.`;
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
