import type { ResearchMetadata } from "@/lib/types";

/**
 * The chat reply protocol: /api/ai/chat answers with one JSON object per line.
 *
 *   start   the conversation id (new conversations get one here)
 *   status  what Selrano is doing while a tool runs; null clears it
 *   text    the next words of the answer
 *   model   provider metadata for diagnostics; never contains prompts or keys
 *   error   nothing could be produced; restore puts the user's text back
 */
export type ChatStreamEvent =
  | { type: "start"; threadId: string }
  | { type: "status"; label: string | null }
  | { type: "text"; text: string }
  | { type: "research"; research: ResearchMetadata }
  | { type: "model"; provider: "gemini"; model: string; fallbackReason?: string }
  | { type: "error"; error: string; restore: boolean };

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
