import { brand, absoluteUrl } from "@/lib/brand";
import { cta, emailLayout } from "@/lib/email/layout";

export type LifecycleEmailKey =
  | "tip_projects"
  | "tip_upload"
  | "tip_chat"
  | "tip_flashcards"
  | "tip_study"
  | "nudge_inactive";

function greeting(name: string) {
  return name ? `Hi ${name},` : "Hi there,";
}

export function lifecycleEmail(key: LifecycleEmailKey, name: string): { subject: string; html: string } {
  const g = greeting(name);

  const templates: Record<LifecycleEmailKey, { subject: string; body: string; preview: string }> = {
    tip_projects: {
      subject: "Start with one project",
      preview: "Organize your work by course or topic",
      body: `
        <p style="margin:0 0 16px;color:${brand.colors.text};font-size:16px;font-weight:700;">${g}</p>
        <p style="margin:0 0 16px;">The fastest way to get value from ${brand.name} is a <strong>project</strong> — one folder for a class, paper, or exam.</p>
        <p style="margin:0 0 16px;">Notes, files, chats, and flashcards all attach to it. When you chat with a project selected, the AI reads your actual materials.</p>
        <p style="margin:0 0 24px;">${cta("/projects", "Create your first project")}</p>
        <p style="margin:0;font-size:13px;">Takes about 30 seconds.</p>
      `
    },
    tip_upload: {
      subject: "Upload a PDF — then ask it anything",
      preview: "Your files become searchable context for AI chat",
      body: `
        <p style="margin:0 0 16px;color:${brand.colors.text};font-size:16px;font-weight:700;">${g}</p>
        <p style="margin:0 0 16px;">Drop a syllabus, article, or lecture PDF into ${brand.name}. We extract the text and use it in project chat — including quotes from the right pages.</p>
        <p style="margin:0 0 24px;">${cta("/files", "Upload a file")}</p>
        <p style="margin:0;font-size:13px;">PDF, DOCX, and plain text supported.</p>
      `
    },
    tip_chat: {
      subject: "Try project-aware chat",
      preview: "Ask questions with your notes and files as context",
      body: `
        <p style="margin:0 0 16px;color:${brand.colors.text};font-size:16px;font-weight:700;">${g}</p>
        <p style="margin:0 0 16px;">Global chat is fine — <strong>project chat</strong> is where ${brand.name} shines. Select a project and ask anything about your materials.</p>
        <p style="margin:0 0 16px;">Summarize a chapter, clarify a concept, or draft an outline from what you uploaded.</p>
        <p style="margin:0 0 24px;">${cta("/chats", "Open chat")}</p>
      `
    },
    tip_flashcards: {
      subject: "Turn your notes into flashcards",
      preview: "AI-generated decks from notes or files",
      body: `
        <p style="margin:0 0 16px;color:${brand.colors.text};font-size:16px;font-weight:700;">${g}</p>
        <p style="margin:0 0 16px;">Pick a note or uploaded file and let ${brand.name} generate a flashcard deck in seconds.</p>
        <p style="margin:0 0 16px;">Then use <strong>Study mode</strong> for spaced repetition review before exams.</p>
        <p style="margin:0 0 24px;">${cta("/flashcards", "Create a deck")}</p>
      `
    },
    tip_study: {
      subject: "Cards are ready — start studying",
      preview: "Review due flashcards in Study mode",
      body: `
        <p style="margin:0 0 16px;color:${brand.colors.text};font-size:16px;font-weight:700;">${g}</p>
        <p style="margin:0 0 16px;">You have flashcards waiting. <strong>Study mode</strong> walks you through due cards and schedules the next review.</p>
        <p style="margin:0 0 24px;">${cta("/study", "Start studying")}</p>
        <p style="margin:0;font-size:13px;">Even five minutes helps retention.</p>
      `
    },
    nudge_inactive: {
      subject: "Your workspace is still here",
      preview: "Pick up where you left off",
      body: `
        <p style="margin:0 0 16px;color:${brand.colors.text};font-size:16px;font-weight:700;">${g}</p>
        <p style="margin:0 0 16px;">It has been a little while since you used ${brand.name}. Your notes, files, and projects are saved — jump back in anytime.</p>
        <p style="margin:0 0 16px;">Quick wins: add one note, upload one PDF, or ask one question in chat.</p>
        <p style="margin:0 0 24px;">${cta("/dashboard", "Open dashboard")}</p>
        <p style="margin:0;font-size:13px;">Turn off tips anytime in <a href="${absoluteUrl("/settings")}" style="color:${brand.colors.text};">Settings</a>.</p>
      `
    }
  };

  const t = templates[key];
  return {
    subject: `${brand.name}: ${t.subject}`,
    html: emailLayout(t.body, t.preview, { showUnsubscribe: true })
  };
}
