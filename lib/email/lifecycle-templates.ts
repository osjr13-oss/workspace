import { brand, absoluteUrl } from "@/lib/brand";
import { cta, emailLayout } from "@/lib/email/layout";

/** The only recurring email Selrano sends: an opt-in weekly summary for allowed accounts. */
export type WeeklySummaryStats = {
  messagesLast7d: number;
  notesLast7d: number;
  filesLast7d: number;
  projects: number;
};

function countLabel(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function weeklySummaryEmail(name: string, stats: WeeklySummaryStats): { subject: string; html: string } {
  const greeting = name ? `Hi ${name},` : "Hi there,";
  const body = `
    <p style="margin:0 0 16px;color:${brand.colors.text};font-size:16px;font-weight:700;">${greeting}</p>
    <p style="margin:0 0 16px;">Your week in ${brand.name}: <strong>${countLabel(stats.messagesLast7d, "message")}</strong> sent, ${countLabel(stats.notesLast7d, "note")} and ${countLabel(stats.filesLast7d, "file")} added, across ${countLabel(stats.projects, "project")}.</p>
    <p style="margin:0 0 24px;">${cta("/chats", "Open Selrano")}</p>
    <p style="margin:0;font-size:13px;">You turned on the weekly summary. Turn it off anytime in <a href="${absoluteUrl("/settings")}" style="color:${brand.colors.text};">Settings</a>.</p>
  `;
  return {
    subject: `${brand.name}: your week`,
    html: emailLayout(body, "Your Selrano week, in one glance", { showUnsubscribe: true })
  };
}
