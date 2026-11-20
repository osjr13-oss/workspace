import type { SupabaseClient } from "@supabase/supabase-js";
import { saveMemory, searchMemoryText } from "@/lib/content-memory";
import { accountsText, findTransactionsText, money, spendingSummaryText } from "@/lib/finance";
import { recurringPayments } from "@/lib/plaid";
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
  },
  {
    type: "function",
    function: {
      name: "remember",
      description: "Save a lasting fact, preference or standing instruction to the user's memory. Only when the user asks you to remember something.",
      parameters: {
        type: "object",
        properties: { fact: { type: "string", description: "One short sentence, e.g. Check the connected bank directly for money questions." } },
        required: ["fact"]
      }
    }
  }
];

// Saving to memory runs only when the user's own message asks for it.
const REMEMBER_REQUEST = /\b(?:remember|don['’]?t forget|keep in mind|note (?:that|this)|save (?:that|this)|from now on|going forward|always|never|make sure (?:to|you))\b/i;

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

/** Offered only when the owner has a bank connected through Plaid. All read-only. */
export const financeToolDefinitions = [
  {
    type: "function",
    function: {
      name: "money_summary",
      description: "The user's spending by category and income between two dates.",
      parameters: {
        type: "object",
        properties: { start: { type: "string", description: "YYYY-MM-DD" }, end: { type: "string", description: "YYYY-MM-DD" } },
        required: ["start", "end"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "money_transactions",
      description: "Find the user's bank and card transactions by merchant text, category, dates or minimum amount.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Merchant or description text" },
          category: { type: "string", description: "e.g. food, travel, shopping" },
          start: { type: "string", description: "YYYY-MM-DD" },
          end: { type: "string", description: "YYYY-MM-DD" },
          min_amount: { type: "number" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "money_accounts",
      description: "The user's connected bank, card and savings accounts with balances.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "money_recurring",
      description: "The user's subscriptions and recurring bills with amounts and next expected dates.",
      parameters: { type: "object", properties: {} }
    }
  }
];

// Actions that change the user's accounts run only when the user's own message
// asks for one, so instructions hidden in an email can never trigger them.
const CONFIRMATION = /\b(?:yes|yeah|yep|sure|ok|okay|confirm(?:ed)?|go ahead|do it|sounds good|correct|that works|perfect)\b/i;
// What Selrano's previous reply must have been offering for a bare "yes" to count.
const PROPOSAL: Record<string, RegExp> = {
  gmail_draft: /\b(?:draft|reply|respond|email|message)\b/i,
  calendar_add: /\b(?:event|calendar|schedule|meeting|appointment|reminder|add)\b/i
};
const MAX_CONFIRMATION_WORDS = 8;

/**
 * A short "yes" approves a draft or event only when the previous Selrano reply
 * asked about exactly that. A "yes" tucked into a longer message, or one that
 * follows an unrelated reply, never counts, so text planted in an email cannot
 * ride along on an unrelated "ok".
 */
export function confirmsProposal(tool: string, userMessage: string, lastAssistantMessage: string) {
  const words = userMessage.trim().split(/\s+/).filter(Boolean);
  if (!words.length || words.length > MAX_CONFIRMATION_WORDS || !CONFIRMATION.test(userMessage)) return false;
  const proposal = PROPOSAL[tool];
  return Boolean(proposal && lastAssistantMessage.includes("?") && proposal.test(lastAssistantMessage));
}
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
  /** Selrano's previous reply, so a short "yes" can be matched to what it proposed. */
  lastAssistantMessage?: string;
  /** Settles once a bank sync started for this message has finished (or given up). */
  financeReady?: Promise<unknown>;
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
    case "remember": {
      if (!REMEMBER_REQUEST.test(ctx.userMessage || "")) return "Not done: the user has not asked you to remember anything.";
      const saved = await saveMemory(ctx.supabase, ctx.userId, String(args.fact ?? ""), { source: "chat", importance: 0.85, skipDuplicates: true });
      return saved ? `Saved to memory: "${saved.content}". It is on the Memory page.` : "Already in memory (or too short to save); nothing new was saved.";
    }
    case "money_summary":
    case "money_transactions":
    case "money_accounts":
    case "money_recurring":
      return runFinanceTool(name, args, ctx);
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
  if ((name === "gmail_draft" || name === "calendar_add") && !ACTION_REQUEST[name].test(ctx.userMessage || "") && !confirmsProposal(name, ctx.userMessage || "", ctx.lastAssistantMessage || "")) {
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

async function runFinanceTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const text = (value: unknown) => String(value ?? "").trim();
  // Read after the fresh sync when one is running, but never wait more than 8 seconds for it.
  if (ctx.financeReady) await Promise.race([ctx.financeReady.catch(() => undefined), new Promise((resolve) => setTimeout(resolve, 8_000))]);
  try {
    switch (name) {
      case "money_summary":
        return await spendingSummaryText(ctx.supabase, ctx.userId, text(args.start), text(args.end));
      case "money_transactions":
        return await findTransactionsText(ctx.supabase, ctx.userId, {
          query: text(args.query),
          category: text(args.category),
          start: text(args.start),
          end: text(args.end),
          min_amount: typeof args.min_amount === "number" ? args.min_amount : undefined
        });
      case "money_accounts":
        return await accountsText(ctx.supabase, ctx.userId);
      default: {
        const streams = await recurringPayments(ctx.userId);
        if (!streams.length) return "No recurring payments were found yet. Plaid needs a few months of history to spot them.";
        const monthly = streams.reduce((sum, stream) => sum + monthlyCost(stream.amount, stream.frequency), 0);
        return [
          `Recurring payments (about ${money(monthly)} a month in total):`,
          ...streams.map((stream) => `- ${stream.name}: ${money(stream.amount)} ${stream.frequency}${stream.nextDate ? `, next around ${stream.nextDate}` : ""}${stream.lastDate ? `, last ${stream.lastDate}` : ""}`)
        ].join("\n");
      }
    }
  } catch (error) {
    return `Could not read the finance data: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function monthlyCost(amount: number, frequency: string) {
  switch (frequency) {
    case "weekly":
      return (amount * 52) / 12;
    case "biweekly":
      return (amount * 26) / 12;
    case "semi_monthly":
      return amount * 2;
    case "annually":
      return amount / 12;
    default:
      return amount;
  }
}
