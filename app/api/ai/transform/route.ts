import { NextResponse } from "next/server";
import { callGroq } from "@/lib/groq";
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
    const { user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Transform failed" }, { status: 500 });
  }
}
