import type { SupabaseClient } from "@supabase/supabase-js";
import { searchMemoryText } from "@/lib/content-memory";
import { createCalendarEvent, draftGmail, listCalendarEvents, readGmail, searchGmail, type GoogleConnection } from "@/lib/google";
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
        "Search the user's notes, uploaded files, and memories.",
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
  }
];

/** Offered only when the owner has connected Google (Settings). */
export const googleToolDefinitions = [
  {
    type: "function",
    function: {
      name: "gmail_search",
      description: "Search the user's Gmail. Returns id, date, sender, subject and a snippet per email.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Gmail search, e.g. from:landlord newer_than:30d" } },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "gmail_read",
      description: "Read one email in full by id from gmail_search.",
      parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] }
    }
  },
  {
    type: "function",
    function: {
      name: "gmail_draft",
      description: "Save an email draft in Gmail for the user to review. Never sends. Use reply_to_id to reply in a thread.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient; may be empty when replying." },
          subject: { type: "string" },
          body: { type: "string", description: "Plain text body." },
          reply_to_id: { type: "string", description: "Email id being replied to." }
        },
        required: ["body"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "calendar_events",
      description: "List the user's Google Calendar events between two times.",
      parameters: {
        type: "object",
        properties: {
          start: { type: "string", description: "ISO 8601 date-time" },
          end: { type: "string", description: "ISO 8601 date-time" }
        },
        required: ["start", "end"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "calendar_add",
      description: "Add an event to Google Calendar. Only when the user gave the exact details and asked to add it, or confirmed details you proposed.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          start: { type: "string", description: "Local date-time like 2026-11-20T15:00:00, or a date for all-day" },
          end: { type: "string" },
          all_day: { type: "boolean" },
          location: { type: "string" },
          description: { type: "string" }
        },
        required: ["title", "start"]
      }
    }
  }
];

// Actions that change the user's accounts run only when the user's own message
// asks for one, so instructions hidden in an email can never trigger them.
const CONFIRMATION = /\b(?:yes|yeah|yep|sure|ok|okay|confirm(?:ed)?|go ahead|do it|sounds good|correct|that works|perfect)\b/i;
const ACTION_REQUEST: Record<string, RegExp> = {
  gmail_draft: /\b(?:draft|write|compose|respond to|reply to|answer)\b|\breply\s+(?:to|back|saying|that|thanking|with)\b/i,
  calendar_add: /\b(?:add|schedule|put|book|block|create|set up|make)\b[^.?!]*\b(?:calendar|event|meeting|appointment|reminder|call|lunch|dinner|at \d|on \w+day|tomorrow|today)\b/i
};

export type ToolContext = {
  supabase: SupabaseClient;
  /** The owner's Google connection, when connected. */
  google?: GoogleConnection | null;
  /** The user's current message, used to gate account-changing actions. */
  userMessage?: string;
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
    case "create_note":
      return createNote(ctx, String(args.title ?? "Untitled note"), String(args.content ?? ""));
    case "gmail_search":
    case "gmail_read":
    case "gmail_draft":
    case "calendar_events":
    case "calendar_add":
      return runGoogleTool(name, args, ctx);
    default:
      return `Unknown tool: ${name}`;
  }
}

async function searchWorkspace(ctx: ToolContext, query: string): Promise<string> {
  const trimmed = query.trim();
  if (!trimmed) return "No search query was provided.";

  const like = `%${trimmed.slice(0, 120)}%`;
  const [notes, chunkExcerpts, memories] = await Promise.all([
    ctx.supabase.from("notes").select("title, content").eq("user_id", ctx.userId).ilike("content", like).limit(4),
    searchFileChunks(ctx, trimmed, like),
    searchMemoryText(ctx.supabase, ctx.userId, trimmed).catch(() => [] as string[])
  ]);

  const parts = [
    ...((notes.data ?? []) as Array<{ title: string; content: string }>).map(
      (note) => `Note "${note.title}": ${note.content.slice(0, 600)}`
    ),
    ...chunkExcerpts,
    ...memories
  ];

  return parts.length ? parts.join("\n\n") : "No matching notes, files, or memories were found.";
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

async function runGoogleTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const google = ctx.google;
  if (!google) return "Google is not connected. The user can connect it in Settings.";
  const text = (value: unknown) => String(value ?? "").trim();
  if ((name === "gmail_draft" || name === "calendar_add") && !ACTION_REQUEST[name].test(ctx.userMessage || "") && !CONFIRMATION.test(ctx.userMessage || "")) {
    return "Not done: the user has not asked for this in their message. Ask them first.";
  }
  try {
    switch (name) {
      case "gmail_search":
        return await searchGmail(google, text(args.query) || "in:inbox");
      case "gmail_read":
        return await readGmail(google, text(args.id));
      case "gmail_draft":
        return await draftGmail(google, { to: text(args.to), subject: text(args.subject), body: text(args.body), replyToId: text(args.reply_to_id) || undefined });
      case "calendar_events":
        return await listCalendarEvents(google, text(args.start), text(args.end));
      default:
        return await createCalendarEvent(google, {
          title: text(args.title),
          start: text(args.start),
          end: text(args.end) || undefined,
          allDay: args.all_day === true,
          location: text(args.location) || undefined,
          description: text(args.description) || undefined
        });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/invalid_grant|401/.test(message)) return "Could not reach Google: the connection has expired. The user should reconnect Google in Settings.";
    return `Could not reach Google: ${message}`;
  }
}
