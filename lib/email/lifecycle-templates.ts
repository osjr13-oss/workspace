import { brand } from "@/lib/brand";
import { cta, emailLayout } from "@/lib/email/layout";

export type LifecycleEmailKey = "tip_scan" | "tip_copilot" | "weekly_digest";
export type LifecycleEmailStats = {
  scans: number;
  scansLast7d: number;
  copilotMessages: number;
};

export function lifecycleEmail(
  key: LifecycleEmailKey,
  name: string,
  stats?: LifecycleEmailStats,
) {
  const safeName = name.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
  const templates = {
    tip_scan: {
      subject: "Start with your website",
      text: "Paste the URL of a website you own or have permission to check. Selrano will show the observed issues, the evidence, and a prompt to help your AI builder fix them.",
      path: "/dashboard",
      action: "Start a scan",
    },
    tip_copilot: {
      subject: "A little help with your findings",
      text: "Your saved report has a Copilot. Ask what to fix first, get help adapting a fix to your stack, or work through a verification plan.",
      path: "/copilot",
      action: "Open Copilot",
    },
    weekly_digest: {
      subject: "Your weekly security check-in",
      text: `You completed ${stats?.scansLast7d || 0} scans in the past seven days and have ${stats?.scans || 0} completed scans saved. Shipped changes recently? Run a fresh scan to check your public website again.`,
      path: "/dashboard",
      action: "Review your website",
    },
  };
  const template = templates[key];
  return {
    subject: `${brand.name}: ${template.subject}`,
    html: emailLayout(
      `<p>Hi ${safeName || "there"},</p><p>${template.text}</p><p>${cta(template.path, template.action)}</p><p>A passive scan checks observable public signals. It cannot guarantee a website is secure.</p>`,
      template.subject,
      { showUnsubscribe: true },
    ),
  };
}
