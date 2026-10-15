import type { SupabaseClient } from "@supabase/supabase-js";
import { createDeckWithCards, normalizeCards } from "@/lib/flashcards";
import { searchChunksFullText } from "@/lib/retrieve-context";
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
        "Search the user's notes and uploaded files.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "What to look for." }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_note",
      description: "Create a note. Only when the user asks to write or save one.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Note title." },
          content: { type: "string", description: "Note body in Markdown." }
        },
        required: ["title", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_flashcards",
      description: "Create a flashcard deck. Only when the user asks for flashcards.",
      parameters: {
        type: "object",
        properties: {
          deck_name: { type: "string", description: "Deck name." },
          cards: {
            type: "array",
            description: "Cards.",
            items: {
              type: "object",
              properties: {
                front: { type: "string", description: "Question." },
                back: { type: "string", description: "Answer." }
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
      return "Web research must run through the checked research flow. No search was performed.";
    case "create_note":
      return createNote(ctx, String(args.title ?? "Untitled note"), String(args.content ?? ""));
    case "create_flashcards":
      return createFlashcards(ctx, String(args.deck_name ?? "New deck"), Array.isArray(args.cards) ? args.cards : []);
    default:
      return `Unknown tool: ${name}`;
  }
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
  const cards = normalizeCards(rawCards);
  if (!cards.length) return "No valid flashcards were provided (each needs a front and a back).";

  const result = await createDeckWithCards(ctx.supabase, {
    userId: ctx.userId,
    projectId: ctx.projectId,
    name: deckName,
    cards
  });

  if ("deckError" in result) return `Could not create the deck: ${result.deckError}`;
  if ("cardsError" in result) return `Created the deck, but adding cards failed: ${result.cardsError}`;
  return `Created deck "${deckName}" with ${result.count} flashcards.`;
}
