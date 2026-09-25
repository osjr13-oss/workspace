import { emailFrom } from "@/lib/brand";

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
};

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export async function sendEmail(params: SendEmailParams) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { ok: false as const, skipped: true as const };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: emailFrom(),
      to: [params.to],
      subject: params.subject,
      html: params.html
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Email send failed: ${detail}`);
  }

  const result = (await response.json().catch(() => null)) as { id?: string } | null;
  return { ok: true as const, skipped: false as const, id: result?.id || null };
}
