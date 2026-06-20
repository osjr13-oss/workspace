"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

export function ProWaitlistForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (defaultEmail) setEmail(defaultEmail);
  }, [defaultEmail]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/waitlist/pro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, company })
    });

    const payload = await response.json();
    if (response.ok) {
      setConfirmed(true);
      setEmail("");
    } else {
      setError(payload.error || "Something went wrong. Try again.");
    }
    setLoading(false);
  }

  if (confirmed) {
    return (
      <div className="panel p-8 text-center sm:p-10">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[rgba(31,122,83,0.12)] text-[var(--low)]">
          <CheckCircle2 size={28} />
        </div>
        <h2 className="mt-6 text-2xl font-extrabold tracking-[-0.03em]">You&apos;re on the list</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[var(--muted-strong)]">
          We&apos;ll email you when Pro opens. Until then, the free plan has everything you need to get started.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="panel p-6 sm:p-8">
      <input
        type="text"
        name="company"
        value={company}
        onChange={(event) => setCompany(event.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
      />
      <label htmlFor="pro-waitlist-email" className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">
        Email address
      </label>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          id="pro-waitlist-email"
          className="input-premium min-h-12 flex-1 px-5"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
        />
        <button type="submit" className="btn-primary min-h-12 shrink-0 px-6" disabled={loading}>
          {loading ? "Joining…" : "Join waitlist"}
          {!loading ? <ArrowRight size={18} /> : null}
        </button>
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-[var(--muted)]">
        <Sparkles size={14} />
        No spam — one email when Pro launches. Unsubscribe anytime.
      </p>
      {error ? <p className="mt-4 text-sm font-bold text-[var(--critical)]">{error}</p> : null}
    </form>
  );
}
