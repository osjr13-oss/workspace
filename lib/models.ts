/** Real Groq chat model ids. Requests for anything else are rejected. */
export const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "meta-llama/llama-4-scout-17b-16e-instruct"
] as const;

export function allowedModels() {
  const models: string[] = [...GROQ_MODELS];
  const env = process.env.GROQ_MODEL?.trim();
  if (env && !models.includes(env)) models.unshift(env);
  return models;
}

export function configuredDefaultModel() {
  return process.env.GROQ_MODEL?.trim() || GROQ_MODELS[0];
}

export function resolveModel(requested?: string | null) {
  const model = requested?.trim() || configuredDefaultModel();
  if (!allowedModels().includes(model)) {
    throw new Error("That model is not available.");
  }
  return model;
}
