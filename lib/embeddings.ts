import type { SupabaseClient } from "@supabase/supabase-js";

const EMBEDDING_DIMENSION = 1536;

export function hasEmbeddingProvider() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function getEmbeddingModel() { return "gemini-embedding-001"; }

export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is required");
  const base = process.env.GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com/v1beta";
  const response = await fetch(`${base}/models/${getEmbeddingModel()}:embedContent`, {
    method: "POST", headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({ model: `models/${getEmbeddingModel()}`, content: { parts: [{ text: text.slice(0, 8000) }] }, outputDimensionality: EMBEDDING_DIMENSION })
  });
  if (!response.ok) throw new Error(`Gemini embedding request failed (${response.status})`);
  const payload = await response.json() as { embedding?: { values?: number[] } };
  const values = payload.embedding?.values;
  if (!values || values.length !== EMBEDDING_DIMENSION || !values.every(Number.isFinite)) throw new Error("Invalid Gemini embedding");
  const norm = Math.hypot(...values);
  if (!norm) throw new Error("Empty Gemini embedding");
  return values.map((v) => v / norm);
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
