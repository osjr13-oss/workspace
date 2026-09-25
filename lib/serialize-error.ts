export function serializeError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}
