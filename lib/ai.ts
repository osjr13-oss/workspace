import { generateGemini, geminiBackgroundModel, geminiModel, streamGemini, type ChatModelMessage, type ModelTool } from "@/lib/gemini";
import { removeEmDashes } from "@/lib/text";

export type TokenUsage = { inputTokens: number; outputTokens: number };
export const NO_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0 };
export class StructuredOutputError extends Error {
  constructor(message: string, readonly raw: unknown, readonly provider: "gemini") {
    super(message); this.name = "StructuredOutputError";
    Object.defineProperty(this, "raw", { value: raw, enumerable: false });
  }
}
export function configuredAiModel(_chat = false) { return geminiModel(); }
type StreamOptions = Parameters<typeof streamGemini>[2] & { provider?: "gemini"; tools?: ModelTool[] };
export async function streamChatWithTools(messages: ChatModelMessage[], tools: ModelTool[], options: StreamOptions) {
  return streamGemini(messages, tools, options);
}
export async function completeStructured<T>(params: {
  system: string; user: string; tool: { name: string; description: string; schema: Record<string, unknown> };
  validate: (input: unknown) => T | null; temperature?: number; maxTokens?: number;
}): Promise<{ data: T; provider: "gemini"; usage: TokenUsage }> {
  const result = await generateGemini([
    { role: "system", content: `${params.system}\nReturn JSON matching this schema: ${JSON.stringify(params.tool.schema)}` },
    { role: "user", content: params.user }
  ], { json: true, temperature: params.temperature, maxTokens: params.maxTokens });
  let raw: unknown;
  try { raw = JSON.parse(result.text); } catch { throw new StructuredOutputError("Model returned invalid JSON", null, "gemini"); }
  const data = params.validate(raw);
  if (data === null) throw new StructuredOutputError("Model output failed schema validation", raw, "gemini");
  return { data, provider: "gemini", usage: result.usage };
}
export async function completeAi(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>, options?: { temperature?: number; maxTokens?: number; background?: boolean }) {
  const result = await generateGemini(messages, { ...options, model: options?.background ? geminiBackgroundModel() : geminiModel() });
  return { ...result, text: removeEmDashes(result.text) };
}
export async function streamAi(messages: ChatModelMessage[], options: StreamOptions) {
  const result = await streamChatWithTools(messages, options.tools || [], { ...options, allowTools: false });
  return { ...result, usage: { ...NO_USAGE } };
}
