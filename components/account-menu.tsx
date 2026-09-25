"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type NoteItem = { id: string; title: string };
type DeckItem = { id: string; name: string };
type Billing = { pro: boolean; priceLabel: string; status: string; canManage: boolean };

export function AccountMenu({
  open,
  email,
  configured,
  onClose,
  onSignOut
}: {
  open: boolean;
  email: string | null;
  configured: boolean;
  onClose: () => void;
  onSignOut: () => void;
}) {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [decks, setDecks] = useState<DeckItem[]>([]);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [lifecycle, setLifecycle] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !configured || !email) return;
    let cancelled = false;
    (async () => {
      const [notesResponse, billingResponse, mailResponse] = await Promise.all([
        fetch("/api/account/library"),
        fetch("/api/billing/status"),
        fetch("/api/account/email-preferences")
      ]);
      if (cancelled) return;
      if (notesResponse.ok) {
        const payload = (await notesResponse.json()) as { notes?: NoteItem[]; decks?: DeckItem[] };
        setNotes(payload.notes || []);
        setDecks(payload.decks || []);
      }
      if (billingResponse.ok) setBilling((await billingResponse.json()) as Billing);
      if (mailResponse.ok) {
        const payload = (await mailResponse.json()) as { lifecycleEmails?: boolean };
        setLifecycle(payload.lifecycleEmails === true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, configured, email]);

  async function checkout() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/billing/checkout", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        setMessage(payload.error || "Checkout could not start.");
        return;
      }
      window.location.href = payload.url;
    } finally {
      setBusy(false);
    }
  }

  async function portal() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        setMessage(payload.error || "Billing portal could not open.");
        return;
      }
      window.location.href = payload.url;
    } finally {
      setBusy(false);
    }
  }

  async function toggleMail(next: boolean) {
    setLifecycle(next);
    const response = await fetch("/api/account/email-preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lifecycleEmails: next })
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setLifecycle(!next);
      setMessage(payload.error || "Could not save email settings.");
    }
  }

  if (!open) return null;

  return (
    <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-3 text-sm shadow-lg">
      <p className="px-1 text-xs text-[var(--muted)]">{email || "Not signed in"}</p>
      {!configured ? <p className="mt-3 px-1 text-[var(--muted)]">Sign in is not configured.</p> : null}
      {configured && !email ? (
        <Link href="/signin" className="mt-3 block rounded-lg px-2 py-2 hover:bg-black/5" onClick={onClose}>
          Sign in
        </Link>
      ) : null}

      {email ? (
        <>
          <section className="mt-3">
            <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Notes</h2>
            <ul className="mt-1 max-h-28 overflow-auto">
              {notes.length ? (
                notes.map((note) => (
                  <li key={note.id}>
                    <Link href={`/notes/${note.id}`} className="block truncate rounded-lg px-2 py-1.5 hover:bg-black/5" onClick={onClose}>
                      {note.title}
                    </Link>
                  </li>
                ))
              ) : (
                <li className="px-2 py-1.5 text-[var(--muted)]">No notes yet.</li>
              )}
            </ul>
          </section>
          <section className="mt-2">
            <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Flashcards</h2>
            <ul className="mt-1 max-h-28 overflow-auto">
              {decks.length ? (
                decks.map((deck) => (
                  <li key={deck.id}>
                    <Link href={`/flashcards/${deck.id}`} className="block truncate rounded-lg px-2 py-1.5 hover:bg-black/5" onClick={onClose}>
                      {deck.name}
                    </Link>
                  </li>
                ))
              ) : (
                <li className="px-2 py-1.5 text-[var(--muted)]">No decks yet.</li>
              )}
            </ul>
          </section>
          <section className="mt-3 border-t border-[var(--line)] pt-3">
            <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Billing</h2>
            <p className="mt-1 px-1">
              {billing?.pro ? "Pro is active." : `Free. Pro is ${billing?.priceLabel || "$6.99/month"}.`}
            </p>
            <div className="mt-2 flex gap-2 px-1">
              {billing?.pro ? null : (
                <button type="button" className="rounded-full bg-[var(--ink)] px-3 py-1.5 text-white disabled:opacity-60" onClick={checkout} disabled={busy}>
                  Upgrade
                </button>
              )}
              <button type="button" className="rounded-full border border-[var(--line)] px-3 py-1.5 disabled:opacity-60" onClick={portal} disabled={busy || !billing?.canManage}>
                Manage billing
              </button>
            </div>
          </section>
          <label className="mt-3 flex items-start gap-2 border-t border-[var(--line)] px-1 pt-3">
            <input type="checkbox" checked={lifecycle} onChange={(event) => toggleMail(event.target.checked)} />
            <span>Email me occasional notes about the chat. Welcome mail is separate.</span>
          </label>
          <button type="button" className="mt-3 w-full rounded-lg px-2 py-2 text-left hover:bg-black/5" onClick={onSignOut}>
            Sign out
          </button>
        </>
      ) : null}
      {message ? <p className="mt-2 px-1 text-red-700">{message}</p> : null}
    </div>
  );
}
