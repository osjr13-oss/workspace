import { NextResponse } from "next/server";
import { reserveAiRequest } from "@/lib/ai-usage";
import { callGroq } from "@/lib/groq";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as {
      deckId?: string;
      sourceType?: "note" | "file";
      sourceId?: string;
      projectId?: string | null;
    };
    if (!body.deckId || !body.sourceType || !body.sourceId) {
      return NextResponse.json({ error: "deckId, sourceType, and sourceId are required" }, { status: 400 });
    }

    if (!(["note", "file"] as const).includes(body.sourceType)) {
      return NextResponse.json({ error: "Unsupported source type" }, { status: 400 });
    }

    const { data: deck, error: deckError } = await supabase
      .from("flashcard_decks")
      .select("id, project_id")
      .eq("id", body.deckId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (deckError) throw deckError;
    if (!deck) return NextResponse.json({ error: "Flashcard deck not found" }, { status: 404 });

    const sourceText = await loadSourceText(supabase, user.id, body.sourceType, body.sourceId);
    if (!sourceText) return NextResponse.json({ error: "No source text found" }, { status: 400 });

    const limitError = await reserveAiRequest(supabase, user.id, "flashcards", {
      model: process.env.GROQ_MODEL || "groq",
      input_chars: sourceText.length
    });
    if (limitError) return NextResponse.json({ error: limitError }, { status: 429 });

    const result = await callGroq([
      {
        role: "system",
        content:
          'Create 8 to 12 concise study flashcards. Return strict JSON only with this shape: {"cards":[{"front":"question","back":"answer"}]}.'
      },
      { role: "user", content: sourceText.slice(0, 12000) }
    ]);

    const parsed = parseCards(result);
    if (!parsed.length) return NextResponse.json({ error: "Model did not return usable cards" }, { status: 500 });

    const dueAt = new Date().toISOString();
    const { error } = await supabase.from("flashcards").insert(
      parsed.map((card) => ({
        user_id: user.id,
        deck_id: body.deckId,
        project_id: deck.project_id,
        front: card.front,
        back: card.back,
        source_type: body.sourceType,
        source_id: body.sourceId,
        due_at: dueAt
      }))
    );
    if (error) throw error;

    return NextResponse.json({ cards: parsed.length });
  } catch (error) {
    const message = serializeError(error);
    console.error("[flashcards]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function loadSourceText(
  supabase: Awaited<ReturnType<typeof getAuthenticatedUser>>["supabase"],
  userId: string,
  sourceType: "note" | "file",
  sourceId: string
) {
  if (sourceType === "note") {
    const { data, error } = await supabase.from("notes").select("title, content").eq("id", sourceId).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data ? `${data.title}\n\n${data.content}` : "";
  }

  const { data, error } = await supabase.from("files").select("name, extracted_text").eq("id", sourceId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data?.extracted_text ? `${data.name}\n\n${data.extracted_text}` : "";
}

function parseCards(value: string) {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start === -1 || end === -1) return [];
  const parsed = JSON.parse(value.slice(start, end + 1)) as { cards?: Array<{ front?: string; back?: string }> };
  return (parsed.cards || []).filter((card) => card.front && card.back).map((card) => ({ front: card.front!, back: card.back! }));
}
