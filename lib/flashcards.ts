import type { SupabaseClient } from "@supabase/supabase-js";
import { completeStructured, type TokenUsage } from "@/lib/ai";
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

/** JSON schema the model must fill in when generating a deck. */
const FLASHCARD_TOOL_SCHEMA = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      description: "The flashcards, 8 to 12 of them.",
      items: {
        type: "object",
        properties: {
          front: { type: "string", description: "The question or prompt side." },
          back: { type: "string", description: "The answer side." }
        },
        required: ["front", "back"]
      }
    }
  },
  required: ["cards"]
} as const;

/**
 * Validate the model's tool arguments.
 *
 * The JSON schema is a request, not a guarantee, so the shape is checked in code
 * before anything reaches the database. Returning null signals a schema failure
 * to completeStructured; returning cards means every entry has a usable front
 * and back.
 */
export function validateGeneratedCards(input: unknown): FlashcardInput[] | null {
  if (!input || typeof input !== "object") return null;
  const cards = (input as { cards?: unknown }).cards;
  if (!Array.isArray(cards)) return null;

  const usable = normalizeCards(cards);
  if (!usable.length) return null;

  if (usable.length < cards.length) {
    console.error("[flashcards] dropped unusable cards from model output", {
      received: cards.length,
      kept: usable.length
    });
  }

  return usable;
}

/**
 * Ask the model for a deck's worth of cards about some source material.
 *
 * Uses forced tool use, so the cards arrive as structured arguments. The old
 * path asked for "strict JSON only" in the prompt and then scraped the response
 * between the first { and the last }, which broke whenever the model wrapped its
 * answer in prose.
 */
export async function generateCardsFromText(
  sourceText: string
): Promise<{ cards: FlashcardInput[]; usage: TokenUsage }> {
  const result = await completeStructured({
    system:
      "Create 8 to 12 concise study flashcards from the user's material. Each card needs a self-contained question and a correct, specific answer. Never use an em dash.",
    user: removeEmDashes(sourceText.slice(0, MAX_SOURCE_CHARS)),
    tool: {
      name: "create_flashcards",
      description: "Return the generated study flashcards.",
      schema: FLASHCARD_TOOL_SCHEMA as unknown as Record<string, unknown>
    },
    validate: validateGeneratedCards
  });

  return { cards: result.data, usage: result.usage };
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
