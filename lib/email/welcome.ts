import type { User } from "@supabase/supabase-js";
import { logAudit } from "@/lib/audit";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { welcomeEmail } from "@/lib/email/templates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function sendWelcomeEmailOnce(user: User, options: { name?: string; ip?: string | null } = {}) {
  if (!isEmailConfigured()) {
    console.warn("[email/welcome] Email delivery is not configured");
    return false;
  }
  if (!user.email) {
    console.warn("[email/welcome] Authenticated user has no email address", { userId: user.id });
    return false;
  }

  const admin = createSupabaseAdminClient();

  // Claim the send atomically before doing it: the WHERE clause means only one
  // concurrent caller (client-side signup call, cron recovery batch, a retry)
  // can ever get a row back here for the same user.
  const { data: claimed, error: claimError } = await admin
    .from("profiles")
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq("id", user.id)
    .is("welcome_email_sent_at", null)
    .select("id");
  if (claimError) throw claimError;
  if (!claimed || claimed.length === 0) return false;

  const name = options.name?.trim() || user.user_metadata?.full_name || "";
  const template = welcomeEmail({ name });
  try {
    await sendEmail({
      to: user.email,
      subject: template.subject,
      html: template.html,
      replyTo: process.env.SUPPORT_INBOX || undefined
    });
  } catch (sendError) {
    // Release the claim so a later retry or the recovery batch can try again.
    await admin.from("profiles").update({ welcome_email_sent_at: null }).eq("id", user.id);
    throw sendError;
  }

  await logAudit({ user_id: user.id, action: "email.welcome", ip: options.ip || null });
  return true;
}

export async function runWelcomeEmailRecoveryBatch() {
  if (!isEmailConfigured()) {
    return { sent: 0, checked: 0, reason: "email_not_configured" };
  }

  const admin = createSupabaseAdminClient();
  let sent = 0;
  let checked = 0;
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    if (!data.users.length) break;

    for (const user of data.users) {
      checked += 1;
      if (await sendWelcomeEmailOnce(user)) sent += 1;
    }

    if (data.users.length < 100) break;
    page += 1;
  }

  return { sent, checked };
}
