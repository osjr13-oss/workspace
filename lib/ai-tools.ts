import type { SupabaseClient } from "@supabase/supabase-js";
import { searchChunksFullText } from "@/lib/retrieve-context";
import { webSearch } from "@/lib/web-search";
import type { Citation } from "@/lib/types";

/**
 * Tools the chat AI can invoke for explicit workspace action requests.
 *
 * Every tool runs through the caller's authenticated Supabase client, so row-level
 * security and ownership triggers guarantee a user can only ever read or write
 * their own data. The model cannot reach anyone else's workspace.
 */
export const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "search_workspace",
      description:
        "Search the user's own notes and uploaded files for relevant text. Use when the user asks about their materials or you need facts from their documents before answering.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "What to look for, in plain words." }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the live web for current, real-time, or recent information. Use this whenever you are not confident your training data is current enough to answer well: news, prices, recent releases, current events, or anything about people, products, or facts that may have changed since your training cutoff.",
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
    type: "function",
    function: {
      name: "create_note",
      description: "Create a new note in the user's workspace. Use only when the user clearly asks you to write, draft, or save a note.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short title for the note." },
          content: { type: "string", description: "The note body, in Markdown." }
        },
        required: ["title", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_flashcards",
      description: "Create a new flashcard deck with cards. Use only when the user clearly asks for flashcards or study cards.",
      parameters: {
        type: "object",
        properties: {
          deck_name: { type: "string", description: "Name for the new deck." },
          cards: {
            type: "array",
            description: "The flashcards to create.",
            items: {
              type: "object",
              properties: {
                front: { type: "string", description: "Question or prompt side." },
                back: { type: "string", description: "Answer side." }
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
  projectId: string | null;
  // Web search results need numbered citation markers, shared across calls so
  // markers stay unique alongside any project-context citations already assigned.
  webCitations: Record<string, Citation>;
  citationOffset: number;
};

/** Run a single tool call and return a short text result for the model to read. */
export async function executeTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  switch (name) {
    case "search_workspace":
      return searchWorkspace(ctx, String(args.query ?? ""));
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

async function runWebSearch(ctx: ToolContext, query: string): Promise<string> {
  const trimmed = query.trim();
  if (!trimmed) return "No search query was provided.";

  const results = await webSearch(trimmed);
  if (!results.length) return "No current web results were found for that search.";

  return results
    .map((result) => {
      const marker = String(ctx.citationOffset + Object.keys(ctx.webCitations).length + 1);
      ctx.webCitations[marker] = { kind: "web", marker, title: result.title, url: result.url, snippet: result.snippet };
      return `[${marker}] ${result.title}\nURL: ${result.url}\n${result.snippet}`;
    })
    .join("\n\n");
}

async function searchWorkspace(ctx: ToolContext, query: string): Promise<string> {
  const trimmed = query.trim();
  if (!trimmed) return "No search query was provided.";

  const like = `%${trimmed.slice(0, 120)}%`;
  const [notes, chunkExcerpts] = await Promise.all([
    ctx.supabase.from("notes").select("title, content").eq("user_id", ctx.userId).ilike("content", like).limit(4),
    searchFileChunks(ctx, trimmed, like)
  ]);

  const parts = [
    ...((notes.data ?? []) as Array<{ title: string; content: string }>).map(
      (note) => `Note "${note.title}": ${note.content.slice(0, 600)}`
    ),
    ...chunkExcerpts
  ];

  return parts.length ? parts.join("\n\n") : "No matching notes or files were found.";
}

async function searchFileChunks(ctx: ToolContext, query: string, like: string): Promise<string[]> {
  // Prefer ranked full-text search, then fall back to a substring match when
  // the query has no ranked results.
  const ranked = await searchChunksFullText(ctx.supabase, query, { projectId: null, limit: 4 });
  if (ranked.length) return ranked.map((chunk) => `File excerpt: ${chunk.content.slice(0, 600)}`);

  const { data } = await ctx.supabase.from("file_chunks").select("content").eq("user_id", ctx.userId).ilike("content", like).limit(4);
  return ((data ?? []) as Array<{ content: string }>).map((chunk) => `File excerpt: ${chunk.content.slice(0, 600)}`);
}

async function createNote(ctx: ToolContext, title: string, content: string): Promise<string> {
  const { data, error } = await ctx.supabase
    .from("notes")
    .insert({ user_id: ctx.userId, project_id: ctx.projectId, title: title.slice(0, 200), content })
    .select("id")
    .single();

  if (error) return `Could not create the note: ${error.message}`;
  return `Created note "${title}".`;
}

async function createFlashcards(ctx: ToolContext, deckName: string, rawCards: unknown[]): Promise<string> {
  const cards = rawCards
    .filter((card): card is { front: unknown; back: unknown } => typeof card === "object" && card !== null)
    .map((card) => ({ front: String(card.front ?? "").trim(), back: String(card.back ?? "").trim() }))
    .filter((card) => card.front && card.back);

  if (!cards.length) return "No valid flashcards were provided (each needs a front and a back).";

  const { data: deck, error: deckError } = await ctx.supabase
    .from("flashcard_decks")
    .insert({ user_id: ctx.userId, project_id: ctx.projectId, name: deckName.slice(0, 200) })
    .select("id")
    .single();

  if (deckError) return `Could not create the deck: ${deckError.message}`;

  const dueAt = new Date().toISOString();
  const { error: cardsError } = await ctx.supabase.from("flashcards").insert(
    cards.map((card) => ({
      user_id: ctx.userId,
      deck_id: deck.id,
      project_id: ctx.projectId,
      front: card.front,
      back: card.back,
      due_at: dueAt
    }))
  );

  if (cardsError) return `Created the deck, but adding cards failed: ${cardsError.message}`;
  return `Created deck "${deckName}" with ${cards.length} flashcards.`;
}
