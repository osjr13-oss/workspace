import { requireEnv } from "@/lib/env";

export function getWhisperModel() {
  return process.env.GROQ_WHISPER_MODEL || "whisper-large-v3-turbo";
}

export async function transcribeAudio(buffer: Buffer, mimeType: string, filename = "recording.webm") {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeType || "audio/webm" });
  form.append("file", blob, filename);
  form.append("model", getWhisperModel());
  form.append("language", "en");
  form.append("response_format", "json");
  form.append("temperature", "0");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 240_000);

  let response: Response;
  try {
    response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requireEnv("GROQ_API_KEY")}`
      },
      body: form,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Groq Whisper timed out. Try a shorter recording.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Groq Whisper failed: ${detail}`);
  }

  const payload = (await response.json()) as { text?: string };
  const text = payload.text?.trim() || "";
  if (!text) throw new Error("Transcription returned empty text");
  return text;
}
