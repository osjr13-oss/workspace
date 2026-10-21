import { requireEnv } from "@/lib/env";
import type { GroqChatMessage, GroqToolCall } from "@/lib/groq";
import { removeEmDashes } from "@/lib/text";

/** One item of an OpenAI Responses API input or output (message, reasoning, function call). */
export type OpenAIItem = Record<string, unknown> & { type: string };
type Tool = { type: string; function: { name: string; description: string; parameters: Record<string, unknown> } };
export type OpenAIContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail?: "low" | "high" | "auto" };

export class OpenAIRequestError extends Error {
  constructor(readonly status: number, readonly reason: string) {
    super(`OpenAI request failed (${status}, ${reason})`);
    this.name = "OpenAIRequestError";
  }
}

export function openaiReady() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/** The coach and anything the user waits on. */
export function openaiModel() {
  return process.env.OPENAI_MODEL?.trim() || "gpt-6.1-sol";
}

function endpoint() {
  return `${(process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "")}/responses`;
}

function headers() {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`
  };
}

/**
 * Optional reasoning effort. Left unset, the model's default applies; set
 * OPENAI_REASONING_EFFORT (for example "low") to trade depth for speed.
 */
function reasoning() {
  const effort = process.env.OPENAI_REASONING_EFFORT?.trim();
  return effort ? { reasoning: { effort } } : {};
}

function convertMessages(messages: GroqChatMessage[], assistantItems?: OpenAIItem[]) {
  const instructions: string[] = [];
  const input: OpenAIItem[] = [];
  const lastToolAssistant = messages.findLastIndex((message) => message.role === "assistant" && message.tool_calls?.length);
  messages.forEach((message, index) => {
    if (message.role === "system") {
      instructions.push(message.content);
    } else if (message.role === "tool") {
      input.push({ type: "function_call_output", call_id: message.tool_call_id, output: message.content });
    } else if (message.role === "assistant" && index === lastToolAssistant && assistantItems) {
      // Reasoning and function-call items go back verbatim so the model can continue.
      input.push(...assistantItems);
    } else if (message.role === "assistant") {
      if (message.content) input.push({ type: "message", role: "assistant", content: message.content });
      for (const call of message.tool_calls || []) {
        input.push({ type: "function_call", call_id: call.id, name: call.function.name, arguments: call.function.arguments || "{}" });
      }
    } else if (message.content) {
      input.push({ type: "message", role: "user", content: message.content });
    }
  });
  return { instructions: instructions.join("\n\n"), input };
}

async function failure(response: Response) {
  // Never log a provider response body: it can echo private prompts.
  const payload = await response.json().catch(() => null);
  const code = String(payload?.error?.code || payload?.error?.type || "");
  const message = String(payload?.error?.message || "");
  const reason =
    /insufficient_quota|billing/i.test(code + message) ? "billing"
      : response.status === 429 ? "rate_limit"
        : /model/i.test(code + message) ? "model"
          : response.status === 401 || /api.key|authentication/i.test(message) ? "authentication"
            : "provider";
  return new OpenAIRequestError(response.status, reason);
}

/** Read a Responses API event stream, one parsed event at a time. */
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

/**
 * Stream text and tool calls. Nothing is stored at OpenAI (`store: false`);
 * reasoning comes back encrypted and is kept only in memory for the next call.
 */
export async function streamOpenAI(
  messages: GroqChatMessage[],
  tools: Tool[],
  options: { signal?: AbortSignal; maxTokens?: number; onToken: (token: string) => void; onToolCallStart?: () => void; assistantContent?: OpenAIItem[]; allowTools?: boolean }
): Promise<{ text: string; toolCalls: GroqToolCall[]; assistantContent: OpenAIItem[]; model: string }> {
  const controller = new AbortController();
  const firstOutputTimeout = setTimeout(() => controller.abort(), 25_000);
  const totalTimeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(endpoint(), {
      method: "POST",
      headers: headers(),
      signal: options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal,
      body: JSON.stringify({
        model: openaiModel(),
        ...convertMessages(messages, options.assistantContent),
        max_output_tokens: options.maxTokens ?? 4096,
        stream: true,
        store: false,
        include: ["reasoning.encrypted_content"],
        ...reasoning(),
        ...(tools.length ? {
          tools: tools.map(({ function: tool }) => ({ type: "function", name: tool.name, description: tool.description, parameters: tool.parameters, strict: false })),
          tool_choice: options.allowTools === false ? "none" : "auto",
          parallel_tool_calls: false
        } : {})
      })
    });
    if (!response.ok) throw await failure(response);
    if (!response.body) throw new Error("OpenAI returned no stream");

    const items = new Map<number, OpenAIItem>();
    const argumentsByIndex = new Map<number, string>();
    let text = "";
    let completed = false;
    let model = openaiModel();
    await readEvents(response.body, (event) => {
      switch (event.type) {
        case "response.created":
          if (typeof event.response?.model === "string") model = event.response.model;
          break;
        case "response.output_item.added":
          items.set(event.output_index, { ...event.item });
          if (event.item?.type === "function_call") {
            clearTimeout(firstOutputTimeout);
            options.onToolCallStart?.();
          }
          break;
        case "response.output_text.delta": {
          clearTimeout(firstOutputTimeout);
          const token = removeEmDashes(String(event.delta || ""));
          text += token;
          options.onToken(token);
          break;
        }
        case "response.function_call_arguments.delta":
          argumentsByIndex.set(event.output_index, (argumentsByIndex.get(event.output_index) || "") + String(event.delta || ""));
          break;
        case "response.output_item.done":
          items.set(event.output_index, { ...event.item });
          break;
        case "response.completed":
          completed = true;
          if (typeof event.response?.model === "string") model = event.response.model;
          break;
        case "response.failed":
        case "response.incomplete":
        case "error":
          throw new Error(`OpenAI stream ${event.type}`);
      }
    });
    if (!completed) throw new Error("OpenAI stream ended before completion");

    const assistantContent = [...items.entries()].sort(([a], [b]) => a - b).map(([index, item]) => {
      if (item.type === "function_call" && !item.arguments) item.arguments = argumentsByIndex.get(index) || "{}";
      return item;
    });
    const toolCalls: GroqToolCall[] = assistantContent
      .filter((item) => item.type === "function_call")
      .map((item) => ({ id: String(item.call_id), type: "function", function: { name: String(item.name), arguments: String(item.arguments || "{}") } }));
    // Only reasoning and calls need replaying; the visible text is already in history.
    return { text, toolCalls, assistantContent: assistantContent.filter((item) => item.type !== "message"), model };
  } finally {
    clearTimeout(firstOutputTimeout);
    clearTimeout(totalTimeout);
  }
}
