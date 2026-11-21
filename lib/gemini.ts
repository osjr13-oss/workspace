import { requireEnv } from "@/lib/env";
import type { GroqChatMessage, GroqToolCall } from "@/lib/groq";
import { removeEmDashes } from "@/lib/text";

/**
 * Google Gemini, the main chat model since 2026-11-21 (owner decision, after
 * the OpenAI account was closed). The model is one setting, GEMINI_MODEL
 * (default gemini-4-hydrogen; gemini-3.8-flash is the cheaper alternative the
 * owner may compare). Uses the generateContent REST API with server-sent events.
 *
 * Thought signatures: Gemini returns an opaque `thoughtSignature` on the first
 * functionCall part of each step and rejects the next request (400) if it is
 * not sent back on that same part. The model's parts are therefore returned
 * as `assistantContent` and replayed verbatim on the next tool round.
 */

/** One raw part of a Gemini message, kept exactly as received for replay. */
export type GeminiPart = Record<string, unknown>;
type Tool = { type: string; function: { name: string; description: string; parameters: Record<string, unknown> } };
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

export class GeminiRequestError extends Error {
  constructor(readonly status: number, readonly reason: string) {
    super(`Gemini request failed (${status}, ${reason})`);
    this.name = "GeminiRequestError";
  }
}

export function geminiReady() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function geminiModel() {
  return process.env.GEMINI_MODEL?.trim() || "gemini-4-hydrogen";
}

export function geminiBaseUrl() {
  return (process.env.GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
}

/**
 * How much the model thinks before answering. Low by default so replies start
 * quickly; GEMINI_THINKING_LEVEL (low, medium, high) trades speed for depth.
 */
function thinkingLevel() {
  return process.env.GEMINI_THINKING_LEVEL?.trim() || "low";
}

/** Used for an earlier tool call whose original signature was not kept (Google's documented placeholder). */
const PLACEHOLDER_SIGNATURE = "skip_thought_signature_validator";

async function inlineImage(url: string): Promise<GeminiPart | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return null;
    const mimeType = (response.headers.get("content-type") || "").split(";")[0].trim();
    if (!/^image\/(png|jpeg|webp|heic|heif)$/.test(mimeType)) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 7_000_000) return null;
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    return { inlineData: { mimeType, data: btoa(binary) } };
  } catch {
    return null;
  }
}

/** Chat messages in Selrano's shared shape, as Gemini contents. */
export async function toGeminiContents(messages: GroqChatMessage[], replay?: GeminiPart[], images: string[] = []) {
  const system: string[] = [];
  const contents: GeminiContent[] = [];
  const toolNames = new Map<string, string>();
  const lastToolAssistant = messages.findLastIndex((message) => message.role === "assistant" && message.tool_calls?.length);
  const lastUser = images.length ? messages.findLastIndex((message) => message.role === "user") : -1;
  const imageParts = images.length ? (await Promise.all(images.map(inlineImage))).filter((part): part is GeminiPart => Boolean(part)) : [];

  const push = (role: GeminiContent["role"], parts: GeminiPart[]) => {
    if (!parts.length) return;
    const previous = contents[contents.length - 1];
    if (previous?.role === role) previous.parts.push(...parts);
    else contents.push({ role, parts });
  };

  messages.forEach((message, index) => {
    if (message.role === "system") {
      system.push(message.content);
    } else if (message.role === "tool") {
      push("user", [{ functionResponse: { name: toolNames.get(message.tool_call_id) || "tool", id: message.tool_call_id, response: { result: message.content } } }]);
    } else if (message.role === "assistant") {
      for (const call of message.tool_calls || []) toolNames.set(call.id, call.function.name);
      if (index === lastToolAssistant && replay?.length) {
        // The model's own parts, signatures included, exactly as received.
        push("model", replay);
        return;
      }
      const parts: GeminiPart[] = message.content ? [{ text: message.content }] : [];
      (message.tool_calls || []).forEach((call, callIndex) => {
        let args: unknown = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          args = {};
        }
        parts.push({ functionCall: { name: call.function.name, args, id: call.id }, ...(callIndex === 0 ? { thoughtSignature: PLACEHOLDER_SIGNATURE } : {}) });
      });
      push("model", parts);
    } else if (message.content || index === lastUser) {
      // Pictures go before the words, as Google recommends.
      push("user", [...(index === lastUser ? imageParts : []), ...(message.content ? [{ text: message.content }] : [])]);
    }
  });
  // Gemini needs the conversation to start with the user.
  if (contents[0]?.role === "model") contents.unshift({ role: "user", parts: [{ text: "(Conversation continues.)" }] });
  return { systemInstruction: system.length ? { parts: [{ text: system.join("\n\n") }] } : undefined, contents };
}

async function failure(response: Response) {
  // Never log a provider response body: it can echo private prompts.
  const payload = await response.json().catch(() => null);
  const status = String(payload?.error?.status || "");
  const message = String(payload?.error?.message || "");
  const reason =
    response.status === 429 || status === "RESOURCE_EXHAUSTED" ? (/billing|quota/i.test(message) ? "quota" : "rate_limit")
      : response.status === 401 || response.status === 403 || /api key/i.test(message) ? "authentication"
        : response.status === 404 || /model/i.test(message) ? "model"
          : "provider";
  return new GeminiRequestError(response.status, reason);
}

/** Read a server-sent event stream, one parsed JSON object at a time. */
async function readEvents(body: ReadableStream<Uint8Array>, handle: (event: Record<string, any>) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const line = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed.startsWith("data:")) return;
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") return;
    handle(JSON.parse(data));
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const raw of lines) line(raw);
    }
    buffer += decoder.decode();
    if (buffer.trim()) line(buffer);
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

/** Stream text and tool calls from Gemini, in the same shape as the other providers. */
export async function streamGemini(
  messages: GroqChatMessage[],
  tools: Tool[],
  options: { signal?: AbortSignal; maxTokens?: number; onToken: (token: string) => void; onToolCallStart?: () => void; assistantContent?: GeminiPart[]; allowTools?: boolean; images?: string[] }
): Promise<{ text: string; toolCalls: GroqToolCall[]; assistantContent: GeminiPart[]; model: string }> {
  const controller = new AbortController();
  const firstOutputTimeout = setTimeout(() => controller.abort(), 30_000);
  const totalTimeout = setTimeout(() => controller.abort(), 150_000);
  try {
    const { systemInstruction, contents } = await toGeminiContents(messages, options.assistantContent, options.images);
    const response = await fetch(`${geminiBaseUrl()}/models/${encodeURIComponent(geminiModel())}:streamGenerateContent?alt=sse`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": requireEnv("GEMINI_API_KEY") },
      signal: options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal,
      body: JSON.stringify({
        ...(systemInstruction ? { systemInstruction } : {}),
        contents,
        ...(tools.length
          ? {
              tools: [{ functionDeclarations: tools.map(({ function: tool }) => ({ name: tool.name, description: tool.description, parameters: tool.parameters })) }],
              toolConfig: { functionCallingConfig: { mode: options.allowTools === false ? "NONE" : "AUTO" } }
            }
          : {}),
        // Thinking counts toward the output limit, so leave room for both.
        generationConfig: { maxOutputTokens: Math.max(options.maxTokens ?? 4096, 4096) + 4096, thinkingConfig: { thinkingLevel: thinkingLevel() } }
      })
    });
    if (!response.ok) throw await failure(response);
    if (!response.body) throw new Error("Gemini returned no stream");

    const parts: GeminiPart[] = [];
    let text = "";
    let finished = "";
    let model = geminiModel();
    await readEvents(response.body, (event) => {
      if (event.error) throw new Error("Gemini stream error");
      if (typeof event.modelVersion === "string") model = event.modelVersion;
      const candidate = event.candidates?.[0];
      for (const part of (candidate?.content?.parts || []) as GeminiPart[]) {
        parts.push(part);
        if (part.functionCall) {
          clearTimeout(firstOutputTimeout);
          options.onToolCallStart?.();
        } else if (typeof part.text === "string" && part.text && !part.thought) {
          clearTimeout(firstOutputTimeout);
          const token = removeEmDashes(part.text);
          text += token;
          options.onToken(token);
        }
      }
      if (candidate?.finishReason) finished = String(candidate.finishReason);
    });
    if (!finished) throw new Error("Gemini stream ended before completion");
    if (!/^(STOP|MAX_TOKENS)$/.test(finished) && !text && !parts.some((part) => part.functionCall)) {
      throw new GeminiRequestError(200, `finish_${finished.toLowerCase()}`);
    }

    const toolCalls: GroqToolCall[] = parts
      .filter((part) => part.functionCall)
      .map((part, index) => {
        const call = part.functionCall as { name?: string; args?: unknown; id?: string };
        return { id: String(call.id || `gemini-call-${index + 1}`), type: "function", function: { name: String(call.name || ""), arguments: JSON.stringify(call.args ?? {}) } };
      });
    // Calls without an id get one here, and the replayed parts must carry the same id.
    let unnamed = 0;
    const replay = parts.map((part) => {
      if (!part.functionCall) return part;
      const call = part.functionCall as Record<string, unknown>;
      unnamed += 1;
      return call.id ? part : { ...part, functionCall: { ...call, id: `gemini-call-${unnamed}` } };
    });
    return { text, toolCalls, assistantContent: replay, model };
  } finally {
    clearTimeout(firstOutputTimeout);
    clearTimeout(totalTimeout);
  }
}
