import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * True while `key` has made fewer than `limit` requests in the window. When the
 * check itself fails it answers false, unless `failOpen` is set (used where a
 * database hiccup must not lock the owner out, such as chat).
 */
export async function allowRequest(scope: string, key: string, limit: number, windowSeconds: number, options: { failOpen?: boolean } = {}) {
  const { data, error } = await createSupabaseAdminClient().rpc("check_rate_limit", {
    p_scope: scope,
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds
  });
  if (error) {
    console.error("[rate-limit]", scope, error);
    return Boolean(options.failOpen);
  }
  return data === true;
}
