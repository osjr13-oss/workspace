import type { User } from "@supabase/supabase-js";
import { absoluteUrl } from "@/lib/brand";
import { escapeHtml } from "@/lib/text";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export function welcomeEmail(name: string) {
  const who = name.trim() ? ` ${escapeHtml(name.trim())}` : "";
  return {
    subject: "Welcome to Selrano",
    html: `<p>Hello${who},</p><p>Your account is ready. Conversations you start are saved to it.</p><p><a href="${escapeHtml(absoluteUrl("/chats"))}">Open your chats</a></p>`
  };
}

export async function sendWelcomeEmailOnce(user: User) {
  if (!isEmailConfigured()) return false;
  if (!user.email) return false;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    console.warn("[email/welcome] Supabase service role is not configured; skipping welcome email");
    return false;
  }

  const admin = createSupabaseAdminClient();
  const { data: claimed, error: claimError } = await admin
    .from("profiles")
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq("id", user.id)
    .is("welcome_email_sent_at", null)
    .select("id");
  if (claimError) throw claimError;
  if (!claimed || claimed.length === 0) return false;

  const name = String(user.user_metadata?.full_name || "");
  const template = welcomeEmail(name);
  try {
    await sendEmail({ to: user.email, subject: template.subject, html: template.html });
  } catch (error) {
    await admin.from("profiles").update({ welcome_email_sent_at: null }).eq("id", user.id);
    throw error;
  }
  return true;
}

export async function runWelcomeEmailRecoveryBatch() {
  if (!isEmailConfigured()) return { sent: 0, checked: 0, reason: "email_not_configured" };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return { sent: 0, checked: 0, reason: "supabase_service_role_missing" };
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
