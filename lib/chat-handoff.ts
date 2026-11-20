/**
 * Hands a message from the Today page to the chat page, which sends it as a new
 * conversation. Kept in sessionStorage so it never outlives the tab and is read once.
 */
const KEY = "selrano:pending-message";

export type PendingMessage = { text: string; projectId?: string | null };

export const STARTERS = [
  { id: "notes", title: "Summarize my notes", prompt: "Summarize what is in my notes and point out anything I should follow up on." },
  { id: "week", title: "Plan my week", prompt: "Help me plan my week. Ask me what I have coming up first." },
  { id: "reply", title: "Draft a reply", prompt: "Help me draft a reply to a message. I will paste it next." },
  { id: "news", title: "What changed today", prompt: "What are the most important news stories today?" }
] as const;

export function setPendingMessage(message: PendingMessage) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ text: message.text, projectId: message.projectId || null, at: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function takePendingMessage(): PendingMessage | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as { text?: unknown; projectId?: unknown; at?: unknown };
    // A stale hand-off (the tab was left on the way) is dropped rather than sent by surprise.
    if (typeof parsed.at !== "number" || Date.now() - parsed.at > 60_000) return null;
    if (typeof parsed.text !== "string" || !parsed.text.trim()) return null;
    return { text: parsed.text, projectId: typeof parsed.projectId === "string" ? parsed.projectId : null };
  } catch {
    return null;
  }
}
