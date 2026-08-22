import { brand, absoluteUrl } from "@/lib/brand";
import { cta, emailLayout } from "@/lib/email/layout";

export type LifecycleEmailKey =
  | "tip_projects"
  | "tip_upload"
  | "tip_chat"
  | "nudge_inactive"
  | "weekly_digest";

export type LifecycleEmailStats = {
  projects: number;
  files: number;
  chatThreads: number;
  decks: number;
  aiEventsLast7d: number;
  memories?: string[];
};

function greeting(name: string) {
  return name ? `Hi ${name},` : "Hi there,";
}

function countLabel(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function lifecycleEmail(
  key: LifecycleEmailKey,
  name: string,
  stats?: LifecycleEmailStats
): { subject: string; html: string } {
  const g = greeting(name);
  const digestStats = stats || {
    projects: 0,
    files: 0,
    chatThreads: 0,
    decks: 0,
    aiEventsLast7d: 0
  };
  const memories = (digestStats.memories || []).filter(Boolean).slice(0, 2).map(escapeHtml);

  const templates: Record<LifecycleEmailKey, { subject: string; body: string; preview: string }> = {
    tip_projects: {
      subject: "Give related thoughts a home",
      preview: "One place for related notes, files, and conversations",
      body: `
        <p style="margin:0 0 16px;color:${brand.colors.text};font-size:16px;font-weight:700;">${g}</p>
        <p style="margin:0 0 16px;">When a line of thinking keeps coming back, give it a <strong>project</strong>: one place for related notes, files, and conversations.</p>
        <p style="margin:0 0 16px;">Notes, files, and chats all attach to it. When you chat with a project selected, the AI reads your actual material instead of starting from zero.</p>
        <p style="margin:0 0 24px;">${cta("/projects", "Create your first project")}</p>
        <p style="margin:0;font-size:13px;">Takes about 30 seconds.</p>
      `
    },
    tip_upload: {
      subject: "Upload a PDF, then ask it anything",
      preview: "Your files become searchable context for AI chat",
      body: `
        <p style="margin:0 0 16px;color:${brand.colors.text};font-size:16px;font-weight:700;">${g}</p>
        <p style="margin:0 0 16px;">Drop a report, article, or PDF into ${brand.name}. We extract the text so you can ask questions about it in chat, with quotes from the right pages.</p>
        <p style="margin:0 0 24px;">${cta("/files", "Upload a file")}</p>
        <p style="margin:0;font-size:13px;">PDF, DOCX, and plain text supported.</p>
      `
    },
    tip_chat: {
      subject: "Say what is on your mind",
      preview: "A private space to work things out",
      body: `
        <p style="margin:0 0 16px;color:${brand.colors.text};font-size:16px;font-weight:700;">${g}</p>
        <p style="margin:0 0 16px;">The raw version counts: the decision you keep circling, the goal you have not said out loud yet, the idea that arrived at the wrong time.</p>
        <p style="margin:0 0 16px;">Type it into chat. Selrano remembers durable details across conversations, so next time you will not have to explain it all again.</p>
        <p style="margin:0 0 24px;">${cta("/chats", "Start thinking")}</p>
      `
    },
    nudge_inactive: {
      subject: "Your space is still here",
      preview: "Pick up where you left off",
      body: `
        <p style="margin:0 0 16px;color:${brand.colors.text};font-size:16px;font-weight:700;">${g}</p>
        <p style="margin:0 0 16px;">It has been a little while since you used ${brand.name}. Your notes, projects, and past conversations are saved exactly where you left them.</p>
        <p style="margin:0 0 16px;">Quick wins: write one thought, add one note, or ask what ${brand.name} remembers about you.</p>
        <p style="margin:0 0 24px;">${cta("/chats", "Start thinking")}</p>
        <p style="margin:0;font-size:13px;">Turn off tips anytime in <a href="${absoluteUrl("/settings")}" style="color:${brand.colors.text};">Settings</a>.</p>
      `
    },
    weekly_digest: {
      subject: "What did you figure out this week?",
      preview: "One thread worth picking back up",
      body: memories.length
        ? `
          <p style="margin:0 0 16px;color:${brand.colors.text};font-size:16px;font-weight:700;">${g}</p>
          <p style="margin:0 0 12px;">Here is what ${brand.name} remembers you thinking about:</p>
          ${memories
            .map(
              (memory) =>
                `<p style="margin:0 0 12px;border-left:3px solid ${brand.colors.text};padding:4px 0 4px 14px;font-style:italic;">${memory}</p>`
            )
            .join("\n")}
          <p style="margin:0 0 16px;">Still true? Worth another pass? Pick the thread back up and keep going.</p>
          <p style="margin:0 0 24px;">${cta("/chats", "Continue thinking")}</p>
          <p style="margin:0;font-size:13px;">You asked for occasional updates. You can turn them off anytime in <a href="${absoluteUrl("/settings")}" style="color:${brand.colors.text};">Settings</a>.</p>
        `
        : `
          <p style="margin:0 0 16px;color:${brand.colors.text};font-size:16px;font-weight:700;">${g}</p>
          <p style="margin:0 0 16px;">Your week in ${brand.name}: <strong>${countLabel(digestStats.aiEventsLast7d, "conversation")}</strong>, ${countLabel(digestStats.projects, "project")}, ${countLabel(digestStats.files, "file")}.</p>
          <p style="margin:0 0 16px;">Ask what ${brand.name} remembers about your goals and preferences. Durable details carry forward across every conversation.</p>
          <p style="margin:0 0 24px;">${cta("/chats", "Continue thinking")}</p>
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
