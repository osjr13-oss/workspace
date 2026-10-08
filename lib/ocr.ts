import { requireEnv } from "@/lib/env";
import { removeEmDashes } from "@/lib/text";

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"] as const;

const IMAGE_MEDIA_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif"
};

// Groq limits base64 image requests to 4MB, and base64 adds roughly a third.
const MAX_IMAGE_BYTES = 2.8 * 1024 * 1024;

export const DEFAULT_GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const OCR_PROMPT =
  "Transcribe all readable text from this image exactly as written, in reading order. " +
  "Keep headings, lists, and tables as plain text. Do not summarize, explain, or add commentary. " +
  "If there is no readable text, reply with an empty response.";

export function imageMediaType(extension: string) {
  return IMAGE_MEDIA_TYPES[extension] || null;
}

/** Reads the text in a photo or screenshot with a Groq vision model. Returns "" when nothing is readable. */
export async function transcribeImage(bytes: Buffer, mediaType: string): Promise<string> {
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new Error("This image is too large to read. Try a smaller photo or a cropped screenshot (under 2.5MB).");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("GROQ_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.GROQ_VISION_MODEL?.trim() || DEFAULT_GROQ_VISION_MODEL,
      temperature: 0,
      max_completion_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: OCR_PROMPT },
            { type: "image_url", image_url: { url: `data:${mediaType};base64,${bytes.toString("base64")}` } }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Could not read the image (${response.status}): ${detail.slice(0, 200)}`);
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return removeEmDashes(payload.choices?.[0]?.message?.content?.trim() || "");
}
