import { requireEnv } from "@/lib/env";
import { removeEmDashes } from "@/lib/text";

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type ChatModelMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };
export type ModelTool = { type: string; function: { name: string; description: string; parameters: Record<string, unknown> } };
export type GeminiPart = { text?: string; thought?: boolean; thoughtSignature?: string; functionCall?: { name: string; args?: unknown; id?: string }; functionResponse?: { name: string; id?: string; response: { result: string } }; inlineData?: { mimeType: string; data: string } };
export type Grounding = {
  webSearchQueries?: string[];
  searchEntryPoint?: { renderedContent?: string };
  groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
  groundingSupports?: Array<{ segment?: { startIndex?: number; endIndex?: number; text?: string }; groundingChunkIndices?: number[] }>;
};
type Payload = { error?: unknown; modelVersion?: string; promptFeedback?: { blockReason?: string }; candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string; groundingMetadata?: Grounding }>; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
export const geminiModel = () => process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
export const geminiBackgroundModel = () => process.env.GEMINI_BACKGROUND_MODEL?.trim() || geminiModel();
export class GeminiHttpError extends Error {
  constructor(readonly status: number) { super(`Gemini request failed (${status})`); this.name = "GeminiHttpError"; }
  get rateLimited() { return this.status === 429; }
}

function contents(messages: ChatModelMessage[], assistantContent?: GeminiPart[]) {
  const system: string[] = [];
  const output: Array<{ role: "user" | "model"; parts: GeminiPart[] }> = [];
  const lastTool = messages.findLastIndex((m) => m.role === "assistant" && m.tool_calls?.length);
  const calls = new Map<string, string>();
  messages.forEach((m, i) => {
    if (m.role === "system") { system.push(m.content); return; }
    const role = m.role === "assistant" ? "model" : "user";
    let parts: GeminiPart[];
    if (m.role === "tool") {
      const name = calls.get(m.tool_call_id);
      if (!name) throw new Error("Missing tool call for Gemini continuation");
      const id = assistantContent?.find((p) => p.functionCall?.id === m.tool_call_id)?.functionCall?.id;
      parts = [{ functionResponse: { name, ...(id ? { id } : {}), response: { result: m.content } } }];
    } else {
      if (m.role === "assistant") for (const call of m.tool_calls || []) calls.set(call.id, call.function.name);
      // Signatures and thought parts remain private and are replayed verbatim only within this turn.
      parts = i === lastTool && assistantContent ? assistantContent : [
        ...(m.content ? [{ text: m.content }] : []),
        ...(m.role === "assistant" ? (m.tool_calls || []).map((c) => ({ functionCall: { name: c.function.name, args: JSON.parse(c.function.arguments) } })) : [])
      ];
    }
    if (!parts.length) return;
    const previous = output.at(-1);
    if (previous?.role === role) previous.parts.push(...parts);
    else output.push({ role, parts });
  });
  return { systemInstruction: { parts: [{ text: system.join("\n\n") }] }, contents: output };
}

export async function geminiRequest(body: Record<string, unknown>, options: { signal?: AbortSignal; model?: string; stream?: boolean } = {}) {
  const key = requireEnv("GEMINI_API_KEY");
  const model = options.model || geminiModel();
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000);
  const base = process.env.GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com/v1beta";
  const url = `${base}/models/${encodeURIComponent(model)}:${options.stream ? "streamGenerateContent?alt=sse" : "generateContent"}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(url, { method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
    if (response.ok) return response;
    await response.body?.cancel();
    if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
      const wait = Number(response.headers.get("retry-after") || 1) * 1000;
      if (Number.isFinite(wait) && wait >= 0 && wait <= 9000) {
        await new Promise<void>((resolve, reject) => {
          signal.throwIfAborted();
          const abort = () => { clearTimeout(timer); reject(signal.reason); };
          const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, wait);
          signal.addEventListener("abort", abort, { once: true });
        });
        continue;
      }
    }
    throw new GeminiHttpError(response.status);
  }
  throw new Error("Gemini unavailable");
}

function checkPayload(payload: Payload) {
  if (payload.error || payload.promptFeedback?.blockReason) throw new Error("Gemini could not complete this response");
  const finish = payload.candidates?.[0]?.finishReason;
  if (finish && finish !== "STOP") throw new Error(`Gemini response incomplete (${finish})`);
}

export async function streamGemini(messages: ChatModelMessage[], tools: ModelTool[], options: {
  signal?: AbortSignal; temperature?: number; maxTokens?: number; onToken: (token: string) => void;
  onToolCallStart?: () => void; assistantContent?: GeminiPart[]; allowTools?: boolean;
}) {
  const response = await geminiRequest({
    ...contents(messages, options.assistantContent),
    generationConfig: { temperature: options.temperature ?? 0.5, maxOutputTokens: options.maxTokens ?? 8192, thinkingConfig: { thinkingLevel: "low" } },
    ...(tools.length ? { tools: [{ functionDeclarations: tools.map((t) => t.function) }], toolConfig: { functionCallingConfig: { mode: options.allowTools === false ? "NONE" : "AUTO" } } } : {})
  }, { signal: options.signal, stream: true });
  if (!response.body) throw new Error("Gemini returned no stream");
  let text = "";
  let model = geminiModel();
  let completed = false;
  const assistantContent: GeminiPart[] = [];
  const toolCalls: ToolCall[] = [];
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const consume = (line: string) => {
    if (!line.startsWith("data:")) return;
    const payload = JSON.parse(line.slice(5).trim()) as Payload;
    checkPayload(payload);
    model = payload.modelVersion || model;
    const candidate = payload.candidates?.[0];
    if (candidate?.finishReason === "STOP") completed = true;
    for (const part of candidate?.content?.parts || []) {
      assistantContent.push(part);
      if (part.functionCall) {
        options.onToolCallStart?.();
        toolCalls.push({ id: part.functionCall.id || `gemini_${toolCalls.length}`, type: "function", function: { name: part.functionCall.name, arguments: JSON.stringify(part.functionCall.args || {}) } });
      } else if (part.text && !part.thought) {
        const token = removeEmDashes(part.text);
        text += token; options.onToken(token);
      }
    }
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n"); buffer = lines.pop() || "";
      for (const line of lines) consume(line.trim());
    }
    buffer += decoder.decode();
    if (buffer.trim()) consume(buffer.trim());
    if (!completed) throw new Error("Gemini stream ended before completion");
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return { text: text.trim(), toolCalls, assistantContent, model, provider: "gemini" as const, fallbackReason: undefined };
}

export async function generateGemini(messages: ChatModelMessage[], options: { model?: string; maxTokens?: number; temperature?: number; signal?: AbortSignal; json?: boolean; googleSearch?: boolean; image?: { mimeType: string; data: string } } = {}) {
  const input = contents(messages);
  if (options.image) input.contents.at(-1)?.parts.push({ inlineData: options.image });
  const response = await geminiRequest({ ...input,
    generationConfig: { temperature: options.temperature ?? 0.2, maxOutputTokens: options.maxTokens ?? 8192, thinkingConfig: { thinkingLevel: "low" }, ...(options.json ? { responseMimeType: "application/json" } : {}) },
    ...(options.googleSearch ? { tools: [{ google_search: {} }] } : {})
  }, options);
  const payload = await response.json() as Payload;
  checkPayload(payload);
  if (payload.candidates?.[0]?.finishReason !== "STOP") throw new Error("Gemini returned no completed answer");
  return { text: (payload.candidates[0].content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join(""), grounding: payload.candidates[0].groundingMetadata,
    provider: "gemini" as const, model: payload.modelVersion || options.model || geminiModel(),
    usage: { inputTokens: payload.usageMetadata?.promptTokenCount || 0, outputTokens: payload.usageMetadata?.candidatesTokenCount || 0 } };
}
