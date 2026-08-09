import { callGroq, callGroqStructured, streamGroq, type GroqChatMessage } from "@/lib/groq";
import { removeEmDashes } from "@/lib/text";

export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";

type SimpleMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AiProvider = "anthropic" | "groq";

/**
 * Tokens billed for one model call. Previously discarded; the Worker needs it to
 * enforce a per-user daily token budget, so every path now reports it. Zero
 * means the provider did not return usage, not that the call was free.
 */
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

function anthropicReady() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function groqReady() {
  return Boolean(process.env.GROQ_API_KEY?.trim() && process.env.GROQ_MODEL?.trim());
}

export function configuredAiModel() {
  if (anthropicReady()) {
    return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
  }
  return process.env.GROQ_MODEL?.trim() || "groq";
}

function toAnthropicInput(messages: GroqChatMessage[] | SimpleMessage[]) {
  const systemParts: string[] = [];
  const conversation: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const message of messages) {
    if (message.role === "system") {
      systemParts.push(message.content);
      continue;
    }

    if (message.role === "tool") {
      systemParts.push(`Workspace tool result:\n${message.content}`);
      continue;
    }

    const content = typeof message.content === "string" ? message.content : "";
    if (!content.trim()) continue;

    const previous = conversation.at(-1);
    if (previous?.role === message.role) {
      previous.content += `\n\n${content}`;
    } else {
      conversation.push({ role: message.role, content });
    }
  }

  if (!conversation.length || conversation[0].role === "assistant") {
    conversation.unshift({ role: "user", content: "Continue." });
  }

  return {
    system: systemParts.join("\n\n"),
    messages: conversation
  };
}

async function callAnthropic(messages: GroqChatMessage[] | SimpleMessage[], temperature = 0.4) {
  const input = toAnthropicInput(messages);
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY?.trim() || ""
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 4096,
      temperature,
      system: input.system || undefined,
      messages: input.messages
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Anthropic request failed (${response.status}): ${detail}`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  return {
    text: removeEmDashes(
      (payload.content || [])
        .filter((block) => block.type === "text")
        .map((block) => block.text || "")
        .join("")
        .trim()
    ),
    usage: {
      inputTokens: payload.usage?.input_tokens ?? 0,
      outputTokens: payload.usage?.output_tokens ?? 0
    }
  };
}

async function streamAnthropic(
  messages: GroqChatMessage[],
  options: { temperature?: number; onToken: (token: string) => void }
) {
  const input = toAnthropicInput(messages);
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY?.trim() || ""
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 4096,
      temperature: options.temperature ?? 0.4,
      stream: true,
      system: input.system || undefined,
      messages: input.messages
    })
  });

  if (!response.ok || !response.body) {
    const detail = response.body ? await response.text() : "no response body";
    throw new Error(`Anthropic stream failed (${response.status}): ${detail}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      try {
        const event = JSON.parse(trimmed.slice(5).trim()) as {
          type?: string;
          delta?: { type?: string; text?: string };
          message?: { usage?: { input_tokens?: number; output_tokens?: number } };
          usage?: { input_tokens?: number; output_tokens?: number };
        };

        // Usage arrives outside the text deltas: input on message_start, output
        // on message_delta as the response completes.
        if (event.type === "message_start" && event.message?.usage) {
          usage.inputTokens = event.message.usage.input_tokens ?? 0;
          usage.outputTokens = event.message.usage.output_tokens ?? 0;
          continue;
        }
        if (event.type === "message_delta" && event.usage) {
          usage.outputTokens = event.usage.output_tokens ?? usage.outputTokens;
          continue;
        }

        if (event.type !== "content_block_delta" || event.delta?.type !== "text_delta" || !event.delta.text) {
          continue;
        }
        const token = removeEmDashes(event.delta.text);
        full += token;
        options.onToken(token);
      } catch {
        // Ignore keep-alive lines and incomplete event data.
      }
    }
  }

  return { text: full.trim(), usage };
}

/**
 * Ask Anthropic to answer by calling exactly one tool, so the reply arrives as a
 * validated object instead of prose that has to be scraped for JSON.
 */
async function structuredAnthropic(params: {
  system: string;
  user: string;
  tool: { name: string; description: string; schema: Record<string, unknown> };
  temperature: number;
  maxTokens: number;
}): Promise<{ input: unknown; usage: TokenUsage }> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY?.trim() || ""
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
      system: params.system || undefined,
      messages: [{ role: "user", content: params.user }],
      tools: [
        {
          name: params.tool.name,
          description: params.tool.description,
          input_schema: params.tool.schema
        }
      ],
      // Forcing this specific tool is what makes the response structured.
      tool_choice: { type: "tool", name: params.tool.name }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Anthropic structured request failed (${response.status}): ${detail}`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; name?: string; input?: unknown }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  const block = (payload.content || []).find(
    (entry) => entry.type === "tool_use" && entry.name === params.tool.name
  );

  return {
    input: block?.input ?? null,
    usage: {
      inputTokens: payload.usage?.input_tokens ?? 0,
      outputTokens: payload.usage?.output_tokens ?? 0
    }
  };
}

/**
 * Get a schema-validated object out of the model.
 *
 * Both providers are asked to answer through a single forced tool call, so the
 * payload is structured at the transport level rather than parsed out of prose.
 * The caller supplies `validate`, which is the actual contract: a model can
 * still return arguments that satisfy the JSON schema loosely but are wrong for
 * the caller's purposes, so validation happens in code and a failure raises
 * StructuredOutputError rather than returning something half-formed.
 *
 * Provider fallback matches the rest of this module: Anthropic first, Groq only
 * if Anthropic errored outright. A validation failure is NOT retried here; the
 * caller decides its own retry policy.
 */
export async function completeStructured<T>(params: {
  system: string;
  user: string;
  tool: { name: string; description: string; schema: Record<string, unknown> };
  validate: (input: unknown) => T | null;
  temperature?: number;
  maxTokens?: number;
}): Promise<{ data: T; provider: AiProvider; usage: TokenUsage }> {
  const temperature = params.temperature ?? 0.1;
  const maxTokens = params.maxTokens ?? 4096;
  let provider: AiProvider = "anthropic";
  let raw: unknown = null;
  let usage: TokenUsage = { ...NO_USAGE };

  if (anthropicReady()) {
    try {
      const result = await structuredAnthropic({ ...params, temperature, maxTokens });
      raw = result.input;
      usage = result.usage;
    } catch (error) {
      if (!groqReady()) throw error;
      console.error("[ai] Anthropic structured call failed, using Groq fallback", error);
      provider = "groq";
    }
  } else {
    provider = "groq";
  }

  if (provider === "groq") {
    if (!groqReady()) throw new Error("No AI provider is configured.");
    const result = await callGroqStructured(
      [
        { role: "system", content: params.system },
        { role: "user", content: params.user }
      ],
      { name: params.tool.name, description: params.tool.description, parameters: params.tool.schema },
      { temperature }
    );
    usage = result.usage;
    if (result.args) {
      try {
        raw = JSON.parse(result.args);
      } catch (error) {
        throw new StructuredOutputError(
          `Model returned arguments that are not valid JSON: ${
            error instanceof Error ? error.message : String(error)
          }`,
          result.args,
          provider
        );
      }
    }
  }

  const data = params.validate(raw);
  if (data === null) {
    throw new StructuredOutputError("Model output failed schema validation", raw, provider);
  }

  return { data, provider, usage };
}

export async function completeAi(
  messages: SimpleMessage[],
  options?: { temperature?: number }
): Promise<CompletionResult> {
  if (anthropicReady()) {
    try {
      const result = await callAnthropic(messages, options?.temperature);
      return { text: result.text, provider: "anthropic", usage: result.usage };
    } catch (error) {
      if (!groqReady()) throw error;
      console.error("[ai] Anthropic completion failed, using Groq fallback", error);
    }
  }

  if (!groqReady()) throw new Error("No AI provider is configured.");
  const groq = await callGroq(messages, options);
  return {
    text: removeEmDashes(groq.text),
    provider: "groq",
    usage: groq.usage
  };
}

export async function streamAi(
  messages: GroqChatMessage[],
  options: { temperature?: number; onToken: (token: string) => void }
): Promise<CompletionResult> {
  if (anthropicReady()) {
    let emitted = false;
    try {
      const result = await streamAnthropic(messages, {
        ...options,
        onToken: (token) => {
          emitted = true;
          options.onToken(token);
        }
      });
      return { text: result.text, provider: "anthropic", usage: result.usage };
    } catch (error) {
      if (emitted || !groqReady()) throw error;
      console.error("[ai] Anthropic stream failed, using Groq fallback", error);
    }
  }

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
