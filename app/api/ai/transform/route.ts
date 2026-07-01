import { NextResponse } from "next/server";
import { assertWithinLimit, recordUsage } from "@/lib/ai-usage";
import { callGroq } from "@/lib/groq";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

const allowedActions = new Set([
  "Rewrite",
  "Summarize",
  "Expand",
  "Sharpen",
  "Turn into outline",
  "Turn into bullet points",
  "Turn into study notes",
  "Turn into email"
]);

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limitError = await assertWithinLimit(supabase, user.id);
    if (limitError) return NextResponse.json({ error: limitError }, { status: 429 });

    const body = (await request.json()) as { action?: string; text?: string };
    if (!body.text?.trim()) return NextResponse.json({ error: "Text is required" }, { status: 400 });
    if (!body.action || !allowedActions.has(body.action)) return NextResponse.json({ error: "Unsupported action" }, { status: 400 });

    const result = await callGroq([
      {
        role: "system",
        content:
          "You are Selrano, a calm academic workspace assistant. Transform the user's text exactly as requested. Preserve meaning, avoid hype, and return only the transformed content."
      },
      {
        role: "user",
        content: `Action: ${body.action}\n\nText:\n${body.text}`
      }
    ]);

    await recordUsage(supabase, user.id, "transform", {
      model: process.env.GROQ_MODEL || "groq",
      input_chars: body.text.length
    });

    return NextResponse.json({ result });
  } catch (error) {
    const message = serializeError(error);
    console.error("[transform]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
