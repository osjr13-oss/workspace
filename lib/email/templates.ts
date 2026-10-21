import { absoluteUrl, brand } from "@/lib/brand";
import { cta, emailLayout } from "@/lib/email/layout";

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
      <p style="margin:0 0 16px;">Welcome to ${brand.name}. Set your goal, log a meal or two, and your coach will take it from there.</p>
      <p style="margin:0 0 24px;">${cta("/chats", "Get started")}</p>
    `,
    `Welcome to ${brand.name}`
  );

  return {
    subject: `Welcome to ${brand.name}`,
    html
  };
}
