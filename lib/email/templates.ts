import { absoluteUrl, brand } from "@/lib/brand";

function layout(content: string, preview: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${brand.name}</title>
</head>
<body style="margin:0;padding:0;background:${brand.colors.background};font-family:'Segoe UI',system-ui,sans-serif;color:${brand.colors.text};">
  <div style="display:none;max-height:0;overflow:hidden;">${preview}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${brand.colors.background};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffefa;border:1px solid rgba(31,35,44,0.1);border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 8px;font-size:22px;font-weight:800;letter-spacing:-0.03em;">${brand.name}</td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px;font-size:15px;line-height:1.6;color:${brand.colors.muted};">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid rgba(31,35,44,0.1);font-size:12px;line-height:1.5;color:${brand.colors.muted};">
              © ${new Date().getFullYear()} ${brand.legalName}. All rights reserved.<br />
              <a href="${absoluteUrl(brand.urls.privacy)}" style="color:${brand.colors.text};">Privacy</a>
              · <a href="${absoluteUrl(brand.urls.terms)}" style="color:${brand.colors.text};">Terms</a>
              · <a href="${absoluteUrl(brand.urls.support)}" style="color:${brand.colors.text};">Support</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function welcomeEmail(params: { name: string }) {
  const greeting = params.name ? `Hi ${params.name},` : "Hi there,";
  const html = layout(
    `
      <p style="margin:0 0 16px;color:${brand.colors.text};font-size:16px;font-weight:700;">${greeting}</p>
      <p style="margin:0 0 16px;">Welcome to ${brand.name}. Your workspace is ready for notes, files, flashcards, and project-aware AI chat.</p>
      <p style="margin:0 0 24px;"><a href="${absoluteUrl("/dashboard")}" style="display:inline-block;background:${brand.colors.accent};color:#fffefa;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:700;font-size:14px;">Open your workspace</a></p>
      <p style="margin:0;">Questions? Reply to this email or reach us at <a href="mailto:${brand.emails.support}" style="color:${brand.colors.text};">${brand.emails.support}</a>. We typically respond within ${brand.support.responseSla}.</p>
    `,
    `Welcome to ${brand.name}`
  );

  return {
    subject: `Welcome to ${brand.name}`,
    html
  };
}

export function supportConfirmationEmail(params: { name: string; ticketId: string; subject: string }) {
  const html = layout(
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
  const html = layout(
    `
      <p style="margin:0 0 16px;color:${brand.colors.text};font-size:16px;font-weight:700;">New support request · ${params.ticketId}</p>
      <p style="margin:0 0 8px;"><strong>From:</strong> ${params.name} &lt;${params.email}&gt;</p>
      ${params.userId ? `<p style="margin:0 0 8px;"><strong>User ID:</strong> ${params.userId}</p>` : ""}
      <p style="margin:0 0 8px;"><strong>Subject:</strong> ${params.subject}</p>
      <p style="margin:0 0 0;white-space:pre-wrap;">${params.message.replace(/</g, "&lt;")}</p>
    `,
    `New support: ${params.subject}`
  );

  return {
    subject: `[Support] ${params.subject} (${params.ticketId})`,
    html
  };
}
