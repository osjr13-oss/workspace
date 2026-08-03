import { NextResponse } from "next/server";
import { reserveAiRequest } from "@/lib/ai-usage";
import { completeAi, configuredAiModel } from "@/lib/ai";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { removeEmDashes } from "@/lib/text";

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

    const body = (await request.json()) as { action?: string; text?: string };
    const sourceText = removeEmDashes(body.text || "").trim();
    if (!sourceText) return NextResponse.json({ error: "Text is required" }, { status: 400 });
    if (!body.action || !allowedActions.has(body.action)) return NextResponse.json({ error: "Unsupported action" }, { status: 400 });

    const limitError = await reserveAiRequest(supabase, user.id, "transform", {
      model: configuredAiModel(),
      input_chars: sourceText.length
    });
    if (limitError) return NextResponse.json({ error: limitError, code: "plan_limit", reason: "ai_limit" }, { status: 429 });

    const result = await completeAi([
      {
        role: "system",
        content:
          "You are Selrano, an adaptive AI workspace assistant. Transform the user's text exactly as requested. Preserve meaning, avoid hype, never use an em dash, and return only the transformed content."
      },
      {
        role: "user",
        content: `Action: ${body.action}\n\nText:\n${sourceText}`
      }
    ]);

    return NextResponse.json({ result: removeEmDashes(result.text), provider: result.provider });
  } catch (error) {
    const message = serializeError(error);
    console.error("[transform]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
