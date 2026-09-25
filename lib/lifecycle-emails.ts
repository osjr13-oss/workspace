import { absoluteUrl } from "@/lib/brand";
import { escapeHtml } from "@/lib/text";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Stats = {
  threads: number;
  files: number;
  notes: number;
  decks: number;
  messagesLast7d: number;
};

type CampaignKey = "tip_chat" | "tip_files" | "tip_flashcards" | "nudge_inactive" | "weekly_digest";

const CAMPAIGNS: Array<{
  key: CampaignKey;
  minDays: number;
  maxDays: number;
  eligible: (stats: Stats) => boolean;
}> = [
  { key: "tip_chat", minDays: 2, maxDays: 6, eligible: (stats) => stats.threads === 0 },
  { key: "tip_files", minDays: 4, maxDays: 10, eligible: (stats) => stats.files === 0 },
  { key: "tip_flashcards", minDays: 7, maxDays: 16, eligible: (stats) => stats.decks === 0 },
  { key: "nudge_inactive", minDays: 14, maxDays: 90, eligible: (stats) => stats.messagesLast7d === 0 },
  { key: "weekly_digest", minDays: 7, maxDays: 36500, eligible: () => true }
];

const MIN_DAYS_BETWEEN = 7;

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function weeklyKey(date = new Date()) {
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysFromMonday = (monday.getUTCDay() + 6) % 7;
  monday.setUTCDate(monday.getUTCDate() - daysFromMonday);
  return `weekly_digest_${monday.toISOString().slice(0, 10)}`;
}

function lifecycleHtml(key: CampaignKey, name: string, stats: Stats) {
  const who = name.trim() ? ` ${escapeHtml(name.trim())}` : "";
  const open = `<p><a href="${escapeHtml(absoluteUrl("/chats"))}">Open your chats</a></p>`;
  const bodies: Record<CampaignKey, { subject: string; html: string }> = {
    tip_chat: {
      subject: "Your chats are still empty",
      html: `<p>Hello${who},</p><p>You have not started a conversation yet. A thread is saved to your account when you do.</p>${open}`
    },
    tip_files: {
      subject: "You can attach a file to a chat",
      html: `<p>Hello${who},</p><p>Attach a text file, PDF, or document and the reply can read it. If a file cannot be read, the chat says so.</p>${open}`
    },
    tip_flashcards: {
      subject: "Ask the chat for flashcards",
      html: `<p>Hello${who},</p><p>Ask for flashcards in a conversation. The deck opens from that reply, and from your account menu.</p>${open}`
    },
    nudge_inactive: {
      subject: "Nothing new in your chats this week",
      html: `<p>Hello${who},</p><p>There have been no new messages in the last week. Your earlier threads are still there.</p>${open}`
    },
    weekly_digest: {
      subject: "Your week in chat",
      html: `<p>Hello${who},</p><p>Threads: ${stats.threads}. Notes: ${stats.notes}. Decks: ${stats.decks}. Messages in the last 7 days: ${stats.messagesLast7d}.</p>${open}`
    }
  };
  return bodies[key];
}

export async function runLifecycleEmailBatch() {
  if (!isEmailConfigured()) return { sent: 0, skipped: 0, reason: "email_not_configured" };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return { sent: 0, skipped: 0, reason: "supabase_service_role_missing" };
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
      if (!user.email) {
        skipped += 1;
        continue;
      }
      const { data: profile } = await admin
        .from("profiles")
        .select("full_name, lifecycle_emails, created_at")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.lifecycle_emails !== true) {
        skipped += 1;
        continue;
      }

      const { data: last } = await admin
        .from("lifecycle_email_log")
        .select("sent_at")
        .eq("user_id", user.id)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last?.sent_at && daysSince(last.sent_at) < MIN_DAYS_BETWEEN) {
        skipped += 1;
        continue;
      }

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [threads, files, notes, decks, messages] = await Promise.all([
        admin.from("chat_threads").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        admin.from("files").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        admin.from("notes").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        admin.from("flashcard_decks").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        admin.from("chat_messages").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", weekAgo)
      ]);
      const stats: Stats = {
        threads: threads.count || 0,
        files: files.count || 0,
        notes: notes.count || 0,
        decks: decks.count || 0,
        messagesLast7d: messages.count || 0
      };
      const accountAge = daysSince(profile?.created_at || user.created_at);
      const name = profile?.full_name || String(user.user_metadata?.full_name || "");
      let sentOne = false;

      for (const campaign of CAMPAIGNS) {
        if (accountAge < campaign.minDays || accountAge > campaign.maxDays) continue;
        if (!campaign.eligible(stats)) continue;
        const logKey = campaign.key === "weekly_digest" ? weeklyKey() : campaign.key;
        const { data: existing } = await admin
          .from("lifecycle_email_log")
          .select("id")
          .eq("user_id", user.id)
          .eq("email_key", logKey)
          .maybeSingle();
        if (existing) continue;

        const { error: claimError } = await admin.from("lifecycle_email_log").insert({ user_id: user.id, email_key: logKey });
        if (claimError) break;
        const template = lifecycleHtml(campaign.key, name, stats);
        try {
          await sendEmail({ to: user.email, subject: template.subject, html: template.html });
          sent += 1;
          sentOne = true;
        } catch (sendError) {
          await admin.from("lifecycle_email_log").delete().eq("user_id", user.id).eq("email_key", logKey);
          throw sendError;
        }
        break;
      }
      if (!sentOne) skipped += 1;
    }

    if (list.users.length < 100) break;
    page += 1;
  }

  return { sent, skipped };
}
