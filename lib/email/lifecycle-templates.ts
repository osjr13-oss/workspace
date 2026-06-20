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
      subject: "Start with one client workspace",
      preview: "Organize your work by client, retainer, or project",
      body: `
        <p style="margin:0 0 16px;color:${brand.colors.text};font-size:16px;font-weight:700;">${g}</p>
        <p style="margin:0 0 16px;">The fastest way to get value from ${brand.name} is a <strong>client workspace</strong> - one home for a client, retainer, or project.</p>
        <p style="margin:0 0 16px;">Notes, files, chats, and briefs all attach to it. When you chat with a workspace selected, AI can use the materials you saved there.</p>
        <p style="margin:0 0 24px;">${cta("/projects", "Create your first workspace")}</p>
        <p style="margin:0;font-size:13px;">Takes about 30 seconds.</p>
      `
    },
    tip_upload: {
      subject: "Upload a client file",
      preview: "Your files become searchable context for AI chat",
      body: `
        <p style="margin:0 0 16px;color:${brand.colors.text};font-size:16px;font-weight:700;">${g}</p>
        <p style="margin:0 0 16px;">Drop a brief, transcript, PDF, or research doc into ${brand.name}. We extract the text and use it in client-aware chat.</p>
        <p style="margin:0 0 24px;">${cta("/files", "Upload a file")}</p>
        <p style="margin:0;font-size:13px;">PDF, DOCX, Markdown, images, and plain text supported.</p>
      `
    },
    tip_chat: {
      subject: "Try client-aware chat",
      preview: "Ask questions with client notes and files as context",
      body: `
        <p style="margin:0 0 16px;color:${brand.colors.text};font-size:16px;font-weight:700;">${g}</p>
        <p style="margin:0 0 16px;">Global chat is fine - <strong>client workspace chat</strong> is where ${brand.name} shines. Select a workspace and ask anything about the materials inside it.</p>
        <p style="margin:0 0 16px;">Summarize a transcript, draft a follow-up email, or turn rough notes into a client brief.</p>
        <p style="margin:0 0 24px;">${cta("/chats", "Open chat")}</p>
      `
    },
    tip_flashcards: {
      subject: "Turn notes into brief cards",
      preview: "AI-generated brief decks from notes or files",
      body: `
        <p style="margin:0 0 16px;color:${brand.colors.text};font-size:16px;font-weight:700;">${g}</p>
        <p style="margin:0 0 16px;">Pick a note or uploaded file and let ${brand.name} generate a brief deck with facts, decisions, risks, action items, and open questions.</p>
        <p style="margin:0 0 16px;">Then use <strong>Review</strong> to keep important client context close across the engagement.</p>
        <p style="margin:0 0 24px;">${cta("/flashcards", "Create a brief deck")}</p>
      `
    },
    tip_study: {
      subject: "Brief cards are ready",
      preview: "Review due brief cards",
      body: `
        <p style="margin:0 0 16px;color:${brand.colors.text};font-size:16px;font-weight:700;">${g}</p>
        <p style="margin:0 0 16px;">You have brief cards waiting. <strong>Review</strong> walks you through due cards and schedules the next pass.</p>
        <p style="margin:0 0 24px;">${cta("/study", "Start review")}</p>
        <p style="margin:0;font-size:13px;">Even five minutes helps before the next client call.</p>
      `
    },
    nudge_inactive: {
      subject: "Your workspace is still here",
      preview: "Pick up where you left off",
      body: `
        <p style="margin:0 0 16px;color:${brand.colors.text};font-size:16px;font-weight:700;">${g}</p>
        <p style="margin:0 0 16px;">It has been a little while since you used ${brand.name}. Your notes, files, and client workspaces are saved - jump back in anytime.</p>
        <p style="margin:0 0 16px;">Quick wins: add one client note, upload one file, or ask one question in chat.</p>
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
