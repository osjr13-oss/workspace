import { MAX_CONTEXT_CHARS, MAX_MESSAGE_CHARS, type Message } from "./release";
import { removeEmDashes } from "@/lib/text";
export function validateMessages(
  body: unknown,
): Pick<Message, "role" | "content">[] {
  const input = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(input) || !input.length || input.length > 200)
    throw new Error(
      "Start a new conversation. This chat has reached its supported length.",
    );
  let total = 0;
  const messages = input.map((item, index) => {
    if (
      !item ||
      typeof item.content !== "string" ||
      item.role !== (index % 2 === 0 ? "user" : "assistant") ||
      !item.content.trim()
    )
      throw new Error(
        "The conversation could not be read. Start a new chat or retry the last question.",
      );
    if (item.role === "user" && item.content.length > MAX_MESSAGE_CHARS)
      throw new Error("Keep each message under 8,000 characters.");
    total += item.content.length;
    return {
      role: item.role as Message["role"],
      content: removeEmDashes(item.content),
    };
  });
  if (total > MAX_CONTEXT_CHARS)
    throw new Error(
      "This conversation exceeds the 60,000-character context limit. Start a new chat; earlier decisions have not been silently dropped.",
    );
  if (messages.at(-1)?.role !== "user")
    throw new Error("A question is required.");
  return messages;
}
export function localRequestAllowed(
  request: Request,
  deployed = Boolean(process.env.VERCEL),
) {
  if (deployed) return false;
  const url = new URL(request.url);
  const host = request.headers.get("host") || url.host;
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return false;
  const origin = request.headers.get("origin");
  return (
    origin === `${url.protocol}//${host}` &&
    request.headers.get("sec-fetch-site") !== "cross-site"
  );
}
