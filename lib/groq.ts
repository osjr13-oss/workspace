import { requireEnv } from "@/lib/env";
import { removeEmDashes } from "@/lib/text";

const GROQ_URL = `${process.env.GROQ_BASE_URL?.trim() || "https://api.groq.com/openai/v1"}/chat/completions`;

export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

/** Model ids Groq has shut down. A stale GROQ_MODEL pointing at one of these falls back to the default. */
const SHUT_DOWN_MODELS = new Set([
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "qwen/qwen3-32b",
  "qwen/qwen3.6-27b"
]);

/** The one chat model. Override with GROQ_MODEL; otherwise a fast default is used. */
export function groqModel() {
  const configured = process.env.GROQ_MODEL?.trim();
  if (!configured) return DEFAULT_GROQ_MODEL;
  if (SHUT_DOWN_MODELS.has(configured)) {
    console.warn(`[groq] GROQ_MODEL "${configured}" has been shut down by Groq; using ${DEFAULT_GROQ_MODEL}.`);
    return DEFAULT_GROQ_MODEL;
  }
  return configured;
}

/**
 * Model plus per-model request options. gpt-oss models reason before answering,
 * so reasoning is set to low and hidden to keep time-to-first-word short.
 */
function modelParams() {
  const model = groqModel();
  return model.startsWith("openai/gpt-oss") ? { model, reasoning_effort: "low", include_reasoning: false } : { model };
}

type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type GroqToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

/** Message shape used during a tool-calling loop (superset of GroqMessage). */
export type GroqChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: GroqToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type GroqAssistantMessage = { role: "assistant"; content: string | null; tool_calls?: GroqToolCall[] };

/**
 * Call Groq with a set of tools the model may invoke. Returns the raw assistant
 * message, which either contains `tool_calls` (the model wants to run a tool) or
 * `content` (its final text answer). The caller runs the tool loop.
 */
export async function callGroqWithTools(
  messages: GroqChatMessage[],
  tools: unknown[],
  options?: { temperature?: number }
): Promise<GroqAssistantMessage> {
  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("GROQ_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...modelParams(),
      messages,
      tools,
      tool_choice: "auto",
      temperature: options?.temperature ?? 0.4
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    const recovered = recoverMalformedToolCall(detail);
    if (recovered) return recovered;
    throw new Error(`Groq tool request failed: ${detail}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: GroqAssistantMessage }>;
  };

  return payload.choices?.[0]?.message ?? { role: "assistant", content: "" };
}

/**
 * llama-3.3-70b-versatile occasionally emits a tool call as inline text like
 * `<function=web_search {"query": "..."}>` instead of structured JSON. Groq's
 * API rejects this itself (code "tool_use_failed") before we see real
 * `tool_calls`, but the rejected text still carries a well-formed call, so we
 * parse it out rather than losing the tool call entirely.
 */
function recoverMalformedToolCall(errorBody: string): GroqAssistantMessage | null {
  let parsed: { error?: { code?: string; failed_generation?: string } };
  try {
    parsed = JSON.parse(errorBody);
  } catch {
    return null;
  }

  const failedGeneration = parsed.error?.failed_generation;
  if (parsed.error?.code !== "tool_use_failed" || !failedGeneration) return null;

  const match = failedGeneration.match(/<function=([a-zA-Z_]\w*)\s*(\{[\s\S]*?\})/);
  if (!match) return null;

  const [, name, argsJson] = match;
  try {
    JSON.parse(argsJson);
  } catch {
    return null;
  }

  return {
    role: "assistant",
    content: null,
    tool_calls: [{ id: `recovered_${Date.now()}`, type: "function", function: { name, arguments: argsJson } }]
  };
}

/**
 * One streaming request that may either answer or call tools.
 *
 * Text tokens are forwarded to `onToken` the moment they arrive, so a normal
 * answer starts streaming immediately with no separate "decide on tools" round
 * trip. If the model instead emits tool calls, they are accumulated from the
 * stream and returned for the caller to run.
 */
export async function streamGroqWithTools(
  messages: GroqChatMessage[],
  tools: unknown[],
  options: { temperature?: number; onToken: (token: string) => void }
): Promise<{ text: string; toolCalls: GroqToolCall[] }> {
  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("GROQ_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...modelParams(),
      messages,
      tools,
      tool_choice: "auto",
      temperature: options.temperature ?? 0.5,
      stream: true
    })
  });

  if (!response.ok || !response.body) {
    const detail = response.body ? await response.text() : "no response body";
    const recovered = recoverMalformedToolCall(detail);
    if (recovered?.tool_calls) return { text: "", toolCalls: recovered.tool_calls };
    throw new Error(`Groq stream failed: ${detail}`);
  }

  const pending = new Map<number, { id: string; name: string; args: string }>();
  let full = "";

  await readSse(response.body, (data) => {
    const json = JSON.parse(data) as {
      error?: unknown;
      choices?: Array<{
        delta?: {
          content?: string | null;
          tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>;
        };
      }>;
    };

    if (json.error) {
      const recovered = recoverMalformedToolCall(JSON.stringify({ error: json.error }));
      if (recovered?.tool_calls) {
        recovered.tool_calls.forEach((call, index) =>
          pending.set(100 + index, { id: call.id, name: call.function.name, args: call.function.arguments })
        );
        return;
      }
      throw new Error(`Groq stream error: ${JSON.stringify(json.error)}`);
    }

    const delta = json.choices?.[0]?.delta;
    if (!delta) return;

    if (delta.content) {
      const token = removeEmDashes(delta.content);
      full += token;
      options.onToken(token);
    }

    for (const call of delta.tool_calls || []) {
      const index = call.index ?? 0;
      const entry = pending.get(index) || { id: "", name: "", args: "" };
      if (call.id) entry.id = call.id;
      if (call.function?.name) entry.name += call.function.name;
      if (call.function?.arguments) entry.args += call.function.arguments;
      pending.set(index, entry);
    }
  });

  const toolCalls: GroqToolCall[] = [...pending.entries()]
    .sort((a, b) => a[0] - b[0])
    .filter(([, entry]) => entry.name)
    .map(([index, entry]) => ({
      id: entry.id || `call_${Date.now()}_${index}`,
      type: "function" as const,
      function: { name: entry.name, arguments: entry.args || "{}" }
    }));

  return { text: full.trim(), toolCalls };
}

/** Reads a server-sent-events body and hands each `data:` payload to `onData`. Non-JSON noise is skipped. */
async function readSse(body: ReadableStream<Uint8Array>, onData: (data: string) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // keep the last, possibly-partial line for the next chunk

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        JSON.parse(data);
      } catch {
        continue; // keep-alive lines and any non-JSON noise
      }
      onData(data);
    }
  }
}

/**
 * Stream a Groq chat completion token-by-token.
 *
 * Calls `onToken` for each piece of text as it arrives and resolves with the
 * full concatenated answer once the stream completes. Used by the chat route so
 * the UI can render the reply progressively instead of waiting for the whole thing.
 */
export async function streamGroq(
  messages: GroqChatMessage[],
  options: { temperature?: number; onToken: (token: string) => void }
): Promise<string> {
  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("GROQ_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...modelParams(),
      messages,
      temperature: options.temperature ?? 0.4,
      stream: true
    })
  });

  if (!response.ok || !response.body) {
    const detail = response.body ? await response.text() : "no response body";
    throw new Error(`Groq stream failed: ${detail}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // keep the last, possibly-partial line for the next chunk

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;

      try {
        const json = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
        const token = json.choices?.[0]?.delta?.content;
        if (token) {
          const normalized = removeEmDashes(token);
          full += normalized;
          options.onToken(normalized);
        }
      } catch {
        // ignore keep-alive lines and any non-JSON noise
      }
    }
  }

  return full.trim();
}

/**
 * Force Groq to answer by calling exactly one named tool, so the reply arrives
 * as structured arguments instead of prose that has to be scraped for JSON.
 *
 * Returns the raw argument string plus token usage. The caller parses and
 * validates it; a model can still emit arguments that do not satisfy the schema.
 */
export async function callGroqStructured(
  messages: GroqMessage[],
  tool: { name: string; description: string; parameters: Record<string, unknown> },
  options?: { temperature?: number }
): Promise<{ args: string | null; usage: { inputTokens: number; outputTokens: number } }> {
  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("GROQ_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...modelParams(),
      messages,
      tools: [{ type: "function", function: tool }],
      tool_choice: { type: "function", function: { name: tool.name } },
      temperature: options?.temperature ?? 0.1
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Groq structured request failed: ${detail}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: GroqAssistantMessage }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const call = payload.choices?.[0]?.message?.tool_calls?.find((entry) => entry.function?.name === tool.name);
  return {
    args: call?.function?.arguments ?? null,
    usage: {
      inputTokens: payload.usage?.prompt_tokens ?? 0,
      outputTokens: payload.usage?.completion_tokens ?? 0
    }
  };
}

export async function callGroq(
  messages: GroqMessage[],
  options?: { temperature?: number }
): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number } }> {
  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("GROQ_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...modelParams(),
      messages,
      temperature: options?.temperature ?? 0.4
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Groq request failed: ${detail}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  return {
    text: removeEmDashes(payload.choices?.[0]?.message?.content?.trim() || ""),
    usage: {
      inputTokens: payload.usage?.prompt_tokens ?? 0,
      outputTokens: payload.usage?.completion_tokens ?? 0
    }
  };
}
