import type { SupabaseClient } from "@supabase/supabase-js";

export async function logAudit(
  supabase: SupabaseClient,
  entry: {
    user_id?: string | null;
    action: string;
    metadata?: Record<string, unknown>;
    ip?: string | null;
  }
) {
  const { error } = await supabase.from("audit_logs").insert({
    user_id: entry.user_id || null,
    action: entry.action,
    metadata: entry.metadata || {},
    ip_address: entry.ip || null
  });

  if (error) {
    console.error("[audit]", entry.action, error);
  }
}

export function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}
