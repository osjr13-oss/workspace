import { requireEnv } from "@/lib/env";

type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

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
