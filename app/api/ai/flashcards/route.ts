import { NextResponse } from "next/server";
import { reserveAiRequest } from "@/lib/ai-usage";
import { configuredAiModel, StructuredOutputError } from "@/lib/ai";
import { generateCardsFromText, insertCards, loadSourceText } from "@/lib/flashcards";
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
      model: configuredAiModel(),
      input_chars: sourceText.length
    });
    if (limitError) return NextResponse.json({ error: limitError }, { status: 429 });

    let cards;
    try {
      ({ cards } = await generateCardsFromText(sourceText));
    } catch (error) {
      if (error instanceof StructuredOutputError) {
        console.error("[flashcards] structured output rejected", {
          provider: error.provider,
          raw: JSON.stringify(error.raw)?.slice(0, 500)
        });
        return NextResponse.json({ error: "Model did not return usable cards" }, { status: 500 });
      }
      throw error;
    }

    const insertError = await insertCards(supabase, {
      userId: user.id,
      deckId: body.deckId,
      projectId: deck.project_id,
      cards,
      source: { sourceType: body.sourceType, sourceId: body.sourceId }
    });
    if (insertError) throw new Error(insertError);

    return NextResponse.json({ cards: cards.length });
  } catch (error) {
    const message = serializeError(error);
    console.error("[flashcards]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
