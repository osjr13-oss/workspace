import type { SupabaseClient } from "@supabase/supabase-js";
import { completeAi } from "@/lib/ai";
import { removeEmDashes } from "@/lib/text";

/**
 * The single path for creating flashcards.
 *
 * Flashcards were previously created in two unrelated places that had drifted
 * apart: the generate-from-source route (app/api/ai/flashcards) and the chat
 * tool (lib/ai-tools). Both hand-rolled card validation and card insertion. The
 * background Worker is the third caller, so the logic lives here once.
 *
 * Every function takes the caller's Supabase client. When that client is the
 * authenticated per-request client, row level security enforces ownership; the
 * explicit user_id on every write keeps service-role callers (the Worker)
 * correctly scoped too.
 */

export type FlashcardInput = { front: string; back: string };

export type FlashcardSource = {
  sourceType: "note" | "file";
  sourceId: string;
};

const MAX_SOURCE_CHARS = 12000;
const MAX_DECK_NAME_CHARS = 200;

/** Coerce arbitrary model output into cards, dropping anything unusable. */
export function normalizeCards(raw: unknown[]): FlashcardInput[] {
  return raw
    .filter((card): card is { front: unknown; back: unknown } => typeof card === "object" && card !== null)
    .map((card) => ({ front: String(card.front ?? "").trim(), back: String(card.back ?? "").trim() }))
    .filter((card) => card.front && card.back);
}

/**
 * Pull cards out of a model response shaped like {"cards":[...]}.
 *
 * This tolerates the model wrapping its JSON in prose by slicing between the
 * first { and the last }. Phase 1 replaces it with schema-validated structured
 * output.
 *
 * Note this deliberately does NOT run normalizeCards. The generate-from-source
 * route has always stored whatever strings the model produced, untrimmed and
 * uncoerced, and Phase 0 is a pure refactor. Routing it through normalizeCards
 * would silently start trimming whitespace and stringifying non-string values.
 * The only change is that a malformed `cards` value now yields an empty result
 * instead of throwing, which the caller already treats as "no usable cards".
 */
export function parseGeneratedCards(value: string): FlashcardInput[] {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start === -1 || end === -1) {
    console.error("[flashcards] model response contained no JSON object", { preview: value.slice(0, 200) });
    return [];
  }

  let parsed: { cards?: unknown };
  try {
    parsed = JSON.parse(value.slice(start, end + 1)) as { cards?: unknown };
  } catch (error) {
    console.error("[flashcards] model response was not valid JSON", {
      preview: value.slice(0, 200),
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }

  if (!Array.isArray(parsed.cards)) {
    console.error("[flashcards] model response had no cards array", { cards: typeof parsed.cards });
    return [];
  }

  const raw = parsed.cards as Array<{ front?: string; back?: string } | null>;
  const cards = raw
    .filter((card) => card && card.front && card.back)
    .map((card) => ({ front: card!.front as string, back: card!.back as string }));

  // Malformed entries used to throw and surface as a 500. They are dropped now,
  // so log the drop or a partially broken deck would be silently smaller.
  if (cards.length < raw.length) {
    console.error("[flashcards] dropped unusable cards from model output", {
      received: raw.length,
      kept: cards.length
    });
  }

  return cards;
}

/** Ask the model for a deck's worth of cards about some source material. */
export async function generateCardsFromText(sourceText: string): Promise<FlashcardInput[]> {
  const result = await completeAi([
    {
      role: "system",
      content:
        'Create 8 to 12 concise study flashcards. Never use an em dash. Return strict JSON only with this shape: {"cards":[{"front":"question","back":"answer"}]}.'
    },
    { role: "user", content: removeEmDashes(sourceText.slice(0, MAX_SOURCE_CHARS)) }
  ]);

  return parseGeneratedCards(result.text);
}

/** Read the text of a note or file the user owns. Returns "" when there is none. */
export async function loadSourceText(
  supabase: SupabaseClient,
  userId: string,
  sourceType: "note" | "file",
  sourceId: string
): Promise<string> {
  if (sourceType === "note") {
    const { data, error } = await supabase
      .from("notes")
      .select("title, content")
      .eq("id", sourceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data ? `${data.title}\n\n${data.content}` : "";
  }

  const { data, error } = await supabase
    .from("files")
    .select("name, extracted_text")
    .eq("id", sourceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.extracted_text ? `${data.name}\n\n${data.extracted_text}` : "";
}

/** Insert cards into an existing deck. Returns an error message, or null on success. */
export async function insertCards(
  supabase: SupabaseClient,
  params: {
    userId: string;
    deckId: string;
    projectId: string | null;
    cards: FlashcardInput[];
    source?: FlashcardSource;
  }
): Promise<string | null> {
  if (!params.cards.length) return null;

  // New cards are due immediately so they enter the study rotation right away.
  const dueAt = new Date().toISOString();
  const { error } = await supabase.from("flashcards").insert(
    params.cards.map((card) => ({
      user_id: params.userId,
      deck_id: params.deckId,
      project_id: params.projectId,
      front: card.front,
      back: card.back,
      ...(params.source ? { source_type: params.source.sourceType, source_id: params.source.sourceId } : {}),
      due_at: dueAt
    }))
  );

  return error ? error.message : null;
}

/**
 * Create a new deck and fill it with cards.
 *
 * Deck creation can legitimately fail on the free-plan deck cap, which is
 * enforced by a Postgres trigger, so the caller gets the message rather than an
 * exception.
 */
export async function createDeckWithCards(
  supabase: SupabaseClient,
  params: {
    userId: string;
    projectId: string | null;
    name: string;
    cards: FlashcardInput[];
    source?: FlashcardSource;
  }
): Promise<{ deckId: string; count: number } | { deckError: string } | { cardsError: string }> {
  const { data: deck, error: deckError } = await supabase
    .from("flashcard_decks")
    .insert({ user_id: params.userId, project_id: params.projectId, name: params.name.slice(0, MAX_DECK_NAME_CHARS) })
    .select("id")
    .single();

  if (deckError) return { deckError: deckError.message };

  const cardsError = await insertCards(supabase, {
    userId: params.userId,
    deckId: deck.id,
    projectId: params.projectId,
    cards: params.cards,
    source: params.source
  });

  if (cardsError) return { cardsError };
  return { deckId: deck.id, count: params.cards.length };
}
