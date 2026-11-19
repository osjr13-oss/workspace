"use client";

import { useEffect, useState } from "react";

/**
 * The waiting line shown until a reply's first words arrive: a small mark of
 * three drifting dots and one word with a soft light passing through it.
 * While Selrano is only thinking, the word changes every few seconds; while it
 * uses a tool, it shows what it is doing (for example "Searching the web").
 */
const WORDS = ["Thinking", "Considering", "Sifting", "Weighing it up", "Putting it together"];
const WORD_MS = 2600;

export function ThinkingTrace({ label }: { label?: string | null }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (label) return;
    const id = window.setInterval(() => setIndex((value) => (value + 1) % WORDS.length), WORD_MS);
    return () => window.clearInterval(id);
  }, [label]);

  const text = label || WORDS[index];
  return (
    <div className={`thinking-line ${label ? "tool-status" : "thinking-orbit"}`} role="status" aria-live="polite">
      <svg className="thinking-mark" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
        <circle className="thinking-mark-dot thinking-mark-a" cx="5" cy="13" r="1.9" />
        <circle className="thinking-mark-dot thinking-mark-b" cx="10" cy="6" r="1.9" />
        <circle className="thinking-mark-dot thinking-mark-c" cx="15" cy="12" r="1.9" />
      </svg>
      <span key={text} className="thinking-word">
        {text}
      </span>
      {label ? null : <span className="sr-only">Selrano is thinking.</span>}
    </div>
  );
}
