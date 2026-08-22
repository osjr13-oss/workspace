"use client";

import { useState } from "react";
import { Check, Copy, Sparkles, Wand2 } from "lucide-react";
import { removeEmDashes } from "@/lib/text";

const actions = [
  "Rewrite clearly",
  "Executive summary",
  "Expand ideas",
  "Action items",
  "Structured outline",
  "Draft email"
];

export function QuickActions({ initialText = "" }: { initialText?: string }) {
  const [text, setText] = useState(initialText);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function run(action: string) {
    if (!text.trim()) {
      setError("Please enter or paste text first.");
      return;
    }
    setLoading(action);
    setError("");
    setResult("");
    try {
      const response = await fetch("/api/ai/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text: removeEmDashes(text) })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "AI transform action failed.");
      setResult(removeEmDashes(payload.result));
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI transform action failed.");
    } finally {
      setLoading("");
    }
  }

  async function copyResult() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="panel p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Wand2 size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--text)]">Quick AI Transformations</h2>
            <p className="text-xs text-[var(--muted)]">Refine, summarize, or structure text instantly</p>
          </div>
        </div>
      </div>

      <textarea
        aria-label="Text to transform"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Paste a paragraph, note, meeting transcript, or raw thoughts..."
        className="textarea-enterprise mt-4 min-h-[110px] w-full text-sm leading-relaxed placeholder:text-[var(--muted)]"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => run(action)}
            disabled={Boolean(loading)}
            className={`btn-secondary min-h-[34px] px-3 text-xs ${
              loading === action ? "bg-slate-100 text-slate-400" : ""
            }`}
          >
            {loading === action ? "Working..." : action}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-3 text-xs font-semibold text-[var(--critical)]">{error}</p>
      )}

      {result && (
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-slate-50 p-4">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
            <span className="text-xs font-bold text-[var(--muted-strong)] uppercase tracking-wider">
              Result
            </span>
            <button
              type="button"
              onClick={copyResult}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-[var(--muted-strong)] hover:bg-slate-200/60"
            >
              {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">
            {result}
          </p>
        </div>
      )}
    </section>
  );
}
