import { isIP } from "node:net";
import { removeEmDashes } from "@/lib/text";

/** Only public HTTPS links may be rendered as source citations. Never fetch them. */
export function publicSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.port || !host.includes(".") ||
        isIP(host.replace(/^\[|\]$/g, "")) || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host)) return null;
    url.hash = "";
    return url.href;
  } catch { return null; }
}

/** Queries contain public subject terms, never conversation dumps or credentials. */
export function publicSearchQuery(query: string): string | null {
  const text = removeEmDashes(query).trim();
  if (!text || text.length > 300 || /[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:AIza[\w-]+|sk-|gsk_|tvly-|sb_secret_|gh[pousr]_|Bearer\s)|\b\d{3}-\d{2}-\d{4}\b/i.test(text)) return null;
  return text;
}
