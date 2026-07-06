import { absoluteUrl, brand } from "@/lib/brand";
import { cta, emailLayout } from "@/lib/email/layout";
import { PLANS } from "@/lib/plans";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function welcomeEmail(params: { name: string }) {
  const greeting = params.name ? `Hi ${params.name},` : "Hi there,";
  const html = emailLayout(
    `
      <p style="margin:0 0 16px;color:${brand.colors.text};font-size:16px;font-weight:700;">${greeting}</p>
      <p style="margin:0 0 16px;">Welcome to ${brand.name}. Your workspace is ready for notes, files, flashcards, and project-aware AI chat.</p>
      <p style="margin:0 0 24px;">${cta("/dashboard", "Open your workspace")}</p>
      <p style="margin:0;">Questions? Reply to this email or reach us at <a href="mailto:${brand.emails.support}" style="color:${brand.colors.text};">${brand.emails.support}</a>. We typically respond within ${brand.support.responseSla}.</p>
    `,
    `Welcome to ${brand.name}`
  );

  return {
    subject: `Welcome to ${brand.name}`,
    html
  };
}

export function proLaunchEmail() {
  const html = emailLayout(
    `
      <p style="margin:0 0 16px;color:${brand.colors.text};font-size:16px;font-weight:700;">Pro is live</p>
      <p style="margin:0 0 16px;">Thanks for joining the ${brand.name} Pro waitlist. Billing is now open, and you can upgrade to Pro for $19/month.</p>
      <p style="margin:0 0 16px;">Pro includes ${PLANS.pro.dailyAiRequests} AI messages per day, unlimited projects and flashcard decks, and larger file uploads.</p>
      <p style="margin:0 0 24px;">${cta("/pricing", "Upgrade to Pro")}</p>
      <p style="margin:0;">Questions? Reply to this email or reach us at <a href="mailto:${brand.emails.support}" style="color:${brand.colors.text};">${brand.emails.support}</a>.</p>
    `,
    `${brand.name} Pro is live`,
    { showUnsubscribe: true }
  );

  return {
    subject: `${brand.name} Pro is live`,
    html
  };
}

export function supportConfirmationEmail(params: { name: string; ticketId: string; subject: string }) {
  const html = emailLayout(
    `
      <p style="margin:0 0 16px;color:${brand.colors.text};font-size:16px;font-weight:700;">We received your message</p>
      <p style="margin:0 0 16px;">Hi ${params.name || "there"}, thanks for contacting ${brand.name} support. Your request is logged as <strong>${params.ticketId}</strong>.</p>
      <p style="margin:0 0 8px;"><strong>Subject:</strong> ${params.subject}</p>
      <p style="margin:0 0 16px;">Our team aims to respond within <strong>${brand.support.responseSla}</strong> (${brand.support.hours}).</p>
      <p style="margin:0;">For urgent security issues, email <a href="mailto:${brand.emails.security}" style="color:${brand.colors.text};">${brand.emails.security}</a>.</p>
    `,
    `Support request ${params.ticketId} received`
  );

  return {
    subject: `[${brand.name}] Support request received (${params.ticketId})`,
    html
  };
}

export function supportTeamNotificationEmail(params: {
  ticketId: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  userId?: string | null;
}) {
  const html = emailLayout(
    `
      <p style="margin:0 0 16px;color:${brand.colors.text};font-size:16px;font-weight:700;">New support request · ${params.ticketId}</p>
      <p style="margin:0 0 8px;"><strong>From:</strong> ${params.name} &lt;${params.email}&gt;</p>
      ${params.userId ? `<p style="margin:0 0 8px;"><strong>User ID:</strong> ${params.userId}</p>` : ""}
      <p style="margin:0 0 8px;"><strong>Subject:</strong> ${params.subject}</p>
      <p style="margin:0 0 0;white-space:pre-wrap;">${escapeHtml(params.message)}</p>
    `,
    `New support: ${params.subject}`
  );

  return {
    subject: `[Support] ${params.subject} (${params.ticketId})`,
    html
  };
}
