import type { ResearchMetadata } from "@/lib/types";

/**
 * The chat reply protocol: /api/ai/chat answers with one JSON object per line.
 *
 *   start   the conversation id (new conversations get one here)
 *   status  what Selrano is doing while a tool runs; null clears it
 *   text    the next words of the answer
 *   model   provider metadata for diagnostics; never contains prompts or keys
 *   action  something a tool did for the user (a note, a memory, a draft, an event), for a notice
 *   error   nothing could be produced; restore puts the user's text back
 */
export type ChatStreamEvent =
  | { type: "start"; threadId: string }
  | { type: "status"; label: string | null }
  | { type: "text"; text: string }
  | { type: "research"; research: ResearchMetadata }
  | { type: "model"; provider: "openai" | "groq"; model: string; fallbackReason?: string }
  | { type: "action"; kind: ChatActionKind; label: string }
  | { type: "error"; error: string; restore: boolean };

export type ChatActionKind = "note" | "memory" | "draft" | "event";

/** Which successful tool results the page should confirm with a notice. */
const ACTION_RESULTS: Record<string, { kind: ChatActionKind; success: RegExp; label: string }> = {
  create_note: { kind: "note", success: /^Created note/, label: "Note created" },
  remember: { kind: "memory", success: /^Saved to memory/, label: "Saved to memory" },
  gmail_draft: { kind: "draft", success: /^Created a Gmail draft/, label: "Draft saved in Gmail" },
  calendar_add: { kind: "event", success: /^Added "/, label: "Added to your calendar" }
};

export function toolActionEvent(toolName: string, result: string): ChatStreamEvent | null {
  const match = ACTION_RESULTS[toolName];
  if (!match || !match.success.test(result)) return null;
  return { type: "action", kind: match.kind, label: match.label };
}

/** Reads a chat reply stream and hands each event to onEvent as soon as its line is complete. */
export async function readChatStream(body: ReadableStream<Uint8Array>, onEvent: (event: ChatStreamEvent) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const flushLines = () => {
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) {
        try {
          onEvent(JSON.parse(line) as ChatStreamEvent);
        } catch {
          // A malformed line is skipped rather than ending the reply.
        }
      }
      newline = buffer.indexOf("\n");
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    flushLines();
  }
  buffer += decoder.decode();
  if (buffer.trim()) buffer += "\n";
  flushLines();
}
