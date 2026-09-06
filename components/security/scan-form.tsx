"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Globe2, Loader2 } from "lucide-react";

export function ScanForm({ initialUrl = "" }: { initialUrl?: string }) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, authorized }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Could not start the scan.");
      router.push(`/scans/${payload.scanId}`);
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not connect. Please try again.",
      );
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <label htmlFor="scan-url" className="text-sm font-bold">
        Website URL
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Globe2
            size={18}
            className="pointer-events-none absolute left-5 top-4 text-[var(--muted)]"
          />
          <input
            id="scan-url"
            name="url"
            type="text"
            inputMode="url"
            autoComplete="url"
            maxLength={2048}
            required
            placeholder="https://your-site.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={busy}
            className="input-premium w-full pl-12 pr-5"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !authorized}
          className="btn-primary shrink-0 disabled:opacity-50"
        >
          {busy ? <Loader2 size={17} className="animate-spin" /> : null}
          {busy ? "Scanning your site" : "Scan website"}
          {!busy && <ArrowRight size={17} />}
        </button>
      </div>
      <label className="flex items-start gap-3 text-xs leading-5 text-[var(--muted-strong)]">
        <input
          type="checkbox"
          checked={authorized}
          onChange={(e) => setAuthorized(e.target.checked)}
          required
          disabled={busy}
          className="mt-0.5 h-4 w-4 accent-[var(--text)]"
        />
        I own this website or have permission to scan it.
      </label>
      {busy && (
        <p role="status" className="text-sm text-[var(--muted)]">
          Reading public pages and checking security signals. This can take up
          to a minute.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-[var(--critical)]">
          {error}
        </p>
      )}
    </form>
  );
}
