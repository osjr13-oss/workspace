import {
  callGroq,
  callGroqStructured,
  groqBackgroundModel,
  groqFallbackModel,
  groqModel,
  streamGroq,
  type GroqChatMessage
} from "@/lib/groq";
import { removeEmDashes } from "@/lib/text";

type SimpleMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AiProvider = "groq";

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

export function configuredAiModel() {
  return groqModel();
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
  options: { temperature?: number; maxTokens?: number; onToken: (token: string) => void }
): Promise<CompletionResult> {
  if (!groqReady()) throw new Error("No AI provider is configured.");
  return {
    text: removeEmDashes(
      await streamGroq(messages, {
        ...options,
        onToken: (token) => options.onToken(removeEmDashes(token))
      })
    ),
    provider: "groq",
    // Groq's streaming endpoint is not asked for usage, so nothing to report.
    usage: { ...NO_USAGE }
  };
}
