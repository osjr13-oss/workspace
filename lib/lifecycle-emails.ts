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
  { key: "nudge_inactive", minDays: 14, maxDays: 90, eligible: (s) => s.aiEventsLast7d === 0 }
];

function daysSince(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
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

      if (profile?.lifecycle_emails === false) {
        skipped += 1;
        continue;
      }

      const accountAge = daysSince(profile?.created_at || user.created_at);
      const stats = await loadStats(admin, user.id);
      const name = profile?.full_name || user.user_metadata?.full_name || "";

      for (const campaign of CAMPAIGNS) {
        if (accountAge < campaign.minDays || accountAge > campaign.maxDays) continue;
        if (!campaign.eligible(stats)) continue;
        if (await alreadySent(admin, user.id, campaign.key)) continue;

        const template = lifecycleEmail(campaign.key, name);
        const result = await sendEmail({
          to: user.email,
          subject: template.subject,
          html: template.html,
          replyTo: process.env.SUPPORT_INBOX || undefined
        });

        if (result.ok) {
          await admin.from("lifecycle_email_log").insert({ user_id: user.id, email_key: campaign.key });
          sent += 1;
        } else {
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
