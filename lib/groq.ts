import { requireEnv } from "@/lib/env";

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
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("GROQ_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: requireEnv("GROQ_MODEL"),
      messages,
      tools,
      tool_choice: "auto",
      temperature: options?.temperature ?? 0.4
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Groq tool request failed: ${detail}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: GroqAssistantMessage }>;
  };

  return payload.choices?.[0]?.message ?? { role: "assistant", content: "" };
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
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("GROQ_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: requireEnv("GROQ_MODEL"),
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
          full += token;
          options.onToken(token);
        }
      } catch {
        // ignore keep-alive lines and any non-JSON noise
      }
    }
  }

  return full.trim();
}

export async function callGroq(messages: GroqMessage[], options?: { temperature?: number }) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("GROQ_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: requireEnv("GROQ_MODEL"),
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
  };

  return payload.choices?.[0]?.message?.content?.trim() || "";
}
