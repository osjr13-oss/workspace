import { NextResponse } from "next/server";
import { clientIp, logAudit } from "@/lib/audit";
import { brand } from "@/lib/brand";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { supportConfirmationEmail, supportTeamNotificationEmail } from "@/lib/email/templates";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

function ticketId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SRN-${date}-${suffix}`;
}

function supportRecipients() {
  return Array.from(
    new Set(
      [process.env.SUPPORT_INBOX, "support@selrano.com"]
        .map((email) => email?.trim())
        .filter((email): email is string => Boolean(email))
    )
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      subject?: string;
      message?: string;
      company?: string;
    };

    if (body.company?.trim()) {
      return NextResponse.json({ success: true, ticketId: "SRN-SPAM" });
    }

    const name = body.name?.trim();
    const email = body.email?.trim();
    const subject = body.subject?.trim();
    const message = body.message?.trim();

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: "Name, email, subject, and message are required." }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    if (message.length > 8000) {
      return NextResponse.json({ error: "Message is too long." }, { status: 400 });
    }

    const { supabase, user } = await getAuthenticatedUser();
    const id = ticketId();

    const { error: insertError } = await supabase.from("support_requests").insert({
      ticket_id: id,
      user_id: user?.id || null,
      name,
      email,
      subject,
      message
    });

    if (insertError) throw insertError;

    await logAudit({
      user_id: user?.id || null,
      action: "support.contact",
      metadata: { ticket_id: id, subject },
      ip: clientIp(request)
    });

    if (isEmailConfigured()) {
      const inbox = supportRecipients();
      const confirmation = supportConfirmationEmail({ name, ticketId: id, subject });
      const notification = supportTeamNotificationEmail({ ticketId: id, name, email, subject, message, userId: user?.id });

      const [confirmationResult, notificationResult] = await Promise.allSettled([
        sendEmail({
          to: email,
          subject: confirmation.subject,
          html: confirmation.html,
          replyTo: brand.emails.support
        }),
        sendEmail({
          to: inbox,
          subject: notification.subject,
          html: notification.html,
          replyTo: email
        })
      ]);

      if (confirmationResult.status === "rejected" || notificationResult.status === "rejected") {
        console.error("[support/contact] email failure", {
          ticketId: id,
          confirmation:
            confirmationResult.status === "rejected" ? serializeError(confirmationResult.reason) : "sent",
          notification:
            notificationResult.status === "rejected" ? serializeError(notificationResult.reason) : "sent"
        });
      }
    }

    return NextResponse.json({
      success: true,
      ticketId: id,
      emailSent: isEmailConfigured()
    });
  } catch (error) {
    const msg = serializeError(error);
    console.error("[support/contact]", msg, error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
