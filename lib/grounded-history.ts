import type { SupabaseClient } from "@supabase/supabase-js";

/** Daily cleanup runs within the last day of the two-year retention window. */
export function groundedHistoryCutoff(now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 2);
  cutoff.setUTCDate(cutoff.getUTCDate() + 1);
  return cutoff.toISOString();
}

/** Owner approved 2026-10-21. Never affects legacy replies, user messages, files or notes. */
export async function expireGroundedHistory(supabase: SupabaseClient, now = new Date()) {
  const { error } = await supabase.from("chat_messages").delete()
    .eq("role", "assistant")
    .eq("research->>groundingProvider", "google")
    .gte("created_at", "2026-10-21T00:00:00.000Z")
    .lt("created_at", groundedHistoryCutoff(now));
  if (error) throw new Error("Google-grounded history cleanup failed");
}
