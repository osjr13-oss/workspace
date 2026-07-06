import { NextResponse } from "next/server";
import { proLaunchEmail } from "@/lib/email/templates";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";
import { serializeError } from "@/lib/serialize-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

function emailFromAddress(value?: string | null) {
  const raw = value?.trim().toLowerCase();
  if (!raw) return "";
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] || raw).trim();
}

async function authorize(request: Request) {
  const secret = process.env.WAITLIST_EXPORT_SECRET;
  if (secret && request.headers.get("authorization") === `Bearer ${secret}`) return true;

  const { user } = await getAuthenticatedUser();
  const adminEmail = emailFromAddress(process.env.PRO_LAUNCH_ADMIN_EMAIL || process.env.SUPPORT_INBOX || process.env.NEXT_PUBLIC_SUPPORT_EMAIL);
  return Boolean(user?.email && adminEmail && user.email.toLowerCase() === adminEmail);
}

export async function POST(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { dryRun?: boolean; limit?: number };
    const limit = Math.min(Math.max(body.limit || 25, 1), 100);
    const admin = createSupabaseAdminClient();

    const { data, error } = await admin
      .from("pro_waitlist")
      .select("id, email, created_at")
      .is("pro_launch_emailed_at", null)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) throw error;

    const recipients = (data || []) as Array<{ id: string; email: string; created_at: string }>;
    if (body.dryRun) {
      return NextResponse.json({
        dryRun: true,
        count: recipients.length,
        recipients: recipients.map((recipient) => recipient.email)
      });
    }

    if (!isEmailConfigured()) {
      return NextResponse.json({ error: "RESEND_API_KEY is not configured" }, { status: 500 });
    }

    const email = proLaunchEmail();
    const sentIds: string[] = [];
    const failures: Array<{ email: string; error: string }> = [];

    for (const recipient of recipients) {
      try {
        await sendEmail({
          to: recipient.email,
          subject: email.subject,
          html: email.html
        });
        sentIds.push(recipient.id);
      } catch (error) {
        failures.push({
          email: recipient.email,
          error: serializeError(error)
        });
      }
    }

    if (sentIds.length) {
      const { error: updateError } = await admin
        .from("pro_waitlist")
        .update({ pro_launch_emailed_at: new Date().toISOString() })
        .in("id", sentIds);
      if (updateError) throw updateError;
    }

    const { count } = await admin
      .from("pro_waitlist")
      .select("id", { count: "exact", head: true })
      .is("pro_launch_emailed_at", null);

    return NextResponse.json({
      sent: sentIds.length,
      failed: failures.length,
      remaining: count || 0,
      failures
    });
  } catch (error) {
    const message = serializeError(error);
    console.error("[email/pro-live]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
