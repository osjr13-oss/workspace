import type { SupabaseClient } from "@supabase/supabase-js";
import { completeAi } from "@/lib/ai";
import { embedForMemory, memoryEmbeddingModel } from "@/lib/embeddings";
import { allowRequest } from "@/lib/rate-limit";
import { removeEmDashes } from "@/lib/text";

/**
 * Durable memory: facts the user has shared, recalled by meaning.
 *
 * Each memory is stored with an embedding (`content_memories.embedding`), and a
 * chat message is matched against them with the `match_memories` RPC. Keyword
 * overlap is kept as a fallback when embeddings are unavailable. Pinned
 * memories are always in context. The user can review, add, edit, pin and
 * delete memories on the Memory page; new facts, corrections and "forget that"
 * requests from chat are applied after the reply, never in front of it.
 */

export type MemoryKind = "durable" | "preference";
export type MemorySource = "chat" | "manual" | "history";
export type MemoryHit = { id: string; content: string };

type MemoryRow = {
  id: string;
  content: string;
  importance: number;
  pinned?: boolean | null;
};

type MatchRow = { id: string; similarity: number };

const MAX_MEMORY_CHARS = 400;
const SEMANTIC_THRESHOLD = 0.3;
const DUPLICATE_SIMILARITY = 0.9;
const MAX_PINNED_IN_CONTEXT = 4;

function tokenize(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2)
  );
}

function overlap(query: string, content: string) {
  const queryWords = tokenize(query);
  if (!queryWords.size) return 0;
  const contentWords = tokenize(content);
  let matches = 0;
  for (const word of queryWords) {
    if (contentWords.has(word)) matches += 1;
  }
  return matches / queryWords.size;
}

const PERSONAL_CUE =
  /\b(?:i am|i['’]m|i have|i['’]ve|i['’]ll|i will|i like|i love|i hate|i prefer|i want|i need|i study|i work|i live|i moved|my|we are|we['’]re|our)\b/i;
const CORRECTION_CUE = /\b(?:remember|forget|no longer|not anymore|anymore|actually|instead|changed|stopped|started)\b/i;

export function isRecallQuery(query: string) {
  return /\b(?:what do you know|what do you remember|do you remember|remember about me|know about me|what have i told you|my preferences|my goals|who am i|tell me about myself)\b/i.test(
    query
  );
}

export function cleanMemoryText(value: string) {
  return removeEmDashes(value.replace(/\s+/g, " ").trim()).slice(0, MAX_MEMORY_CHARS);
}

/** Durable memories, pinned first. Falls back to the older columns before the memory migration is applied. */
async function loadMemoryRows(supabase: SupabaseClient, userId: string, limit = 200): Promise<MemoryRow[]> {
  const query = (columns: string) =>
    supabase
      .from("content_memories")
      .select(columns)
      .eq("user_id", userId)
      .eq("kind", "durable")
      .order("importance", { ascending: false })
      .order("last_accessed", { ascending: false })
      .limit(limit);

  const withPinned = await query("id, content, importance, pinned");
  if (!withPinned.error) {
    const rows = (withPinned.data || []) as unknown as MemoryRow[];
    return [...rows.filter((row) => row.pinned), ...rows.filter((row) => !row.pinned)];
  }
  const basic = await query("id, content, importance");
  return basic.error ? [] : ((basic.data || []) as unknown as MemoryRow[]);
}

async function semanticMatches(supabase: SupabaseClient, embedding: number[], count: number): Promise<MatchRow[]> {
  const model = memoryEmbeddingModel();
  if (!model) return [];
  const { data, error } = await supabase.rpc("match_memories", {
    p_query_embedding: embedding,
    p_model: model,
    p_match_count: count
  });
  if (error) {
    console.error("[memory] semantic match failed", error.message);
    return [];
  }
  return ((data || []) as MatchRow[]).filter((row) => row.id && Number.isFinite(row.similarity));
}

/** Rank memories for a query: by meaning when embeddings work, by shared words otherwise. */
async function rankMemories(supabase: SupabaseClient, rows: MemoryRow[], query: string, limit: number) {
  const [embedding] = (await embedForMemory([query])) ?? [];
  const similarity = new Map<string, number>();
  if (embedding) {
    for (const match of await semanticMatches(supabase, embedding, Math.max(limit * 2, 12))) similarity.set(match.id, match.similarity);
  }
  const semantic = similarity.size > 0;

  return rows
    .map((row) => {
      const sim = similarity.get(row.id) ?? 0;
      const words = overlap(query, row.content);
      const relevant = semantic ? sim >= SEMANTIC_THRESHOLD || words >= 0.5 : words * 0.75 + Number(row.importance || 0.5) * 0.25 > 0.1;
      const score = (semantic ? sim * 0.75 + words * 0.15 : words * 0.75) + Number(row.importance || 0.5) * 0.1;
      return { row, score, relevant };
    })
    .filter((item) => item.relevant)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.row);
}

function touch(supabase: SupabaseClient, rows: MemoryRow[]) {
  if (!rows.length) return;
  // Bookkeeping only: never make the reply wait for it.
  void supabase
    .from("content_memories")
    .update({ last_accessed: new Date().toISOString() })
    .in(
      "id",
      rows.map((row) => row.id)
    )
    .then(
      () => undefined,
      () => undefined
    );
}

/** Memories to put in front of the model for this message: pinned ones plus the most relevant. */
export async function retrieveMemories(supabase: SupabaseClient, userId: string, query: string, limit = 6): Promise<MemoryHit[]> {
  try {
    const rows = await loadMemoryRows(supabase, userId);
    if (!rows.length) return [];

    const pinned = rows.filter((row) => row.pinned).slice(0, MAX_PINNED_IN_CONTEXT);
    const pinnedIds = new Set(pinned.map((row) => row.id));
    const rest = rows.filter((row) => !pinnedIds.has(row.id));
    const chosen = isRecallQuery(query)
      ? [...pinned, ...rest.slice(0, Math.max(limit, 12))]
      : [...pinned, ...(await rankMemories(supabase, rest, query, limit))];

    touch(supabase, chosen);
    return chosen.map((row) => ({ id: row.id, content: removeEmDashes(row.content) }));
  } catch (error) {
    console.error("[memory] retrieval failed", error);
    return [];
  }
}

/** Memory lines for the workspace search tool. */
export async function searchMemoryText(supabase: SupabaseClient, userId: string, query: string) {
  const rows = await loadMemoryRows(supabase, userId);
  if (!rows.length) return [];
  return (await rankMemories(supabase, rows, query, 4)).map((row) => `Memory: ${removeEmDashes(row.content)}`);
}

async function insertMemory(supabase: SupabaseClient, row: Record<string, unknown>) {
  const result = await supabase.from("content_memories").insert(row).select("id, content, importance, pinned, source, created_at, updated_at").single();
  if (!result.error) return result;
  // Before the memory migration: store the fact without the new columns.
  const { embedding: _embedding, embedding_model: _model, pinned: _pinned, source: _source, ...basic } = row;
  return supabase.from("content_memories").insert(basic).select("id, content, importance, created_at").single();
}

/** Save one memory with its embedding. Returns null for an empty or duplicate fact. */
export async function saveMemory(
  supabase: SupabaseClient,
  userId: string,
  rawContent: string,
  options: { source?: MemorySource; importance?: number; pinned?: boolean; skipDuplicates?: boolean } = {}
) {
  const content = cleanMemoryText(rawContent);
  if (content.length < 3) return null;

  const [embedding] = (await embedForMemory([content], 4000)) ?? [];
  if (options.skipDuplicates) {
    if (embedding) {
      const [closest] = await semanticMatches(supabase, embedding, 1);
      if (closest && closest.similarity >= DUPLICATE_SIMILARITY) return null;
    } else {
      const existing = await loadMemoryRows(supabase, userId);
      if (existing.some((row) => overlap(content, row.content) > 0.72)) return null;
    }
  }

  const { data, error } = await insertMemory(supabase, {
    user_id: userId,
    content,
    importance: options.importance ?? (options.source === "manual" ? 0.8 : 0.6),
    kind: "durable",
    source: options.source ?? "chat",
    pinned: options.pinned ?? false,
    ...(embedding ? { embedding, embedding_model: memoryEmbeddingModel() } : {})
  });
  if (error) {
    console.error("[memory] insert failed", error.message);
    return null;
  }
  return data;
}

/** Change a memory's text and refresh its embedding. */
export async function updateMemory(supabase: SupabaseClient, userId: string, id: string, rawContent: string) {
  const content = cleanMemoryText(rawContent);
  if (content.length < 3) return { error: "A memory needs a few words." };
  const [embedding] = (await embedForMemory([content], 4000)) ?? [];
  const write = (patch: Record<string, unknown>) =>
    supabase.from("content_memories").update(patch).eq("id", id).eq("user_id", userId);
  let { error } = await write({
    content,
    updated_at: new Date().toISOString(),
    ...(embedding ? { embedding, embedding_model: memoryEmbeddingModel() } : { embedding: null })
  });
  // Before the memory migration: only the text can change.
  if (error) ({ error } = await write({ content }));
  return { error: error?.message ?? null, content };
}

type MemoryChanges = { add: string[]; update: Array<{ id: string; content: string }>; remove: string[] };

async function proposeMemoryChanges(source: string, related: MemoryRow[], maxAdds: number): Promise<MemoryChanges> {
  const existing = related.length ? related.map((row) => `${row.id}: ${row.content}`).join("\n") : "(none)";
  const result = await completeAi(
    [
      {
        role: "system",
        content:
          `You maintain the list of lasting facts about the user. Compare the conversation with the existing related memories. Return JSON {"add":[string],"update":[{"id":string,"content":string}],"remove":[string]}. add: at most ${maxAdds} new lasting facts (identity, durable preferences, people, ongoing projects, goals, recurring concerns), each a short third-person sentence. update: when the user changes or corrects an existing memory, rewrite it. remove: ids the user says are no longer true or asks you to forget. Use only ids from the list. Ignore writing-style observations, one-off requests and anything the assistant said that the user did not confirm. Return {"add":[],"update":[],"remove":[]} when nothing changes. Never use an em dash.`
      },
      { role: "user", content: `Existing related memories:\n${existing}\n\nConversation:\n${source}` }
    ],
    { temperature: 0.1, maxTokens: 700, background: true }
  );

  const match = result.text.match(/\{[\s\S]*\}/);
  if (!match) return { add: [], update: [], remove: [] };
  const parsed = JSON.parse(match[0]) as Partial<Record<keyof MemoryChanges, unknown>>;
  const ids = new Set(related.map((row) => row.id));
  const strings = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

  return {
    add: strings(parsed.add).map(cleanMemoryText).filter((item) => item.length >= 8).slice(0, maxAdds),
    update: (Array.isArray(parsed.update) ? parsed.update : [])
      .filter((item): item is { id: string; content: string } => Boolean(item) && typeof item.id === "string" && typeof item.content === "string" && ids.has(item.id))
      .map((item) => ({ id: item.id, content: cleanMemoryText(item.content) }))
      .filter((item) => item.content.length >= 8),
    remove: strings(parsed.remove).filter((id) => ids.has(id))
  };
}

async function applyMemoryChanges(supabase: SupabaseClient, userId: string, changes: MemoryChanges, source: MemorySource, importance?: number) {
  let changed = 0;
  for (const id of changes.remove) {
    const { error } = await supabase.from("content_memories").delete().eq("id", id).eq("user_id", userId);
    if (!error) changed += 1;
  }
  for (const item of changes.update) {
    if (changes.remove.includes(item.id)) continue;
    if (!(await updateMemory(supabase, userId, item.id, item.content)).error) changed += 1;
  }
  for (const content of changes.add) {
    if (await saveMemory(supabase, userId, content, { source, importance, skipDuplicates: true })) changed += 1;
  }
  return changed;
}

/** After a reply: learn new facts and apply corrections or "forget" requests from this exchange. */
export async function extractMemories(supabase: SupabaseClient, userId: string, userMessage: string, assistantMessage: string) {
  if (userMessage.trim().length < 12) return;
  // Most messages are plain questions. Only spend a model call when the user is
  // talking about themselves or correcting what Selrano knows.
  if (!PERSONAL_CUE.test(userMessage) && !CORRECTION_CUE.test(userMessage)) return;

  try {
    const rows = await loadMemoryRows(supabase, userId);
    const related = rows.length ? await rankMemories(supabase, rows, userMessage, 8) : [];
    const changes = await proposeMemoryChanges(
      `User: ${userMessage.slice(0, 1200)}\nAssistant: ${assistantMessage.slice(0, 1200)}`,
      related,
      3
    );
    await applyMemoryChanges(supabase, userId, changes, "chat");
  } catch (error) {
    console.error("[memory] extraction failed", error);
  }
}

async function bootstrapMemoriesFromHistory(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("content")
    .eq("user_id", userId)
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error || !data || data.length < 4) return 0;

  const history = data
    .map((row) => removeEmDashes(String(row.content || "")).trim())
    .filter((message) => message.length >= 12 && !isRecallQuery(message))
    .reverse()
    .join("\n\n")
    .slice(-12000);

  if (history.length < 80) return 0;

  const changes = await proposeMemoryChanges(`User messages from earlier conversations:\n\n${history}`, [], 12);
  return applyMemoryChanges(supabase, userId, { add: changes.add, update: [], remove: [] }, "history", 0.7);
}

/** Give older memories an embedding (or a new one after the embedding model changed) so they can be recalled by meaning. */
async function backfillEmbeddings(supabase: SupabaseClient, userId: string) {
  const model = memoryEmbeddingModel();
  if (!model) return 0;
  const { data, error } = await supabase
    .from("content_memories")
    .select("id, content")
    .eq("user_id", userId)
    // Missing, or made by a different embedding model (vectors from two models cannot be compared).
    .or(`embedding.is.null,embedding_model.is.null,embedding_model.neq.${model}`)
    .limit(50);
  if (error || !data?.length) return 0;

  const rows = data as Array<{ id: string; content: string }>;
  const vectors = await embedForMemory(
    rows.map((row) => row.content),
    8000
  );
  if (!vectors) return 0;
  let updated = 0;
  for (const [index, row] of rows.entries()) {
    const { error: updateError } = await supabase
      .from("content_memories")
      .update({ embedding: vectors[index], embedding_model: model })
      .eq("id", row.id)
      .eq("user_id", userId);
    if (!updateError) updated += 1;
  }
  return updated;
}

/**
 * Background upkeep after a reply: give older memories embeddings (at most once
 * an hour), and for established accounts with no memories, learn durable facts
 * from earlier messages (at most once a day). Never in front of an answer.
 */
export async function maybeBootstrapMemories(supabase: SupabaseClient, userId: string) {
  try {
    const rows = await loadMemoryRows(supabase, userId, 1);
    if (rows.length > 0) {
      if (await allowRequest("memory.embed", userId, 1, 3_600)) {
        const embedded = await backfillEmbeddings(supabase, userId);
        if (embedded > 0) console.info("[memory] embeddings backfilled", { embedded });
      }
      return;
    }
    if (!(await allowRequest("memory.bootstrap", userId, 1, 86_400))) return;

    const inserted = await bootstrapMemoriesFromHistory(supabase, userId);
    if (inserted > 0) console.info("[memory] history bootstrap completed", { inserted });
  } catch (error) {
    console.error("[memory] bootstrap failed", error);
  }
}
