"use client";

import { useId, useState } from "react";
import { ArrowRight, Check } from "lucide-react";

type Status = "idle" | "sending" | "joined" | "error";

export function WaitlistForm({
  tone = "light",
  className = "",
  autoFocus = false
}: {
  tone?: "light" | "dark";
  className?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const dark = tone === "dark";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not join the waitlist right now.");
      setStatus("joined");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not join the waitlist right now.");
    }
  }

  if (status === "joined") {
    return (
      <div
        role="status"
        className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 ${
          dark ? "border-white/15 bg-white/[0.06] text-white" : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
        } ${className}`}
      >
        <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${dark ? "bg-white text-[var(--accent)]" : "bg-[var(--accent)] text-[var(--on-accent)]"}`}>
          <Check size={14} strokeWidth={2.5} />
        </span>
        <div>
          <p className="text-[15px] font-semibold">You&apos;re on the list.</p>
          <p className={`mt-0.5 text-sm ${dark ? "text-white/70" : "text-[var(--muted-strong)]"}`}>We&apos;ll email you when Selrano opens.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={className} noValidate>
      <div
        className={`flex flex-col gap-2 rounded-[18px] border p-1.5 sm:flex-row sm:items-center sm:rounded-full ${
          dark
            ? "border-white/15 bg-white/[0.07] focus-within:border-white/40"
            : "border-[var(--border-strong)] bg-[var(--surface-strong)] shadow-[var(--shadow-tight)] focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_4px_var(--accent-soft-strong)]"
        } transition-[border-color,box-shadow]`}
      >
        <label htmlFor={id} className="sr-only">
          Email address
        </label>
        <input
          id={id}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus={autoFocus}
          required
          placeholder="you@school.edu"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (status === "error") setStatus("idle");
          }}
          aria-invalid={status === "error"}
          aria-describedby={`${id}-note`}
          className={`min-h-11 min-w-0 flex-1 bg-transparent px-4 text-[15px] outline-none ${
            dark ? "text-white placeholder:text-white/45" : "text-[var(--text)] placeholder:text-[var(--muted)]"
          }`}
        />
        <button type="submit" disabled={status === "sending"} className={dark ? "btn-invert" : "btn-primary"}>
          {status === "sending" ? "Joining" : "Join the waitlist"}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
      <p
        id={`${id}-note`}
        aria-live="polite"
        className={`mt-2.5 px-1 text-[13px] ${
          status === "error" ? (dark ? "font-medium text-[#ffb4ad]" : "font-medium text-[var(--critical)]") : dark ? "text-white/55" : "text-[var(--muted)]"
        }`}
      >
        {status === "error" ? message : "New accounts are paused for now. We will only use your email to tell you when Selrano opens."}
      </p>
    </form>
  );
}
