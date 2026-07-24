import { brand } from "@/lib/brand";

type SendEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
};

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(params: SendEmailParams) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set; skipping send", params.subject);
    return { ok: false as const, skipped: true as const };
  }

  const to = Array.isArray(params.to) ? params.to : [params.to];
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: brand.emails.noreply,
      to,
      subject: params.subject,
      html: params.html,
      reply_to: params.replyTo
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Email send failed: ${detail}`);
  }

  const result = (await response.json().catch(() => null)) as { id?: string } | null;
  console.info("[email] sent", {
    id: result?.id || null,
    recipients: to.length,
    subject: params.subject
  });

  return { ok: true as const, skipped: false as const, id: result?.id || null };
}
