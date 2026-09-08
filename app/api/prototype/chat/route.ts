import { streamGroq } from "@/lib/groq";
import { RELEASE } from "@/lib/prototype/release";
import {
  validateMessages,
  localRequestAllowed,
} from "@/lib/prototype/validation";
import { readSecurityRequest } from "@/lib/security/request";
import { removeEmDashes } from "@/lib/text";
export const runtime = "nodejs";
export const maxDuration = 60;
let active = false;
export async function POST(request: Request) {
  if (!localRequestAllowed(request))
    return Response.json(
      { error: "This prototype accepts same-origin localhost requests only." },
      { status: 403 },
    );
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return Response.json({ error: "JSON is required." }, { status: 415 });
  let messages;
  try {
    messages = validateMessages(await readSecurityRequest(request, 260000));
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Invalid conversation.",
      },
      { status: 400 },
    );
  }
  if (!process.env.GROQ_API_KEY?.trim())
    return Response.json(
      {
        error:
          "The local Groq key is missing. Add it to this checkout's .env.local and restart.",
      },
      { status: 503 },
    );
  if (active)
    return Response.json(
      { error: "Another response is still running. Please retry in a moment." },
      { status: 429 },
    );
  active = true;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 45000);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) =>
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      try {
        send({ type: "release", release: RELEASE.id });
        const text = await streamGroq(
          [{ role: "system", content: RELEASE.system }, ...messages],
          {
            model: RELEASE.model,
            reasoningEffort: RELEASE.reasoningEffort,
            temperature: RELEASE.temperature,
            maxTokens: RELEASE.maxTokens,
            signal: AbortSignal.any([abort.signal, request.signal]),
            onToken: (token) =>
              send({ type: "token", text: removeEmDashes(token) }),
          },
        );
        if (!text.trim()) throw new Error("empty");
        send({ type: "done" });
      } catch {
        try {
          send({
            type: "error",
            error:
              "Selrano could not complete this response. Your question is saved in this browser. Retry when you are ready.",
          });
        } catch {
          /* disconnected */
        }
      } finally {
        clearTimeout(timer);
        active = false;
        try {
          controller.close();
        } catch {
          /* disconnected */
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
