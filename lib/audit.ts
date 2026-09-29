import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Audit logging is a privileged, system-level write, so it always goes through the
 * service-role client rather than the caller's own session client. This keeps it
 * working regardless of the caller's RLS permissions (and regardless of whether the
 * submitter is signed in at all, e.g. anonymous support tickets).
 */
export async function logAudit(entry: {
  user_id?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("audit_logs").insert({
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
