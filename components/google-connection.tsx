"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Mail } from "lucide-react";

type Status = { configured: boolean; connected: boolean; email: string | null };

const RESULT_MESSAGES: Record<string, string> = {
  connected: "Google is connected. Ask about your email or calendar in any chat.",
  cancelled: "Connecting Google was cancelled.",
  failed: "Google could not be connected. Please try again.",
  not_configured: "Google is not set up on the server yet."
};

/** Settings panel: connect or disconnect the owner's Gmail and Google Calendar. */
export function GoogleConnection() {
  const [status, setStatus] = useState<Status | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("google");
    if (result && RESULT_MESSAGES[result]) setMessage(RESULT_MESSAGES[result]);
    fetch("/api/integrations/google")
      .then((response) => response.json())
      .then((payload: Status) => setStatus(payload))
      .catch(() => setStatus({ configured: false, connected: false, email: null }));
  }, []);

  async function disconnect() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/integrations/google", { method: "DELETE" });
      if (!response.ok) throw new Error();
      setStatus((current) => (current ? { ...current, connected: false, email: null } : current));
      setMessage("Google is disconnected. Selrano can no longer see your email or calendar.");
    } catch {
      setMessage("Could not disconnect Google. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel p-6" aria-label="Connected accounts">
      <h2 className="text-base font-semibold tracking-[-0.01em]">Connected accounts</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
        Connect Google so Selrano can search and read your email, check your calendar, save email drafts for you to send, and add events you
        confirm. It never sends email on its own.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex shrink-0 gap-1 text-[var(--accent)]" aria-hidden="true">
            <Mail size={17} />
            <CalendarDays size={17} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Gmail and Google Calendar</p>
            <p className="truncate text-[13px] text-[var(--muted)]">
              {!status
                ? "Checking…"
                : status.connected
                  ? `Connected${status.email ? ` as ${status.email}` : ""}`
                  : status.configured
                    ? "Not connected"
                    : "Not set up on the server yet"}
            </p>
          </div>
        </div>
        {status?.connected ? (
          <button type="button" className="btn-secondary btn-sm" onClick={disconnect} disabled={busy}>
            {busy ? "Disconnecting" : "Disconnect"}
          </button>
        ) : status?.configured ? (
          <a href="/api/integrations/google/start" className="btn-primary btn-sm">
            Connect Google
          </a>
        ) : null}
      </div>
      {message ? <p className="mt-3 text-sm font-medium text-[var(--muted-strong)]">{message}</p> : null}
    </section>
  );
}
