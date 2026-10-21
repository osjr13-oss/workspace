import type { SupabaseClient } from "@supabase/supabase-js";
import { completeAi } from "@/lib/ai";
import { allowRequest } from "@/lib/rate-limit";
import { removeEmDashes } from "@/lib/text";

type MemoryRow = {
  id: string;
  content: string;
  importance: number;
};

export type MemoryKind = "durable" | "preference";

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
  /\b(?:i am|i['\u2019]m|i have|i['\u2019]ve|i['\u2019]ll|i will|i like|i love|i hate|i prefer|i want|i need|i study|i work|i live|my|we are|we['\u2019]re|our)\b/i;

function isRecallQuery(query: string) {
  return /\b(?:what do you know|what do you remember|remember about me|know about me|my preferences|my goals|who am i|tell me about myself)\b/i.test(
    query
  );
}

/** Load memories of one kind. Chat recall reads durable facts only. */
async function loadMemoryRows(supabase: SupabaseClient, userId: string, kind: MemoryKind = "durable") {
  const { data, error } = await supabase
    .from("content_memories")
    .select("id, content, importance")
    .eq("user_id", userId)
    .eq("kind", kind)
    .order("importance", { ascending: false })
    .order("last_accessed", { ascending: false })
    .limit(50);

  if (error) return [];
  return (data || []) as MemoryRow[];
}

async function extractMemoryCandidates(source: string, maxCount: number) {
  const result = await completeAi(
    [
      {
        role: "system",
        content:
          `Extract lasting facts about the user from the supplied conversation material. Include durable preferences (foods they like or avoid, dietary patterns, allergies), routines, identity details, recurring struggles, and continuing goals only. Do not include writing-style observations, and do not include individual meals, weights, calorie numbers, or other daily log entries, which are stored separately. Return a JSON array of at most ${maxCount} concise strings. Return [] when there is nothing worth remembering. Never use an em dash.`
      },
      {
        role: "user",
        content: source
      }
    ],
    { temperature: 0.1, maxTokens: 600, background: true }
  );

  const match = result.text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  const parsed = JSON.parse(match[0]) as unknown;
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((item): item is string => typeof item === "string")
    .map((item) => removeEmDashes(item.trim()).slice(0, 400))
    .filter((item) => item.length >= 8)
    .slice(0, maxCount);
}

async function storeMemories(
  supabase: SupabaseClient,
  userId: string,
  candidates: string[],
  importance = 0.6
) {
  const existing = await loadMemoryRows(supabase, userId);
  const known = existing.map((row) => row.content);
  let inserted = 0;

  for (const content of candidates) {
    const duplicate = known.some((item) => overlap(content, item) > 0.72);
    if (duplicate) continue;

    const { error } = await supabase.from("content_memories").insert({
      user_id: userId,
      content,
      importance,
      kind: "durable"
    });
    if (error) {
      console.error("[memory] insert failed", error);
      continue;
    }

    known.push(content);
    inserted += 1;
  }

  return inserted;
}

async function bootstrapMemoriesFromHistory(
  supabase: SupabaseClient,
  userId: string
) {
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

  const candidates = await extractMemoryCandidates(
    `User messages from earlier conversations:\n\n${history}`,
    12
  );
  return storeMemories(supabase, userId, candidates, 0.7);
}

export async function retrieveMemories(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  limit = 5
) {
  try {
    const rows = await loadMemoryRows(supabase, userId);

    const recallQuery = isRecallQuery(query);
    const ranked = recallQuery
      ? rows.slice(0, Math.max(limit, 10))
      : rows
          .map((row) => ({
            ...row,
            score: overlap(query, row.content) * 0.75 + Number(row.importance || 0.5) * 0.25
          }))
          .filter((row) => row.score > 0.1)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);

    if (ranked.length) {
      // Bookkeeping only: never make the reply wait for it.
      void supabase
        .from("content_memories")
        .update({ last_accessed: new Date().toISOString() })
        .in(
          "id",
          ranked.map((row) => row.id)
        )
        .then(
          () => undefined,
          () => undefined
        );
    }

    return ranked.map((row) => removeEmDashes(row.content));
  } catch (error) {
    console.error("[memory] retrieval failed", error);
    return [];
  }
}

/**
 * For established accounts with no memories yet, learn durable facts from
 * earlier messages. This is a large model call, so it runs after the reply has
 * been delivered and at most once a day per account, never in front of an answer.
 */
export async function maybeBootstrapMemories(supabase: SupabaseClient, userId: string) {
  try {
    const rows = await loadMemoryRows(supabase, userId);
    if (rows.length > 0) return;
    if (!(await allowRequest("memory.bootstrap", userId, 1, 86_400))) return;

    const inserted = await bootstrapMemoriesFromHistory(supabase, userId);
    if (inserted > 0) console.info("[memory] history bootstrap completed", { userId, inserted });
  } catch (error) {
    console.error("[memory] bootstrap failed", error);
  }
}

export async function extractMemories(
  supabase: SupabaseClient,
  userId: string,
  userMessage: string,
  assistantMessage: string
) {
  if (userMessage.trim().length < 24) return;
  // Most messages are plain questions. Only spend a model call when the user is
  // talking about themselves, their plans, or their preferences.
  if (!PERSONAL_CUE.test(userMessage)) return;

  try {
    const candidates = await extractMemoryCandidates(
      `User: ${userMessage.slice(0, 1200)}\nAssistant: ${assistantMessage.slice(0, 1200)}`,
      3
    );
    await storeMemories(supabase, userId, candidates);
  } catch (error) {
    console.error("[memory] extraction failed", error);
  }
}
