import { requireEnv } from "@/lib/env";
import { removeEmDashes } from "@/lib/text";

export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
/** Used when the main model is rate limited. Groq limits are per model, so this has its own allowance. */
export const DEFAULT_GROQ_FALLBACK_MODEL = "openai/gpt-oss-20b";

/** Model ids Groq has shut down. A stale env value pointing at one of these falls back to the default. */
const SHUT_DOWN_MODELS = new Set([
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "qwen/qwen3-32b",
  "qwen/qwen3.6-27b"
]);

function resolveModel(name: string, fallback: string) {
  const configured = process.env[name]?.trim();
  if (!configured) return fallback;
  if (SHUT_DOWN_MODELS.has(configured)) {
    console.warn(`[groq] ${name} "${configured}" has been shut down by Groq; using ${fallback}.`);
    return fallback;
  }
  return configured;
}

/** The main chat model. Override with GROQ_MODEL. */
export function groqModel() {
  return resolveModel("GROQ_MODEL", DEFAULT_GROQ_MODEL);
}

/** Second model used when the main one is rate limited or unavailable. Override with GROQ_FALLBACK_MODEL. */
export function groqFallbackModel() {
  return resolveModel("GROQ_FALLBACK_MODEL", DEFAULT_GROQ_FALLBACK_MODEL);
}

/** Model for background work (memory extraction), kept off the main model's rate limit. */
export function groqBackgroundModel() {
  return resolveModel("GROQ_BACKGROUND_MODEL", groqFallbackModel());
}

function groqUrl() {
  return `${process.env.GROQ_BASE_URL?.trim() || "https://api.groq.com/openai/v1"}/chat/completions`;
}

/**
 * Per-model request options. gpt-oss models reason before answering, so
 * reasoning is set to low and hidden to keep time-to-first-word short.
 */
function modelParams(model: string) {
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

/** A non-success answer from Groq, with the wait it asked for when rate limiting. */
export class GroqHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    readonly retryAfterMs: number | null
  ) {
    super(`Groq request failed (${status}): ${body.slice(0, 400)}`);
    this.name = "GroqHttpError";
  }

  get rateLimited() {
    return this.status === 429;
  }
}

const MAX_RETRY_WAIT_MS = 9000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Reads the wait Groq asks for, from the retry-after header or the "try again in 6.1s" message. */
function parseRetryAfter(response: Response, body: string): number | null {
  const header = Number(response.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return Math.round(header * 1000);

  const match = body.match(/try again in (?:(\d+)m)?\s*([\d.]+)(ms|s)/i);
  if (!match) return null;
  const minutes = match[1] ? Number(match[1]) : 0;
  const amount = Number(match[2]);
  return Math.round(minutes * 60_000 + (match[3].toLowerCase() === "ms" ? amount : amount * 1000));
}

function modelUnavailable(status: number, body: string) {
  return status === 404 || (status === 400 && /decommission|not found|does not exist|no longer supported/i.test(body));
}

/**
 * Sends one chat completion request, riding out the failures that are not the
 * caller's fault: when a model is rate limited or gone, the next model is tried
 * straight away (limits are per model); if every model is rate limited the
 * shortest requested wait is honored once. Other errors (a malformed tool call,
 * a bad request) are thrown for the caller to handle.
 */
async function groqRequest(
  buildBody: (model: string) => Record<string, unknown>,
  options: { models?: string[] } = {}
): Promise<Response> {
  const models = Array.from(new Set(options.models ?? [groqModel(), groqFallbackModel()]));
  let lastError: unknown = null;

  for (let round = 0; round < 2; round += 1) {
    let shortestWait: number | null = null;

    for (const model of models) {
      let response: Response;
      try {
        response = await fetch(groqUrl(), {
          method: "POST",
          headers: { Authorization: `Bearer ${requireEnv("GROQ_API_KEY")}`, "Content-Type": "application/json" },
          body: JSON.stringify({ ...modelParams(model), ...buildBody(model) })
        });
      } catch (error) {
        lastError = error; // network blip: move on to the next model or round
        continue;
      }

      if (response.ok && response.body) return response;

      const body = await response.text().catch(() => "");
      const error = new GroqHttpError(response.status, body, parseRetryAfter(response, body));
      lastError = error;

      if (error.rateLimited || response.status >= 500) {
        if (error.retryAfterMs !== null) {
          shortestWait = shortestWait === null ? error.retryAfterMs : Math.min(shortestWait, error.retryAfterMs);
        }
        console.warn(`[groq] ${model} unavailable (${response.status}); trying the next option`);
        continue;
      }
      if (modelUnavailable(response.status, body)) {
        console.warn(`[groq] ${model} is not available (${response.status}); trying the next option`);
        continue;
      }
      throw error; // a real request problem, not a capacity one
    }

    if (round === 0 && shortestWait !== null && shortestWait <= MAX_RETRY_WAIT_MS) {
      await sleep(shortestWait + 150);
      continue;
    }
    break;
  }

  throw lastError ?? new Error("Groq request failed.");
}

/**
 * A model can emit a tool call as text instead of structured JSON, which Groq
 * rejects as `tool_use_failed`. The rejected text still carries a well-formed
 * call, so parse it out rather than losing the call entirely. Handles
 * `<function=name {...}>` and a JSON object with a name and arguments.
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

  let name: string | null = null;
  let argsJson: string | null = null;

  const tagged = failedGeneration.match(/<function=([a-zA-Z_]\w*)\s*(\{[\s\S]*?\})/);
  if (tagged) {
    name = tagged[1];
    argsJson = tagged[2];
  } else {
    try {
      const object = JSON.parse(failedGeneration) as { name?: string; arguments?: unknown; parameters?: unknown };
      const args = object.arguments ?? object.parameters;
      if (typeof object.name === "string" && args !== undefined) {
        name = object.name;
        argsJson = typeof args === "string" ? args : JSON.stringify(args);
      }
    } catch {
      return null;
    }
  }

  if (!name || !argsJson) return null;
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

/** Reads a server-sent-events body and hands each JSON `data:` payload to `onData`. Noise is skipped. */
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
 * One streaming request that may either answer or call tools.
 *
 * Text tokens are forwarded to `onToken` the moment they arrive, so a normal
 * answer starts streaming immediately with no separate "decide on tools" round
 * trip. If the model instead emits tool calls, they are accumulated from the
 * stream and returned for the caller to run; `onToolCallStart` fires as soon as
 * the first one begins so the caller can react before the stream ends.
 */
export async function streamGroqWithTools(
  messages: GroqChatMessage[],
  tools: unknown[],
  options: { temperature?: number; maxTokens?: number; onToken: (token: string) => void; onToolCallStart?: () => void }
): Promise<{ text: string; toolCalls: GroqToolCall[] }> {
  let response: Response;
  try {
    response = await groqRequest(() => ({
      messages,
      tools,
      tool_choice: "auto",
      temperature: options.temperature ?? 0.5,
      max_completion_tokens: options.maxTokens ?? 3072,
      stream: true
    }));
  } catch (error) {
    const recovered = error instanceof GroqHttpError ? recoverMalformedToolCall(error.body) : null;
    if (recovered?.tool_calls) {
      options.onToolCallStart?.();
      return { text: "", toolCalls: recovered.tool_calls };
    }
    throw error;
  }

  const pending = new Map<number, { id: string; name: string; args: string }>();
  let full = "";
  let announced = false;
  const announce = () => {
    if (announced) return;
    announced = true;
    options.onToolCallStart?.();
  };

  await readSse(response.body!, (data) => {
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
        announce();
        recovered.tool_calls.forEach((call, index) =>
          pending.set(100 + index, { id: call.id, name: call.function.name, args: call.function.arguments })
        );
        return;
      }
      throw new Error(`Groq stream error: ${JSON.stringify(json.error)}`);
    }

    const delta = json.choices?.[0]?.delta;
    if (!delta) return;

    if (delta.tool_calls?.length) announce();

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

/**
 * Stream a Groq chat completion token-by-token.
 *
 * Calls `onToken` for each piece of text as it arrives and resolves with the
 * full concatenated answer once the stream completes.
 */
export async function streamGroq(
  messages: GroqChatMessage[],
  options: { temperature?: number; maxTokens?: number; onToken: (token: string) => void }
): Promise<string> {
  const response = await groqRequest(() => ({
    messages,
    temperature: options.temperature ?? 0.4,
    max_completion_tokens: options.maxTokens ?? 3072,
    stream: true
  }));

  let full = "";
  await readSse(response.body!, (data) => {
    const json = JSON.parse(data) as { error?: unknown; choices?: Array<{ delta?: { content?: string | null } }> };
    if (json.error) throw new Error(`Groq stream error: ${JSON.stringify(json.error)}`);
    const token = json.choices?.[0]?.delta?.content;
    if (token) {
      const normalized = removeEmDashes(token);
      full += normalized;
      options.onToken(normalized);
    }
  });

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
  options?: { temperature?: number; maxTokens?: number }
): Promise<{ args: string | null; usage: { inputTokens: number; outputTokens: number } }> {
  const response = await groqRequest(() => ({
    messages,
    tools: [{ type: "function", function: tool }],
    tool_choice: { type: "function", function: { name: tool.name } },
    temperature: options?.temperature ?? 0.1,
    max_completion_tokens: options?.maxTokens ?? 4096
  }));

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
  options?: { temperature?: number; maxTokens?: number; models?: string[] }
): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number } }> {
  const response = await groqRequest(
    () => ({
      messages,
      temperature: options?.temperature ?? 0.4,
      max_completion_tokens: options?.maxTokens ?? 2048
    }),
    { models: options?.models }
  );

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
