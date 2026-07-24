import { callGroq, streamGroq, type GroqChatMessage } from "@/lib/groq";
import { removeEmDashes } from "@/lib/text";

export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";

type SimpleMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AiProvider = "anthropic" | "groq";

type CompletionResult = {
  text: string;
  provider: AiProvider;
};

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
  };
  return removeEmDashes(
    (payload.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text || "")
      .join("")
      .trim()
  );
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
        };
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

  return full.trim();
}

export async function completeAi(
  messages: SimpleMessage[],
  options?: { temperature?: number }
): Promise<CompletionResult> {
  if (anthropicReady()) {
    try {
      return {
        text: await callAnthropic(messages, options?.temperature),
        provider: "anthropic"
      };
    } catch (error) {
      if (!groqReady()) throw error;
      console.error("[ai] Anthropic completion failed, using Groq fallback", error);
    }
  }

  if (!groqReady()) throw new Error("No AI provider is configured.");
  return {
    text: removeEmDashes(await callGroq(messages, options)),
    provider: "groq"
  };
}

export async function streamAi(
  messages: GroqChatMessage[],
  options: { temperature?: number; onToken: (token: string) => void }
): Promise<CompletionResult> {
  if (anthropicReady()) {
    let emitted = false;
    try {
      return {
        text: await streamAnthropic(messages, {
          ...options,
          onToken: (token) => {
            emitted = true;
            options.onToken(token);
          }
        }),
        provider: "anthropic"
      };
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
    provider: "groq"
  };
}
