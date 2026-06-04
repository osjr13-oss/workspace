import { NextResponse } from "next/server";
import { logAudit, clientIp } from "@/lib/audit";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { welcomeEmail } from "@/lib/email/templates";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as { name?: string };
    const name = body.name?.trim() || user.user_metadata?.full_name || "";

    if (!isEmailConfigured()) {
      return NextResponse.json({ success: true, emailSent: false });
    }

    if (!user.email) {
      return NextResponse.json({ error: "No email on account" }, { status: 400 });
    }

    const template = welcomeEmail({ name });
    await sendEmail({
      to: user.email,
      subject: template.subject,
      html: template.html,
      replyTo: process.env.SUPPORT_INBOX || undefined
    });

    await logAudit(supabase, {
      user_id: user.id,
      action: "email.welcome",
      ip: clientIp(request)
    });

    return NextResponse.json({ success: true, emailSent: true });
  } catch (error) {
    const msg = serializeError(error);
    console.error("[email/welcome]", msg, error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
