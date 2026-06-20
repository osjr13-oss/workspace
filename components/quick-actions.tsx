"use client";

import { useState } from "react";
import { Wand2 } from "lucide-react";

const actions = ["Rewrite", "Summarize", "Expand", "Sharpen", "Turn into outline", "Extract action items", "Draft follow-up email", "Turn into client brief"];

export function QuickActions({ initialText = "" }: { initialText?: string }) {
  const [text, setText] = useState(initialText);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");

  async function run(action: string) {
    if (!text.trim()) {
      setError("Add text first.");
      return;
    }
    setLoading(action);
    setError("");
    setResult("");
    try {
      const response = await fetch("/api/ai/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "AI action failed.");
      setResult(payload.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI action failed.");
    } finally {
      setLoading("");
    }
  }

  return (
    <section className="panel p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--text)] text-white">
          <Wand2 size={18} />
        </span>
        <div>
          <h2 className="text-base font-extrabold tracking-[-0.01em]">Quick actions</h2>
          <p className="text-sm text-[var(--muted)]">Turn messy client notes into usable drafts without leaving the workspace.</p>
        </div>
      </div>
      <textarea
        aria-label="Text to transform"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Paste meeting notes, client feedback, research, or a rough draft..."
        className="mt-5 min-h-32 w-full rounded-[18px] border border-[var(--border)] bg-white/70 p-4 text-sm leading-6 outline-none focus:border-[var(--border-strong)]"
      />
      <div className="mt-4 flex flex-wrap gap-2">
        {actions.map((action) => (
          <button key={action} type="button" onClick={() => run(action)} className="btn-secondary min-h-10 px-4 text-sm">
            {loading === action ? "Working" : action}
          </button>
        ))}
      </div>
      {error ? <p className="mt-4 text-sm font-bold text-[var(--critical)]">{error}</p> : null}
      {result ? <pre className="mt-5 whitespace-pre-wrap rounded-[18px] border border-[var(--border)] bg-white/70 p-4 text-sm leading-6">{result}</pre> : null}
    </section>
  );
}
