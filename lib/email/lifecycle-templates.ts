import { brand, absoluteUrl } from "@/lib/brand";
import { cta, emailLayout } from "@/lib/email/layout";

export type LifecycleEmailKey = "nudge_inactive" | "weekly_digest";

export type LifecycleEmailStats = {
  chatThreads: number;
  aiEventsLast7d: number;
};

function greeting(name: string) {
  return name ? `Hi ${name},` : "Hi there,";
}

export function lifecycleEmail(
  key: LifecycleEmailKey,
  name: string,
  _stats?: LifecycleEmailStats
): { subject: string; html: string } {
  const g = greeting(name);

  const templates: Record<LifecycleEmailKey, { subject: string; body: string; preview: string }> = {
    nudge_inactive: {
      subject: "Pick up where you left off",
      preview: "One small step is enough",
      body: `
        <p style="margin:0 0 16px;color:${brand.colors.text};font-size:16px;font-weight:700;">${g}</p>
        <p style="margin:0 0 16px;">It has been a little while since you checked in with ${brand.name}. Progress comes from small, repeatable steps, not perfect weeks.</p>
        <p style="margin:0 0 16px;">Log one meal or ask your coach one question today.</p>
        <p style="margin:0 0 24px;">${cta("/chats", "Open Selrano")}</p>
        <p style="margin:0;font-size:13px;">Turn off these emails anytime in <a href="${absoluteUrl("/settings")}" style="color:${brand.colors.text};">Settings</a>.</p>
      `
    },
    weekly_digest: {
      subject: "Your weekly check-in",
      preview: "A minute to look back and plan ahead",
      body: `
        <p style="margin:0 0 16px;color:${brand.colors.text};font-size:16px;font-weight:700;">${g}</p>
        <p style="margin:0 0 16px;">A new week is a good moment to look at what worked, what got in the way, and one thing to try next.</p>
        <p style="margin:0 0 24px;">${cta("/chats", "Check in with your coach")}</p>
        <p style="margin:0;font-size:13px;">You asked for occasional updates. You can turn them off anytime in <a href="${absoluteUrl("/settings")}" style="color:${brand.colors.text};">Settings</a>.</p>
      `
    }
  };
  const t = templates[key];
  return {
    subject: `${brand.name}: ${t.subject}`,
    html: emailLayout(t.body, t.preview, { showUnsubscribe: true })
  };
}
