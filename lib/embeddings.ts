import type { SupabaseClient } from "@supabase/supabase-js";

const EMBEDDING_DIMENSION = 1536;

export function hasEmbeddingProvider() {
  return Boolean(memoryEmbeddingConfig());
}

export function getEmbeddingModel() {
  return memoryEmbeddingConfig()?.model || process.env.EMBEDDING_MODEL || "text-embedding-3-small";
}

/**
 * Memory embeddings reuse the configured OpenAI account when no separate
 * embedding key is set, so meaning-based memory recall works out of the box.
 */
type EmbeddingConfig = { kind: "openai" | "gemini"; apiKey: string; baseUrl: string; model: string };

/**
 * Where memory embeddings come from: Google when GEMINI_API_KEY is set
 * (gemini-embedding-001 at 1536 dimensions, so the existing vector column
 * fits), otherwise a separate EMBEDDING_API_KEY, otherwise OpenAI. Memories embedded by
 * another model are re-embedded in the background (backfillEmbeddings).
 */
function memoryEmbeddingConfig(): EmbeddingConfig | null {
  if (process.env.GEMINI_API_KEY?.trim()) {
    return {
      kind: "gemini",
      apiKey: process.env.GEMINI_API_KEY.trim(),
      baseUrl: (process.env.GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, ""),
      model: "gemini-embedding-001"
    };
  }
  if (process.env.EMBEDDING_API_KEY) {
    return {
      kind: "openai",
      apiKey: process.env.EMBEDDING_API_KEY,
      baseUrl: process.env.EMBEDDING_BASE_URL || "https://api.openai.com/v1",
      model: getEmbeddingModel()
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      kind: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      model: "text-embedding-3-small"
    };
  }
  return null;
}

/** Scales a vector to length 1; Google asks for this when gemini-embedding-001 returns fewer than 3072 dimensions. */
function normalize(vector: number[]) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return norm ? vector.map((value) => value / norm) : vector;
}

async function geminiEmbeddings(config: EmbeddingConfig, texts: string[], timeoutMs: number) {
  const model = `models/${config.model}`;
  // Google's examples put these options at the top of each request; its reference
  // lists them under embedContentConfig. Try the first, then the second.
  const shapes = [
    (text: string) => ({ model, content: { parts: [{ text }] }, taskType: "SEMANTIC_SIMILARITY", outputDimensionality: EMBEDDING_DIMENSION }),
    (text: string) => ({ model, content: { parts: [{ text }] }, embedContentConfig: { taskType: "SEMANTIC_SIMILARITY", outputDimensionality: EMBEDDING_DIMENSION } })
  ];
  for (const shape of shapes) {
    const response = await fetch(`${config.baseUrl}/${model}:batchEmbedContents`, {
      method: "POST",
      headers: { "x-goog-api-key": config.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ requests: texts.map((text) => shape(text.slice(0, 2000))) }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (response.status === 400) continue;
    if (!response.ok) {
      console.error("[embeddings] memory request failed", response.status);
      return null;
    }
    const payload = (await response.json()) as { embeddings?: Array<{ values?: number[] }> };
    return (payload.embeddings ?? []).map((item) => normalize(item.values ?? []));
  }
  console.error("[embeddings] memory request rejected", 400);
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
    if (config.kind === "gemini") {
      const vectors = await geminiEmbeddings(config, texts, timeoutMs);
      if (!vectors || vectors.length !== texts.length || vectors.some((vector) => vector.length !== EMBEDDING_DIMENSION)) return null;
      return vectors;
    }
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
  const vectors = await embedForMemory([text.slice(0, 8000)], 10_000);
  const embedding = vectors?.[0];
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

  // Batch chunk embeddings so large uploads stay well within Worker subrequest limits.
  const BATCH_SIZE = 20;
  for (let start = 0; start < params.chunks.length; start += BATCH_SIZE) {
    const batch = params.chunks.slice(start, start + BATCH_SIZE);
    try {
      const vectors = await embedForMemory(batch.map((chunk) => chunk.content), 15_000);
      if (!vectors || vectors.length !== batch.length) {
        console.warn("[embeddings] batch returned unexpected length", vectors?.length ?? 0);
        continue;
      }

      const rows = batch
        .map((chunk, index) => ({
          user_id: params.userId,
          file_id: params.fileId,
          chunk_id: chunk.id,
          project_id: params.projectId,
          embedding: vectors[index],
          model
        }))
        .filter((row) => row.embedding?.length === EMBEDDING_DIMENSION);

      if (!rows.length) continue;

      const { error } = await supabase.from("file_chunk_embeddings").upsert(rows, { onConflict: "chunk_id" });
      if (error) {
        console.error("[embeddings] batch insert failed", error);
        continue;
      }
      embedded += rows.length;
    } catch (error) {
      console.error("[embeddings] chunk batch failed", error);
    }
  }

  return embedded;
}
