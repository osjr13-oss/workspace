import { requireEnv } from "@/lib/env";
import type { GroqChatMessage, GroqToolCall } from "@/lib/groq";
import { removeEmDashes } from "@/lib/text";

export type ClaudeBlock = Record<string, unknown> & { type: string };
type ClaudeMessage = { role: "user" | "assistant"; content: ClaudeBlock[] };
type Tool = { type: string; function: { name: string; description: string; parameters: Record<string, unknown> } };

export function anthropicReady() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function anthropicModel() {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-haiku-5-5";
}

function convertMessages(messages: GroqChatMessage[], assistantContent?: ClaudeBlock[]) {
  const system: string[] = [];
  const converted: ClaudeMessage[] = [];
  const lastToolAssistant = messages.findLastIndex((message) => message.role === "assistant" && message.tool_calls?.length);
  messages.forEach((message, index) => {
    if (message.role === "system") {
      system.push(message.content);
      return;
    }
    const role = message.role === "assistant" ? "assistant" : "user";
    let content: ClaudeBlock[];
    if (message.role === "tool") {
      content = [{ type: "tool_result", tool_use_id: message.tool_call_id, content: message.content }];
    } else if (message.role === "assistant" && index === lastToolAssistant && assistantContent) {
      // Preserve signed thinking and tool blocks verbatim for Claude's continuation.
      content = assistantContent;
    } else {
      content = message.content ? [{ type: "text", text: message.content }] : [];
      if (message.role === "assistant") {
        for (const call of message.tool_calls || []) {
          content.push({ type: "tool_use", id: call.id, name: call.function.name, input: JSON.parse(call.function.arguments) });
        }
      }
    }
    if (!content.length) return;
    const previous = converted.at(-1);
    if (previous?.role === role) previous.content.push(...content);
    else converted.push({ role, content });
  });
  return { system: system.join("\n\n"), messages: converted };
}

/** Stream text and tools, retaining thinking only in memory for the next model call. */
export async function streamAnthropic(
  messages: GroqChatMessage[],
  tools: Tool[],
  options: { maxTokens?: number; onToken: (token: string) => void; onToolCallStart?: () => void; assistantContent?: ClaudeBlock[]; allowTools?: boolean }
): Promise<{ text: string; toolCalls: GroqToolCall[]; assistantContent: ClaudeBlock[] }> {
  const controller = new AbortController();
  const firstOutputTimeout = setTimeout(() => controller.abort(), 25_000);
  const totalTimeout = setTimeout(() => controller.abort(), 120_000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch(`${process.env.ANTHROPIC_BASE_URL?.trim() || "https://api.anthropic.com"}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": requireEnv("ANTHROPIC_API_KEY"),
        "anthropic-version": "2023-06-01",
        ...(process.env.ANTHROPIC_WORKSPACE_ID?.trim()
          ? { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID.trim() }
          : {})
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: anthropicModel(),
        ...convertMessages(messages, options.assistantContent),
        max_tokens: options.maxTokens ?? 4096,
        stream: true,
        ...(tools.length ? {
          tools: tools.map(({ function: tool }) => ({ name: tool.name, description: tool.description, input_schema: tool.parameters })),
          tool_choice: options.allowTools === false ? { type: "none" } : { type: "auto", disable_parallel_tool_use: true }
        } : {})
      })
    });
    // Never log a provider response body: it can echo private prompts.
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Claude request failed (${response.status})`);
    }
    if (!response.body) throw new Error("Claude returned no stream");
    reader = response.body.getReader();
    const decoder = new TextDecoder();
    const blocks = new Map<number, ClaudeBlock>();
    const toolInputs = new Map<number, string>();
    let buffer = "";
    let text = "";
    let stopped = false;
    const handle = (line: string) => {
      if (!line.startsWith("data:")) return;
      const event = JSON.parse(line.slice(5).trim());
      if (event.type === "error") throw new Error("Claude stream failed");
      if (event.type === "message_stop") stopped = true;
      if (event.type === "content_block_start") {
        const block = event.content_block as ClaudeBlock;
        blocks.set(event.index, { ...block });
        if (block.type === "tool_use") {
          clearTimeout(firstOutputTimeout);
          options.onToolCallStart?.();
        }
      }
      if (event.type !== "content_block_delta") return;
      const block = blocks.get(event.index);
      if (!block) throw new Error("Claude returned an invalid content block");
      const delta = event.delta;
      if (delta.type === "text_delta") {
        clearTimeout(firstOutputTimeout);
        const token = removeEmDashes(delta.text);
        block.text = String(block.text || "") + token;
        text += token;
        options.onToken(token);
      } else if (delta.type === "input_json_delta") {
        toolInputs.set(event.index, (toolInputs.get(event.index) || "") + delta.partial_json);
      } else if (delta.type === "thinking_delta") {
        block.thinking = String(block.thinking || "") + delta.thinking;
      } else if (delta.type === "signature_delta") {
        block.signature = String(block.signature || "") + delta.signature;
      }
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) handle(line.trim());
    }
    buffer += decoder.decode();
    if (buffer.trim()) handle(buffer.trim());
    if (!stopped) throw new Error("Claude stream ended before completion");
    const toolCalls: GroqToolCall[] = [];
    const assistantContent = [...blocks.entries()].sort(([a], [b]) => a - b).map(([index, block]) => {
      if (block.type === "tool_use") {
        const args = toolInputs.get(index);
        if (args) block.input = JSON.parse(args);
        toolCalls.push({ id: String(block.id), type: "function", function: { name: String(block.name), arguments: JSON.stringify(block.input || {}) } });
      }
      return block;
    });
    return { text, toolCalls, assistantContent };
  } finally {
    clearTimeout(firstOutputTimeout);
    clearTimeout(totalTimeout);
    await reader?.cancel().catch(() => undefined);
  }
}
