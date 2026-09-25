import type { SupabaseClient } from "@supabase/supabase-js";
import type { Artifact, Citation } from "@/lib/types";
import { webSearch } from "@/lib/web-search";

export const toolDefinitions = [
  {
    type: "function" as const,
    function: {
      name: "web_search",
      description:
        "Search the live web. Use this for news, prices, releases, and anything that may have changed. If the tool says search is off, tell the person that. Do not invent sources.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "What to search for." }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "create_note",
      description: "Save a note when the person asks you to write, draft, or save one.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short title." },
          content: { type: "string", description: "Note body in Markdown." }
        },
        required: ["title", "content"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "create_flashcards",
      description: "Create a flashcard deck when the person asks for flashcards.",
      parameters: {
        type: "object",
        properties: {
          deck_name: { type: "string" },
          cards: {
            type: "array",
            items: {
              type: "object",
              properties: {
                front: { type: "string" },
                back: { type: "string" }
              },
              required: ["front", "back"]
            }
          }
        },
        required: ["deck_name", "cards"]
      }
    }
  }
];

export type ToolContext = {
  supabase: SupabaseClient;
  userId: string;
  threadId: string;
  artifacts: Artifact[];
  webCitations: Record<string, Citation>;
};

export function normalizeCards(raw: unknown[]) {
  const cards: Array<{ front: string; back: string }> = [];
  for (const card of raw) {
    if (!card || typeof card !== "object") continue;
    const front = String((card as { front?: unknown }).front ?? "").trim();
    const back = String((card as { back?: unknown }).back ?? "").trim();
    if (!front || !back) continue;
    cards.push({ front: front.slice(0, 500), back: back.slice(0, 2000) });
    if (cards.length >= 40) break;
  }
  return cards;
}

export async function executeTool(name: string, args: Record<string, unknown>, ctx: ToolContext) {
  switch (name) {
    case "web_search":
      return runWebSearch(ctx, String(args.query ?? ""));
    case "create_note":
      return createNote(ctx, String(args.title ?? "Untitled note"), String(args.content ?? ""));
    case "create_flashcards":
      return createFlashcards(ctx, String(args.deck_name ?? "New deck"), Array.isArray(args.cards) ? args.cards : []);
    default:
      return `Unknown tool: ${name}`;
  }
}

async function runWebSearch(ctx: ToolContext, query: string) {
  const trimmed = query.trim();
  if (!trimmed) return "No search query was provided.";
  const outcome = await webSearch(trimmed);
  if (outcome.status === "off") {
    if (!ctx.artifacts.some((item) => item.type === "search_off")) {
      ctx.artifacts.push({ type: "search_off" });
    }
    return "Search is off. TAVILY_API_KEY is not configured. Say that plainly. Do not invent web sources.";
  }
  if (outcome.status === "error") {
    return `Web search failed: ${outcome.message}`;
  }
  if (!outcome.results.length) return "No web results were found for that search.";
  return outcome.results
    .map((result) => {
      const marker = String(Object.keys(ctx.webCitations).length + 1);
      ctx.webCitations[marker] = {
        kind: "web",
        marker,
        title: result.title,
        url: result.url,
        snippet: result.snippet
      };
      return `[${marker}] ${result.title}\nURL: ${result.url}\n${result.snippet}`;
    })
    .join("\n\n");
}

async function createNote(ctx: ToolContext, title: string, content: string) {
  const cleanTitle = title.trim().slice(0, 200) || "Untitled note";
  const { data, error } = await ctx.supabase
    .from("notes")
    .insert({
      user_id: ctx.userId,
      thread_id: ctx.threadId,
      title: cleanTitle,
      content: content.slice(0, 20000)
    })
    .select("id, title")
    .single();
  if (error || !data) return `Could not create the note: ${error?.message || "unknown error"}`;
  ctx.artifacts.push({ type: "note", id: data.id, title: data.title });
  return `Created note "${data.title}". Open it at /notes/${data.id}`;
}

async function createFlashcards(ctx: ToolContext, deckName: string, rawCards: unknown[]) {
  const cards = normalizeCards(rawCards);
  if (!cards.length) return "No valid flashcards were provided. Each card needs a front and a back.";
  const name = deckName.trim().slice(0, 200) || "New deck";
  const { data: deck, error } = await ctx.supabase
    .from("flashcard_decks")
    .insert({ user_id: ctx.userId, thread_id: ctx.threadId, name })
    .select("id, name")
    .single();
  if (error || !deck) return `Could not create the deck: ${error?.message || "unknown error"}`;
  const { error: cardsError } = await ctx.supabase.from("flashcards").insert(
    cards.map((card) => ({
      user_id: ctx.userId,
      deck_id: deck.id,
      front: card.front,
      back: card.back
    }))
  );
  if (cardsError) return `Created the deck, but adding cards failed: ${cardsError.message}`;
  ctx.artifacts.push({ type: "deck", id: deck.id, name: deck.name, count: cards.length });
  return `Created deck "${deck.name}" with ${cards.length} flashcards. Open it at /flashcards/${deck.id}`;
}
