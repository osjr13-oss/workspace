import type { SupabaseClient } from "@supabase/supabase-js";
import { callGroq } from "@/lib/groq";

export function parseFlashcardJson(value: string) {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start === -1 || end === -1) return [];
  const parsed = JSON.parse(value.slice(start, end + 1)) as { cards?: Array<{ front?: string; back?: string }> };
  return (parsed.cards || [])
    .filter((card) => card.front && card.back)
    .map((card) => ({ front: card.front!, back: card.back! }));
}

export async function generateFlashcardsFromText(sourceText: string) {
  const result = await callGroq([
    {
      role: "system",
      content:
        'Create 8 to 12 concise brief cards for an independent consultant. Capture client facts, decisions, risks, action items, open questions, and useful reusable context. Return strict JSON only with this shape: {"cards":[{"front":"short prompt or label","back":"client-ready detail"}]}.'
    },
    { role: "user", content: sourceText.slice(0, 12000) }
  ]);

  const parsed = parseFlashcardJson(result);
  if (!parsed.length) throw new Error("Model did not return usable cards");
  return parsed;
}

export async function insertFlashcards(params: {
  supabase: SupabaseClient;
  userId: string;
  deckId: string;
  projectId: string | null;
  sourceType: string;
  sourceId: string;
  cards: Array<{ front: string; back: string }>;
}) {
  const dueAt = new Date().toISOString();
  const { error } = await params.supabase.from("flashcards").insert(
    params.cards.map((card) => ({
      user_id: params.userId,
      deck_id: params.deckId,
      project_id: params.projectId,
      front: card.front,
      back: card.back,
      source_type: params.sourceType,
      source_id: params.sourceId,
      due_at: dueAt
    }))
  );
  if (error) throw error;
  return params.cards.length;
}
