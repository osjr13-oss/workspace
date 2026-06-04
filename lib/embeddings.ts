import type { SupabaseClient } from "@supabase/supabase-js";

const EMBEDDING_DIMENSION = 1536;

export function hasEmbeddingProvider() {
  return Boolean(process.env.EMBEDDING_API_KEY);
}

export function getEmbeddingModel() {
  return process.env.EMBEDDING_MODEL || "text-embedding-3-small";
}

export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.EMBEDDING_API_KEY;
  if (!apiKey) {
    throw new Error("EMBEDDING_API_KEY is not configured");
  }

  const baseUrl = (process.env.EMBEDDING_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: getEmbeddingModel(),
      input: text.slice(0, 8000)
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Embedding request failed: ${detail}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };

  const embedding = payload.data?.[0]?.embedding;
  if (!embedding?.length) {
    throw new Error("Embedding provider returned an empty vector");
  }

  return embedding;
}

export async function embedChunksForFile(
  supabase: SupabaseClient,
  params: {
    userId: string;
    fileId: string;
    projectId: string | null;
    chunks: Array<{ id: string; content: string }>;
  }
): Promise<number> {
  if (!hasEmbeddingProvider() || !params.chunks.length) return 0;

  const model = getEmbeddingModel();
  let embedded = 0;

  for (const chunk of params.chunks) {
    try {
      const vector = await embedText(chunk.content);
      if (vector.length !== EMBEDDING_DIMENSION) {
        console.warn("[embeddings] unexpected dimension", vector.length);
        continue;
      }

      const { error } = await supabase.from("file_chunk_embeddings").upsert(
        {
          user_id: params.userId,
          file_id: params.fileId,
          chunk_id: chunk.id,
          project_id: params.projectId,
          embedding: vector,
          model
        },
        { onConflict: "chunk_id" }
      );

      if (error) {
        console.error("[embeddings] insert failed", error);
        continue;
      }

      embedded += 1;
    } catch (error) {
      console.error("[embeddings] chunk failed", error);
    }
  }

  return embedded;
}
