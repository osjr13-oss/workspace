import {
  callGroq,
  callGroqStructured,
  groqBackgroundModel,
  groqFallbackModel,
  groqModel,
  streamGroq,
  streamGroqWithTools,
  type GroqChatMessage
} from "@/lib/groq";
import { removeEmDashes } from "@/lib/text";
import { openaiModel, openaiReady, OpenAIRequestError, streamOpenAI, type OpenAIItem } from "@/lib/openai";
import { geminiModel, geminiReady, GeminiRequestError, streamGemini, type GeminiPart } from "@/lib/gemini";

type SimpleMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiProvider = "groq" | "openai" | "gemini";

/** Tokens billed for one model call. Zero means the provider did not return usage. */
export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
};

export const NO_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0 };

type CompletionResult = {
  text: string;
  provider: AiProvider;
  usage: TokenUsage;
  model?: string;
  fallbackReason?: string;
};

/**
 * Thrown when a structured call comes back but its payload does not satisfy the
 * caller's validator. Carries the raw arguments so the failure can be logged and
 * inspected rather than silently retried into the void.
 */
export class StructuredOutputError extends Error {
  constructor(
    message: string,
    readonly raw: unknown,
    readonly provider: AiProvider
  ) {
    super(message);
    this.name = "StructuredOutputError";
  }
}

function groqReady() {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

export function configuredAiModel(chat = false) {
  return chat && geminiReady() ? geminiModel() : chat && openaiReady() ? openaiModel() : groqModel();
}

type StreamOptions = {
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
  onToken: (token: string) => void;
  onToolCallStart?: () => void;
  provider?: AiProvider;
  /** The previous tool round's raw output (OpenAI items or Gemini parts), replayed to the same provider. */
  assistantContent?: Array<Record<string, unknown>>;
  tools?: Parameters<typeof streamOpenAI>[1];
  allowTools?: boolean;
  cacheKey?: string;
  /** Private links to pictures attached to the newest message (Gemini and OpenAI; Groq gets their text). */
  images?: string[];
};

/**
 * The main model is Gemini when GEMINI_API_KEY is set, otherwise OpenAI when
 * OPENAI_API_KEY is set; Groq is the fallback. Fall back only before text
 * starts, so two providers never splice answers together. A tool round that
 * began on one provider continues on it (options.provider).
 */
export async function streamChatWithTools(
  messages: GroqChatMessage[],
  tools: Parameters<typeof streamOpenAI>[1],
  options: StreamOptions
) {
  let fallbackReason: string | undefined;
  if (geminiReady() && (options.provider === undefined || options.provider === "gemini")) {
    let started = false;
    try {
      const result = await streamGemini(messages, tools, {
        ...options,
        assistantContent: options.provider === "gemini" ? (options.assistantContent as GeminiPart[] | undefined) : undefined,
        onToken: (token) => { if (token) started = true; options.onToken(token); }
      });
      if (result.text.trim() || result.toolCalls.length) return { ...result, provider: "gemini" as const, fallbackReason: undefined };
      fallbackReason = "empty";
    } catch (error) {
      if (started || options.signal?.aborted) throw error;
      fallbackReason = error instanceof GeminiRequestError ? `${error.status}:${error.reason}` : "stream_or_network";
      console.warn("[ai] Gemini unavailable before output; trying Groq", { reason: fallbackReason });
    }
  } else if (openaiReady() && options.provider !== "groq") {
    let started = false;
    try {
      const result = await streamOpenAI(messages, tools, {
        ...options,
        assistantContent: options.assistantContent as OpenAIItem[] | undefined,
        onToken: (token) => { if (token) started = true; options.onToken(token); }
      });
      if (result.text.trim() || result.toolCalls.length) return { ...result, assistantContent: result.assistantContent as Array<Record<string, unknown>>, provider: "openai" as const, fallbackReason: undefined };
      fallbackReason = "empty";
    } catch (error) {
      if (started || options.signal?.aborted) throw error;
      fallbackReason = error instanceof OpenAIRequestError ? `${error.status}:${error.reason}` : "stream_or_network";
      console.warn("[ai] OpenAI unavailable before output; trying Groq", { reason: fallbackReason });
    }
  }
  options.signal?.throwIfAborted();
  if (!groqReady()) throw new Error("No available AI provider is configured.");
  const lean = leanForGroq(messages);
  const result = tools.length && options.allowTools !== false
    ? await streamGroqWithTools(lean, tools, options)
    : { text: await streamGroq(lean, options), toolCalls: [] };
  return { ...result, provider: "groq" as const, assistantContent: undefined, model: groqModel(), fallbackReason };
}

const GROQ_HISTORY_BUDGET = 7_000;
const GROQ_MESSAGE_MAX = 2_000;
const GROQ_SYSTEM_MAX = 9_000;

/**
 * Groq limits tokens per minute, so a fallback call keeps only the most recent
 * conversation (about 7,000 characters, each earlier message clipped to 2,000).
 * Instructions, the newest user message and this turn's tool calls stay whole.
 */
export function leanForGroq(messages: GroqChatMessage[]): GroqChatMessage[] {
  const lastUser = messages.findLastIndex((message) => message.role === "user");
  if (lastUser <= 0) return messages;
  const keep = new Set<number>();
  let used = 0;
  for (let index = lastUser - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "system") continue;
    if (message.role === "tool" || (message.role === "assistant" && message.tool_calls?.length)) continue;
    const length = Math.min(message.content?.length || 0, GROQ_MESSAGE_MAX);
    if (used + length > GROQ_HISTORY_BUDGET && keep.size) break;
    used += length;
    keep.add(index);
  }
  return messages.flatMap((message, index) => {
    // Long attachments and project material are cut to what Groq can take.
    if (message.role === "system" && message.content.length > GROQ_SYSTEM_MAX && /^(Files the user attached|Project context:)/.test(message.content)) {
      return [{ ...message, content: `${message.content.slice(0, GROQ_SYSTEM_MAX)}...` }];
    }
    if (index >= lastUser || message.role === "system") return [message];
    if (!keep.has(index)) return [];
    const content = message.content || "";
    return [{ ...message, content: content.length > GROQ_MESSAGE_MAX ? `${content.slice(0, GROQ_MESSAGE_MAX)}...` : content } as GroqChatMessage];
  });
}

/**
 * Get a schema-validated object out of the model.
 *
 * Groq is asked to answer through a single forced tool call, so the payload is
 * structured at the transport level rather than parsed out of prose. The caller
 * supplies `validate`, which is the actual contract: a model can still return
 * arguments that satisfy the JSON schema loosely but are wrong for the caller's
 * purposes, so validation happens in code and a failure raises
 * StructuredOutputError rather than returning something half-formed. A
 * validation failure is NOT retried here; the caller decides its own policy.
 */
export async function completeStructured<T>(params: {
  system: string;
  user: string;
  tool: { name: string; description: string; schema: Record<string, unknown> };
  validate: (input: unknown) => T | null;
  temperature?: number;
  maxTokens?: number;
}): Promise<{ data: T; provider: AiProvider; usage: TokenUsage }> {
  if (!groqReady()) throw new Error("No AI provider is configured.");

  const result = await callGroqStructured(
    [
      { role: "system", content: params.system },
      { role: "user", content: params.user }
    ],
    { name: params.tool.name, description: params.tool.description, parameters: params.tool.schema },
    { temperature: params.temperature ?? 0.1 }
  );

  let raw: unknown = null;
  if (result.args) {
    try {
      raw = JSON.parse(result.args);
    } catch (error) {
      throw new StructuredOutputError(
        `Model returned arguments that are not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
        result.args,
        "groq"
      );
    }
  }

  const data = params.validate(raw);
  if (data === null) {
    throw new StructuredOutputError("Model output failed schema validation", raw, "groq");
  }

  return { data, provider: "groq", usage: result.usage };
}

/**
 * Plain completion. `background` work (memory extraction and the like) runs on
 * its own model first so it never uses up the main model's rate limit.
 */
export async function completeAi(
  messages: SimpleMessage[],
  options?: { temperature?: number; maxTokens?: number; background?: boolean }
): Promise<CompletionResult> {
  if (!groqReady()) throw new Error("No AI provider is configured.");
  const groq = await callGroq(messages, {
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
    models: options?.background ? [groqBackgroundModel(), groqModel(), groqFallbackModel()] : undefined
  });
  return {
    text: removeEmDashes(groq.text),
    provider: "groq",
    usage: groq.usage
  };
}

export async function streamAi(
  messages: GroqChatMessage[],
  options: StreamOptions
): Promise<CompletionResult> {
  const result = await streamChatWithTools(messages, options.tools || [], { ...options, allowTools: false });
  return {
    text: removeEmDashes(result.text),
    provider: result.provider,
    model: result.model,
    fallbackReason: result.fallbackReason,
    // Groq's streaming endpoint is not asked for usage, so nothing to report.
    usage: { ...NO_USAGE }
  };
}
