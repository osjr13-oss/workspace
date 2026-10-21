import { generateGemini } from "@/lib/gemini";
import { removeEmDashes } from "@/lib/text";

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"] as const;

const IMAGE_MEDIA_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif"
};

// Keep the existing upload size limit to bound request size.
const MAX_IMAGE_BYTES = 2.8 * 1024 * 1024;


const OCR_PROMPT =
  "Transcribe all readable text from this image exactly as written, in reading order. " +
  "Keep headings, lists, and tables as plain text. Do not summarize, explain, or add commentary. " +
  "If there is no readable text, reply with an empty response.";

export function imageMediaType(extension: string) {
  return IMAGE_MEDIA_TYPES[extension] || null;
}

/** Reads text in an uploaded image with Gemini. */
export async function transcribeImage(bytes: Buffer, mediaType: string): Promise<string> {
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error("This image is too large to read. Try a smaller photo or a cropped screenshot (under 2.5MB).");
  const result = await generateGemini([{ role: "user", content: OCR_PROMPT }], {
    temperature: 0, image: { mimeType: mediaType, data: bytes.toString("base64") }
  });
  return removeEmDashes(result.text.trim());
}
