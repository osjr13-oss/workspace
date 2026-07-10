import type { User } from "@supabase/supabase-js";
import { logAudit } from "@/lib/audit";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { welcomeEmail } from "@/lib/email/templates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function sendWelcomeEmailOnce(user: User, options: { name?: string; ip?: string | null } = {}) {
  if (!isEmailConfigured() || !user.email) return false;

  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("welcome_email_sent_at")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (profile?.welcome_email_sent_at) return false;

  const name = options.name?.trim() || user.user_metadata?.full_name || "";
  const template = welcomeEmail({ name });
  await sendEmail({
    to: user.email,
    subject: template.subject,
    html: template.html,
    replyTo: process.env.SUPPORT_INBOX || undefined
  });

  const { error: updateError } = await admin
    .from("profiles")
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq("id", user.id)
    .is("welcome_email_sent_at", null);
  if (updateError) throw updateError;

  await logAudit({ user_id: user.id, action: "email.welcome", ip: options.ip || null });
  return true;
}
