import { requireEnv } from "@/lib/env";
import { removeEmDashes } from "@/lib/text";

export type GroqToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type GroqChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: GroqToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type GroqAssistantMessage = {
  role: "assistant";
  content: string | null;
  tool_calls?: GroqToolCall[];
};

type GroqTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

function groqHeaders() {
  return {
    Authorization: `Bearer ${requireEnv("GROQ_API_KEY")}`,
    "Content-Type": "application/json"
  };
}

export async function callGroqWithTools(
  model: string,
  messages: GroqChatMessage[],
  tools: GroqTool[],
  signal?: AbortSignal
): Promise<GroqAssistantMessage> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: groqHeaders(),
    signal,
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.4
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

export async function openGroqStream(model: string, messages: GroqChatMessage[], signal?: AbortSignal) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: groqHeaders(),
    signal,
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
      stream: true
    })
  });
  if (!response.ok || !response.body) {
    const detail = response.body ? await response.text() : "Groq returned an empty response.";
    throw new Error(`Groq request failed: ${detail}`);
  }
  return response;
}

export async function readGroqStream(
  response: Response,
  onToken: (token: string) => void,
  signal?: AbortSignal
) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
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
            onToken(normalized);
          }
        } catch {
          // Ignore keep-alive lines.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return full.trim();
}
