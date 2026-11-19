import type { SupabaseClient } from "@supabase/supabase-js";

const EMBEDDING_DIMENSION = 1536;

export function hasEmbeddingProvider() {
  return Boolean(process.env.EMBEDDING_API_KEY);
}

export function getEmbeddingModel() {
  return process.env.EMBEDDING_MODEL || "text-embedding-3-small";
}

/**
 * Memory embeddings reuse the configured OpenAI account when no separate
 * embedding key is set, so meaning-based memory recall works out of the box.
 */
function memoryEmbeddingConfig() {
  if (process.env.EMBEDDING_API_KEY) {
    return {
      apiKey: process.env.EMBEDDING_API_KEY,
      baseUrl: process.env.EMBEDDING_BASE_URL || "https://api.openai.com/v1",
      model: getEmbeddingModel()
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      model: "text-embedding-3-small"
    };
  }
  return null;
}

export function memoryEmbeddingModel() {
  return memoryEmbeddingConfig()?.model ?? null;
}

/** Embeds short texts (memories, chat queries). Returns null when unavailable, slow, or malformed. */
export async function embedForMemory(texts: string[], timeoutMs = 1500): Promise<number[][] | null> {
  const config = memoryEmbeddingConfig();
  if (!config || !texts.length) return null;
  try {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/embeddings`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: config.model, input: texts.map((text) => text.slice(0, 2000)) }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) {
      console.error("[embeddings] memory request failed", response.status);
      return null;
    }
    const payload = (await response.json()) as { data?: Array<{ index?: number; embedding?: number[] }> };
    const rows = [...(payload.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const vectors = rows.map((row) => row.embedding ?? []);
    if (vectors.length !== texts.length || vectors.some((vector) => vector.length !== EMBEDDING_DIMENSION)) return null;
    return vectors;
  } catch (error) {
    console.error("[embeddings] memory embedding unavailable", error instanceof Error ? error.message : error);
    return null;
  }
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
