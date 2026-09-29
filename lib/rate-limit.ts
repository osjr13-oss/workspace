import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function allowRequest(scope: string, key: string, limit: number, windowSeconds: number) {
  const { data, error } = await createSupabaseAdminClient().rpc("check_rate_limit", {
    p_scope: scope,
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds
  });
  if (error) {
    console.error("[rate-limit]", scope, error);
    return false;
  }
  return data === true;
}
