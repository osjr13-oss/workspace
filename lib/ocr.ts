import { DEFAULT_ANTHROPIC_MODEL } from "@/lib/ai";
import { removeEmDashes } from "@/lib/text";

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"] as const;

const IMAGE_MEDIA_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif"
};

// Anthropic rejects request bodies over 32MB; base64 adds roughly a third.
const MAX_OCR_BYTES = 22 * 1024 * 1024;

const OCR_PROMPT =
  "Transcribe all readable text from this document exactly as written, in reading order. " +
  "Keep headings, lists, and tables as plain text. Do not summarize, explain, or add commentary. " +
  "If there is no readable text, reply with an empty response.";

export function ocrAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function imageMediaType(extension: string) {
  return IMAGE_MEDIA_TYPES[extension] || null;
}

/** Transcribes a scanned PDF or an image with Claude vision. Returns "" when nothing is readable. */
export async function transcribeWithVision(bytes: Buffer, kind: "pdf" | "image", mediaType: string): Promise<string> {
  if (!ocrAvailable()) throw new Error("Scanned documents and images are not available right now.");
  if (bytes.length > MAX_OCR_BYTES) throw new Error("This scanned file is too large to read. Try a smaller file or fewer pages.");

  const source = { type: "base64", media_type: mediaType, data: bytes.toString("base64") };
  const fileBlock = kind === "pdf" ? { type: "document", source } : { type: "image", source };

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY?.trim() || ""
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 16000,
      temperature: 0,
      messages: [{ role: "user", content: [fileBlock, { type: "text", text: OCR_PROMPT }] }]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Could not read the scanned file (${response.status}): ${detail.slice(0, 200)}`);
  }

  const payload = (await response.json()) as { content?: Array<{ type?: string; text?: string }> };
  const text = (payload.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text || "")
    .join("")
    .trim();
  return removeEmDashes(text);
}
