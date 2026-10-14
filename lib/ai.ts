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
import { anthropicModel, anthropicReady, ClaudeRequestError, streamAnthropic, type ClaudeBlock } from "@/lib/anthropic";

type SimpleMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AiProvider = "groq" | "anthropic";

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
  return chat && anthropicReady() ? anthropicModel() : groqModel();
}

type StreamOptions = {
  temperature?: number;
  maxTokens?: number;
  onToken: (token: string) => void;
  onToolCallStart?: () => void;
  provider?: AiProvider;
  assistantContent?: ClaudeBlock[];
  tools?: Parameters<typeof streamAnthropic>[1];
  allowTools?: boolean;
};

/** Fall back only before text starts, so two providers never splice answers together. */
export async function streamChatWithTools(
  messages: GroqChatMessage[],
  tools: Parameters<typeof streamAnthropic>[1],
  options: StreamOptions
) {
  let fallbackReason: string | undefined;
  if (anthropicReady() && options.provider !== "groq") {
    let started = false;
    try {
      const result = await streamAnthropic(messages, tools, {
        ...options,
        onToken: (token) => { if (token) started = true; options.onToken(token); }
      });
      if (result.text.trim() || result.toolCalls.length) return { ...result, provider: "anthropic" as const, fallbackReason: undefined };
      fallbackReason = "empty";
    } catch (error) {
      if (started) throw error;
      fallbackReason = error instanceof ClaudeRequestError ? `${error.status}:${error.reason}` : "stream_or_network";
      console.warn("[ai] Claude unavailable before output; trying Groq", { reason: fallbackReason });
    }
  }
  if (!groqReady()) throw new Error("No available AI provider is configured.");
  const result = tools.length && options.allowTools !== false
    ? await streamGroqWithTools(messages, tools, options)
    : { text: await streamGroq(messages, options), toolCalls: [] };
  return { ...result, provider: "groq" as const, assistantContent: undefined, model: groqModel(), fallbackReason };
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
