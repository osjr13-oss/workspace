import { embedText, hasEmbeddingProvider } from "@/lib/embeddings";
import type { getAuthenticatedUser } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof getAuthenticatedUser>>["supabase"];

export async function searchProjectChunks(
  supabase: Supabase,
  projectId: string,
  query: string,
  limit = 6
): Promise<Array<{ content: string; similarity: number }>> {
  if (!hasEmbeddingProvider()) return [];

  try {
    const embedding = await embedText(query);
    const { data, error } = await supabase.rpc("match_file_chunks", {
      p_project_id: projectId,
      p_query_embedding: embedding,
      p_match_count: limit
    });

    if (error) {
      console.error("[retrieve-context]", error);
      return [];
    }

    return ((data || []) as Array<{ content: string; similarity: number }>).filter((row) => row.content);
  } catch (error) {
    console.error("[retrieve-context]", error);
    return [];
  }
}

/**
 * Free keyword (full-text) search over the user's uploaded file chunks, ranked by
 * relevance. Needs no embedding provider — it uses the search_chunks_fts() Postgres
 * function backed by a tsvector index. Pass projectId to scope to one project, or
 * null to search all of the user's files.
 */
export async function searchChunksFullText(
  supabase: Supabase,
  query: string,
  options: { projectId?: string | null; limit?: number } = {}
): Promise<Array<{ content: string; rank: number }>> {
  if (!query.trim()) return [];

  try {
    const { data, error } = await supabase.rpc("search_chunks_fts", {
      p_query: query,
      p_project_id: options.projectId ?? null,
      p_match_count: options.limit ?? 6
    });

    if (error) {
      console.error("[retrieve-context] fts", error);
      return [];
    }

    return ((data || []) as Array<{ content: string; rank: number }>).filter((row) => row.content);
  } catch (error) {
    console.error("[retrieve-context] fts", error);
    return [];
  }
}
