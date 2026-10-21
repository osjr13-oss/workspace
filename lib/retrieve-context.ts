import { embedText, getEmbeddingModel, hasEmbeddingProvider } from "@/lib/embeddings";
import type { getAuthenticatedUser } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof getAuthenticatedUser>>["supabase"];

export type RetrievedChunk = {
  content: string;
  chunkId: string;
  fileId: string;
  fileName: string;
  pageNumber: number | null;
  charStart: number | null;
  charEnd: number | null;
};

type MatchFileChunksRow = {
  content: string;
  similarity: number;
  chunk_id: string;
  file_id: string;
  file_name: string;
  page_number: number | null;
  char_start: number | null;
  char_end: number | null;
};

export async function searchProjectChunks(
  supabase: Supabase,
  projectId: string,
  query: string,
  limit = 6
): Promise<RetrievedChunk[]> {
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

    const rows = (data || []) as MatchFileChunksRow[];
    if (!rows.length) return [];
    // Legacy embeddings use a different vector space. Never present them as Gemini matches.
    const compatible = await supabase.from("file_chunk_embeddings").select("chunk_id")
      .in("chunk_id", rows.map((row) => row.chunk_id)).eq("model", getEmbeddingModel());
    if (compatible.error) return [];
    const ids = new Set((compatible.data || []).map((row) => row.chunk_id));
    return rows
      .filter((row) => row.content && ids.has(row.chunk_id))
      .map((row) => ({
        content: row.content,
        chunkId: row.chunk_id,
        fileId: row.file_id,
        fileName: row.file_name,
        pageNumber: row.page_number,
        charStart: row.char_start,
        charEnd: row.char_end
      }));
  } catch (error) {
    console.error("[retrieve-context]", error);
    return [];
  }
}

/**
 * Free keyword (full-text) search over the user's uploaded file chunks, ranked by
 * relevance. It needs no embedding provider because it uses the search_chunks_fts() Postgres
 * function backed by a tsvector index. Pass projectId to scope to one project, or
 * null to search all of the user's files.
 */
type SearchChunksFtsRow = {
  content: string;
  rank: number;
  chunk_id: string;
  file_id: string;
  file_name: string;
  page_number: number | null;
  char_start: number | null;
  char_end: number | null;
};

export async function searchChunksFullText(
  supabase: Supabase,
  query: string,
  options: { projectId?: string | null; limit?: number } = {}
): Promise<RetrievedChunk[]> {
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

    return ((data || []) as SearchChunksFtsRow[])
      .filter((row) => row.content)
      .map((row) => ({
        content: row.content,
        chunkId: row.chunk_id,
        fileId: row.file_id,
        fileName: row.file_name,
        pageNumber: row.page_number,
        charStart: row.char_start,
        charEnd: row.char_end
      }));
  } catch (error) {
    console.error("[retrieve-context] fts", error);
    return [];
  }
}
