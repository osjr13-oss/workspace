import type { SupabaseClient } from "@supabase/supabase-js";
import { lifecycleEmail, type LifecycleEmailKey } from "@/lib/email/lifecycle-templates";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type UserStats = {
  projects: number;
  files: number;
  chatThreads: number;
  decks: number;
  studyReviews: number;
  aiEventsLast7d: number;
};

type Campaign = {
  key: LifecycleEmailKey;
  minDays: number;
  maxDays: number;
  eligible: (stats: UserStats) => boolean;
};

const CAMPAIGNS: Campaign[] = [
  { key: "tip_projects", minDays: 2, maxDays: 4, eligible: (s) => s.projects === 0 },
  { key: "tip_chat", minDays: 3, maxDays: 6, eligible: (s) => s.chatThreads === 0 },
  { key: "tip_upload", minDays: 4, maxDays: 8, eligible: (s) => s.files === 0 },
  { key: "tip_flashcards", minDays: 7, maxDays: 14, eligible: (s) => s.decks === 0 },
  { key: "tip_study", minDays: 10, maxDays: 21, eligible: (s) => s.decks > 0 && s.studyReviews === 0 },
  { key: "nudge_inactive", minDays: 14, maxDays: 90, eligible: (s) => s.aiEventsLast7d === 0 },
  { key: "weekly_digest", minDays: 7, maxDays: 36500, eligible: () => true }
];

const MIN_DAYS_BETWEEN_LIFECYCLE_EMAILS = 7;

function daysSince(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function weeklyDigestLogKey(date = new Date()) {
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysFromMonday = (monday.getUTCDay() + 6) % 7;
  monday.setUTCDate(monday.getUTCDate() - daysFromMonday);
  return `weekly_digest_${monday.toISOString().slice(0, 10)}`;
}

async function loadStats(admin: SupabaseClient, userId: string): Promise<UserStats> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [projects, files, chats, decks, reviews, ai] = await Promise.all([
    admin.from("projects").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin.from("files").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin.from("chat_threads").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin.from("flashcard_decks").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin.from("study_reviews").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin.from("ai_usage_events").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", weekAgo)
  ]);

  return {
    projects: projects.count || 0,
    files: files.count || 0,
    chatThreads: chats.count || 0,
    decks: decks.count || 0,
    studyReviews: reviews.count || 0,
    aiEventsLast7d: ai.count || 0
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

async function lastLifecycleEmailSentAt(admin: SupabaseClient, userId: string) {
  const { data } = await admin
    .from("lifecycle_email_log")
    .select("sent_at")
    .eq("user_id", userId)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.sent_at as string | undefined;
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

      const lastSentAt = await lastLifecycleEmailSentAt(admin, user.id);
      if (lastSentAt && daysSince(lastSentAt) < MIN_DAYS_BETWEEN_LIFECYCLE_EMAILS) {
        skipped += 1;
        continue;
      }

      const accountAge = daysSince(profile?.created_at || user.created_at);
      const stats = await loadStats(admin, user.id);
      const name = profile?.full_name || user.user_metadata?.full_name || "";

      for (const campaign of CAMPAIGNS) {
        if (accountAge < campaign.minDays || accountAge > campaign.maxDays) continue;
        if (!campaign.eligible(stats)) continue;
        const logKey = campaign.key === "weekly_digest" ? weeklyDigestLogKey() : campaign.key;
        if (await alreadySent(admin, user.id, logKey)) continue;

        const template = lifecycleEmail(campaign.key, name, stats);
        const { error: claimError } = await admin
          .from("lifecycle_email_log")
          .insert({ user_id: user.id, email_key: logKey });
        if (claimError) {
          skipped += 1;
          console.error("[lifecycle-email] could not claim send", {
            userId: user.id,
            campaign: campaign.key,
            error: claimError.message
          });
          break;
        }

        try {
          const result = await sendEmail({
            to: user.email,
            subject: template.subject,
            html: template.html,
            replyTo: process.env.SUPPORT_INBOX || undefined
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
          console.error("[lifecycle-email] send failed", {
            userId: user.id,
            campaign: campaign.key,
            error: error instanceof Error ? error.message : String(error)
          });
          skipped += 1;
        }

        break;
      }
    }

    if (list.users.length < 100) break;
    page += 1;
  }

  return { sent, skipped };
}
