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
            ? "Server timed out. Try a shorter recording (under 2 minutes) or retry in a moment."
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
        error: "Request timed out. Long recordings can take a few minutes — we are improving this. Try under 2 minutes for now."
      };
    }
    return { ok: false, status: 0, data: null, error: "Network error. Check your connection and try again." };
  } finally {
    clearTimeout(timer);
  }
}

export async function pollTranscriptionStatus(sessionId: string, options?: { maxWaitMs?: number; intervalMs?: number }) {
  const maxWaitMs = options?.maxWaitMs ?? 600_000;
  const intervalMs = options?.intervalMs ?? 2000;
  const started = Date.now();

  while (Date.now() - started < maxWaitMs) {
    const result = await fetchJsonWithTimeout<{
      status: string;
      transcription?: string;
      error?: string;
    }>(`/api/ai/transcribe/status?sessionId=${encodeURIComponent(sessionId)}`, { timeoutMs: 15_000 });

    if (!result.ok || !result.data) {
      return { ok: false as const, error: result.error || "Could not check transcription status." };
    }

    if (result.data.status === "transcribed") {
      return { ok: true as const, transcription: result.data.transcription || "", sessionId };
    }

    if (result.data.status === "failed") {
      return { ok: false as const, error: result.data.error || "Transcription failed." };
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return {
    ok: false as const,
    error: "Transcription is taking longer than expected. It may still be processing — refresh and check Notes later, or retry with a shorter clip."
  };
}
