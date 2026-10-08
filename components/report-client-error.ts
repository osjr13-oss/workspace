export function reportClientError(error: Error & { digest?: string }) {
  try {
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: error.message, digest: error.digest, path: window.location.pathname }),
      keepalive: true
    });
  } catch {
    // Reporting must never throw.
  }
}
