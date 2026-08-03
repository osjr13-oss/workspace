"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, Send, CheckCircle2 } from "lucide-react";

const DEMO_RESPONSES: Record<string, string> = {
  default: "I have reviewed your project context. I will keep responses grounded strictly in your source materials, using your natural formatting tone and preferences without unnecessary filler.",
  summary: "Here is a structured overview based on your notes: 1. Core Objectives defined. 2. Key Action Items prioritized. 3. Sourced facts retained with zero speculation.",
  study: "Card 1: What is Selrano? An adaptive personal AI workspace for projects, notes, files, grounded chat, and review."
};

export function LandingSandbox() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleDemo(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    setOutput(null);

    setTimeout(() => {
      const text = input.toLowerCase();
      if (text.includes("summary") || text.includes("notes")) {
        setOutput(DEMO_RESPONSES.summary);
      } else if (text.includes("card") || text.includes("flash")) {
        setOutput(DEMO_RESPONSES.study);
      } else {
        setOutput(`Grounding answer for "${input}": ${DEMO_RESPONSES.default}`);
      }
      setLoading(false);
    }, 600);
  }

  return (
    <div id="sandbox" className="mx-auto max-w-4xl px-5 py-12 sm:px-6">
      <div className="panel p-6 sm:p-8 bg-[var(--background-elevated)] border border-[var(--border-strong)] shadow-xl rounded-3xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 rounded-full bg-[var(--low)]" />
            <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">
              Interactive Preview
            </span>
          </div>
          <span className="status-pill text-xs">Try without an account</span>
        </div>

        <h2 className="mt-4 text-2xl font-extrabold tracking-[-0.02em] text-[var(--text)]">
          Experience adaptive AI in action
        </h2>
        <p className="mt-1 text-sm text-[var(--muted-strong)]">
          Ask a question or test how Selrano works with your ideas:
        </p>

        <form onSubmit={handleDemo} className="mt-5 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g., How does Selrano adapt to my writing style?"
            className="input-premium flex-1 px-5 text-sm"
          />
          <button type="submit" disabled={loading || !input.trim()} className="btn-primary shrink-0 px-5">
            {loading ? <Sparkles size={18} className="animate-spin" /> : <Send size={18} />}
            <span className="hidden sm:inline">Test</span>
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--muted)] font-bold">
          <span>Quick prompts:</span>
          {["How does context work?", "Draft a summary from my notes", "Create flashcards"].map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => {
                setInput(prompt);
              }}
              className="hover:underline text-[var(--text)] text-left"
            >
              &quot;{prompt}&quot;
            </button>
          ))}
        </div>

        {output ? (
          <div className="mt-6 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-subtle)] p-5 animate-fadeIn">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[var(--text)]">
              <CheckCircle2 size={16} className="text-[var(--low)]" />
              Selrano Adaptive Output
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text)]">{output}</p>
            <div className="mt-5 flex items-center justify-between border-t border-[var(--border)] pt-4">
              <span className="text-xs text-[var(--muted)]">Ready for real files and memory retention?</span>
              <Link href="/signup" className="btn-primary text-xs py-2 px-4">
                Save workspace & continue free
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
