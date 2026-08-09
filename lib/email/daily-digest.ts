import type { SupabaseClient } from "@supabase/supabase-js";
import { absoluteUrl } from "@/lib/brand";
import { cta, emailLayout } from "@/lib/email/layout";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { removeEmDashes } from "@/lib/text";

/**
 * The morning digest: what the Worker made overnight.
 *
 * Built on the existing lifecycle email machinery and reuses its guarantees
 * exactly. The claim is an insert into lifecycle_email_log, whose UNIQUE
 * (user_id, email_key) constraint is what enforces one email per user per day;
 * a failed send deletes the claim row so the next run can retry.
 *
 * Two rules from the spec that are enforced here rather than trusted:
 *   - No feed items, no email. There is never a "nothing happened today" send.
 *   - Off unless the user opted in specifically to the daily digest. The weekly
 *     check-in opt-in does not imply this one.
 */

export type DigestBatchSummary = {
  ran: boolean;
  reason: string;
  sent: number;
  skipped: number;
};

/** Defaults to OFF. The digest sends nothing until this is explicitly enabled. */
export function dailyDigestEnabled() {
  return process.env.DAILY_DIGEST_ENABLED?.trim().toLowerCase() === "true";
}

type DigestItem = {
  title: string;
  reason: string;
  actionType: string;
};

function digestLogKey(date = new Date()) {
  return `daily_digest_${date.toISOString().slice(0, 10)}`;
}

/**
 * Subject names the most important item, per the spec's example
 * ("New flashcards for ACC 120, midterm in 9 days"). The first item is the most
 * important one because the Judgment layer returns actions in priority order.
 */
function digestSubject(items: DigestItem[]) {
  const [first] = items;
  const rest = items.length - 1;
  const suffix = rest > 0 ? ` and ${rest} more` : "";
  return removeEmDashes(`${first.title}${suffix}`).slice(0, 140);
}

function digestHtml(name: string, items: DigestItem[]) {
  const greeting = name ? `Hi ${name},` : "Hi there,";
  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid rgba(31,35,44,0.08);">
            <div style="font-weight:700;font-size:15px;">${escapeHtml(item.title)}</div>
            <div style="font-size:14px;color:#5b6070;margin-top:4px;">${escapeHtml(item.reason)}</div>
          </td>
        </tr>`
    )
    .join("");

  const count = items.length === 1 ? "one thing" : `${items.length} things`;

  const content = `
    <p style="margin:0 0 16px;font-size:15px;">${greeting}</p>
    <p style="margin:0 0 20px;font-size:15px;">Selrano worked on ${count} for you. Review, keep, or discard.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    ${cta("Open your feed", absoluteUrl("/feed"))}
  `;

  return emailLayout(content, `Selrano made ${count} for you`, { showUnsubscribe: true });
}

function escapeHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Pending feed items created for a user since the start of today (UTC). */
async function todaysItems(admin: SupabaseClient, userId: string): Promise<DigestItem[]> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);

  const { data } = await admin
    .from("feed_items")
    .select("title, reason, action_type")
    .eq("user_id", userId)
    .eq("status", "pending")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true });

  return ((data || []) as Array<{ title: string; reason: string; action_type: string }>).map((row) => ({
    title: row.title,
    reason: row.reason,
    actionType: row.action_type
  }));
}

export async function sendDailyDigestBatch(): Promise<DigestBatchSummary> {
  const idle: DigestBatchSummary = { ran: false, reason: "", sent: 0, skipped: 0 };

  if (!dailyDigestEnabled()) return { ...idle, reason: "digest_disabled" };
  if (!isEmailConfigured()) return { ...idle, reason: "email_not_configured" };

  const admin = createSupabaseAdminClient();
  const logKey = digestLogKey();
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
        .select("full_name, daily_digest")
        .eq("id", user.id)
        .maybeSingle();

      // Opt-in is specific to the daily digest, not inherited from the weekly one.
      if (profile?.daily_digest !== true) {
        skipped += 1;
        continue;
      }

      const items = await todaysItems(admin, user.id);
      // No item, no email. Never send a message that says nothing happened.
      if (!items.length) {
        skipped += 1;
        continue;
      }

      // Claim before sending. The UNIQUE (user_id, email_key) constraint makes
      // this the one-per-day guarantee even if the cron fires twice.
      const { error: claimError } = await admin
        .from("lifecycle_email_log")
        .insert({ user_id: user.id, email_key: logKey });

      if (claimError) {
        skipped += 1;
        continue;
      }

      try {
        const result = await sendEmail({
          to: user.email,
          subject: digestSubject(items),
          html: digestHtml(profile?.full_name || "", items)
        });

        if (result.ok) {
          sent += 1;
        } else {
          // Release the claim so the next run can retry this user.
          await admin.from("lifecycle_email_log").delete().eq("user_id", user.id).eq("email_key", logKey);
          skipped += 1;
        }
      } catch (error) {
        await admin.from("lifecycle_email_log").delete().eq("user_id", user.id).eq("email_key", logKey);
        console.error("[daily-digest] send failed", {
          userId: user.id,
          error: error instanceof Error ? error.message : String(error)
        });
        skipped += 1;
      }
    }

    if (list.users.length < 100) break;
    page += 1;
  }

  return { ran: true, reason: "ok", sent, skipped };
}
