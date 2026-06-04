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
