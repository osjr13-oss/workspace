"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Share2 } from "lucide-react";

type SeedDeckStatus = {
  slug: string;
  name: string;
  urlPath: string;
  published: boolean;
};

export function PublishStarterDecks() {
  const [decks, setDecks] = useState<SeedDeckStatus[]>([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/seed/public-decks");
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(payload.error || "Could not check starter decks.");
        return;
      }
      setDecks(payload.decks || []);
      setReady(Boolean(payload.ready));
    } catch {
      setMessage("Could not check starter decks.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function publish() {
    setWorking(true);
    setMessage("");
    try {
      const res = await fetch("/api/seed/public-decks", { method: "POST" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(payload.error || "Could not publish starter decks.");
        return;
      }
      setMessage(payload.message || "Starter decks published.");
      await refresh();
    } catch {
      setMessage("Could not publish starter decks.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="panel p-6">
      <h2 className="flex items-center gap-2 text-base font-extrabold tracking-[-0.01em]">
        <Share2 size={18} />
        Starter decks for classmates
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
        Publish 8 free public study decks (Psych, Calc, Bio, CS, Chem, History, Econ, Spanish) so you have real links to share while getting your first users.
      </p>

      {loading ? <p className="mt-4 text-sm text-[var(--muted)]">Checking publish status…</p> : null}

      {!loading && ready ? (
        <p className="mt-4 flex items-center gap-2 text-sm font-bold text-[var(--low)]">
          <CheckCircle2 size={16} />
          Starter decks are live.
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" className="btn-primary" onClick={publish} disabled={working || loading}>
          {working ? "Publishing…" : ready ? "Refresh starter decks" : "Publish starter decks"}
        </button>
      </div>

      {message ? <p className="mt-4 text-sm font-bold text-[var(--muted-strong)]">{message}</p> : null}

      {decks.length ? (
        <ul className="mt-5 space-y-2">
          {decks.map((deck) => (
            <li key={deck.slug} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-bold">{deck.name}</span>
              {deck.published ? (
                <a href={deck.urlPath} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-[var(--muted)] hover:text-[var(--text)]">
                  {deck.urlPath}
                  <ExternalLink size={14} />
                </a>
              ) : (
                <span className="text-[var(--muted)]">Not published yet</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
