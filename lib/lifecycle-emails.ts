import type { SupabaseClient } from "@supabase/supabase-js";
import { isAllowedEmail } from "@/lib/access";
import { weeklySummaryEmail, type WeeklySummaryStats } from "@/lib/email/lifecycle-templates";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * The weekly summary email: once per week (keyed to Monday, UTC) for each
 * allowed account that turned it on in Settings. It is the only recurring email.
 */

function weeklyDigestLogKey(date = new Date()) {
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysFromMonday = (monday.getUTCDay() + 6) % 7;
  monday.setUTCDate(monday.getUTCDate() - daysFromMonday);
  return `weekly_digest_${monday.toISOString().slice(0, 10)}`;
}

async function loadStats(admin: SupabaseClient, userId: string): Promise<WeeklySummaryStats> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [messages, notes, files, projects] = await Promise.all([
    admin.from("chat_messages").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("role", "user").gte("created_at", weekAgo),
    admin.from("notes").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", weekAgo),
    admin.from("files").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", weekAgo),
    admin.from("projects").select("id", { count: "exact", head: true }).eq("user_id", userId)
  ]);

  return {
    messagesLast7d: messages.count || 0,
    notesLast7d: notes.count || 0,
    filesLast7d: files.count || 0,
    projects: projects.count || 0
  };
}

async function alreadySent(admin: SupabaseClient, userId: string, key: string) {
  const { data } = await admin
    .from("lifecycle_email_log")
    .select("id")
    .eq("user_id", userId)
    .eq("email_key", key)
    .maybeSingle();
  return Boolean(data);
}

export async function runLifecycleEmailBatch() {
  if (!isEmailConfigured()) {
    return { sent: 0, skipped: 0, reason: "email_not_configured" };
  }

  const admin = createSupabaseAdminClient();
  let sent = 0;
  let skipped = 0;
  let page = 1;

  while (true) {
    const { data: list, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    if (!list.users.length) break;

    for (const user of list.users) {
      if (!user.email || !isAllowedEmail(user.email)) {
        skipped += 1;
        continue;
      }

      const { data: profile } = await admin
        .from("profiles")
        .select("full_name, lifecycle_emails")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.lifecycle_emails !== true) {
        skipped += 1;
        continue;
      }

      const logKey = weeklyDigestLogKey();
      if (await alreadySent(admin, user.id, logKey)) {
        skipped += 1;
        continue;
      }

      const stats = await loadStats(admin, user.id);
      const name = profile?.full_name || user.user_metadata?.full_name || "";
      const template = weeklySummaryEmail(name, stats);
      const { error: claimError } = await admin
        .from("lifecycle_email_log")
        .insert({ user_id: user.id, email_key: logKey });
      if (claimError) {
        skipped += 1;
        console.error("[weekly-summary] could not claim send", { userId: user.id, error: claimError.message });
        continue;
      }

      try {
        const result = await sendEmail({
          to: user.email,
          subject: template.subject,
          html: template.html
        });

        if (result.ok) {
          sent += 1;
        } else {
          await admin
            .from("lifecycle_email_log")
            .delete()
            .eq("user_id", user.id)
            .eq("email_key", logKey);
          skipped += 1;
        }
      } catch (error) {
        await admin
          .from("lifecycle_email_log")
          .delete()
          .eq("user_id", user.id)
          .eq("email_key", logKey);
        console.error("[weekly-summary] send failed", {
          userId: user.id,
          error: error instanceof Error ? error.message : String(error)
        });
        skipped += 1;
      }
    }

    if (list.users.length < 100) break;
    page += 1;
  }

  return { sent, skipped };
}
