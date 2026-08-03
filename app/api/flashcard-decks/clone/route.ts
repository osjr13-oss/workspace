import { NextResponse } from "next/server";
import { serializeError } from "@/lib/serialize-error";
import { assertDeckLimit } from "@/lib/tier";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as { slug?: string };
    const slug = body.slug?.trim();
    if (!slug) return NextResponse.json({ error: "Deck slug is required" }, { status: 400 });

    const { data: sourceDeck, error: deckError } = await supabase
      .from("flashcard_decks")
      .select("id, name, user_id, is_public, share_slug")
      .eq("share_slug", slug)
      .eq("is_public", true)
      .maybeSingle();

    if (deckError) throw deckError;
    if (!sourceDeck) {
      return NextResponse.json({ error: "This shared deck was not found or is no longer public." }, { status: 404 });
    }

    if (sourceDeck.user_id === user.id) {
      return NextResponse.json(
        { error: "This deck is already in your workspace.", code: "own_deck", deckId: sourceDeck.id },
        { status: 409 }
      );
    }

    const limitError = await assertDeckLimit(supabase, user.id);
    if (limitError) return NextResponse.json({ error: limitError, code: "plan_limit", reason: "decks" }, { status: 403 });

    const { data: sourceCards, error: cardsError } = await supabase
      .from("flashcards")
      .select("front, back")
      .eq("deck_id", sourceDeck.id)
      .order("created_at", { ascending: true });

    if (cardsError) throw cardsError;

    const { data: deck, error: insertDeckError } = await supabase
      .from("flashcard_decks")
      .insert({
        user_id: user.id,
        name: sourceDeck.name,
        project_id: null,
        is_public: false,
        share_slug: null
      })
      .select("*")
      .single();

    if (insertDeckError) throw insertDeckError;

    const cards = sourceCards || [];
    if (cards.length) {
      const dueAt = new Date().toISOString();
      const { error: insertCardsError } = await supabase.from("flashcards").insert(
        cards.map((card) => ({
          user_id: user.id,
          deck_id: deck.id,
          project_id: null,
          front: card.front,
          back: card.back,
          source_type: null,
          source_id: null,
          due_at: dueAt
        }))
      );
      if (insertCardsError) {
        await supabase.from("flashcard_decks").delete().eq("id", deck.id).eq("user_id", user.id);
        throw insertCardsError;
      }
    }

    return NextResponse.json({ deck, cards: cards.length });
  } catch (error) {
    const message = serializeError(error);
    console.error("[flashcard-decks/clone]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
