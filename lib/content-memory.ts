import type { SupabaseClient } from "@supabase/supabase-js";
import { completeAi } from "@/lib/ai";
import { removeEmDashes } from "@/lib/text";

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

export async function retrieveMemories(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  limit = 5
) {
  try {
    const { data, error } = await supabase
      .from("content_memories")
      .select("id, content, importance")
      .eq("user_id", userId)
      .order("importance", { ascending: false })
      .limit(40);
    if (error) return [];

    const ranked = (data || [])
      .map((row) => ({
        ...row,
        score: overlap(query, String(row.content)) * 0.75 + Number(row.importance || 0.5) * 0.25
      }))
      .filter((row) => row.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    if (ranked.length) {
      await supabase
        .from("content_memories")
        .update({ last_accessed: new Date().toISOString() })
        .in(
          "id",
          ranked.map((row) => row.id)
        );
    }

    return ranked.map((row) => removeEmDashes(String(row.content)));
  } catch {
    return [];
  }
}

export async function extractMemories(
  supabase: SupabaseClient,
  userId: string,
  userMessage: string,
  assistantMessage: string
) {
  if (userMessage.trim().length < 24) return;

  try {
    const result = await completeAi(
      [
        {
          role: "system",
          content:
            "Extract lasting facts about the user from this exchange. Include durable preferences, identity details, ongoing projects, and continuing goals only. Do not include writing-style observations. Return a JSON array of at most 3 strings. Return [] when there is nothing worth remembering. Never use an em dash."
        },
        {
          role: "user",
          content: `User: ${userMessage.slice(0, 900)}\nAssistant: ${assistantMessage.slice(0, 900)}`
        }
      ],
      { temperature: 0.1 }
    );

    const match = result.text.match(/\[[\s\S]*\]/);
    if (!match) return;
    const parsed = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(parsed)) return;

    const { data: existing } = await supabase
      .from("content_memories")
      .select("content")
      .eq("user_id", userId)
      .limit(50);

    for (const item of parsed.slice(0, 3)) {
      if (typeof item !== "string") continue;
      const content = removeEmDashes(item.trim()).slice(0, 400);
      if (content.length < 8) continue;
      const duplicate = (existing || []).some(
        (row) => overlap(content, String(row.content)) > 0.72
      );
      if (duplicate) continue;

      await supabase.from("content_memories").insert({
        user_id: userId,
        content,
        importance: 0.6
      });
    }
  } catch (error) {
    console.error("[memory] extraction failed", error);
  }
}
