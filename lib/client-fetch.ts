export async function fetchJsonWithTimeout<T>(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<{ ok: boolean; status: number; data: T | null; error: string | null }> {
  const { timeoutMs = 180_000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, { ...rest, signal: controller.signal });
    const text = await response.text();
    let data: T | null = null;
    try {
      data = text ? (JSON.parse(text) as T) : null;
    } catch {
      return {
        ok: false,
        status: response.status,
        data: null,
        error:
          response.status === 504 || response.status === 502
            ? "Server timed out. Please retry in a moment."
            : "Unexpected server response. Please try again."
      };
    }

    const payload = data as { error?: string } | null;
    return {
      ok: response.ok,
      status: response.status,
      data,
      error: response.ok ? null : payload?.error || `Request failed (${response.status})`
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        status: 408,
        data: null,
        error: "Request timed out. Please retry in a moment."
      };
    }
    return { ok: false, status: 0, data: null, error: "Network error. Check your connection and try again." };
  } finally {
    clearTimeout(timer);
  }
}
