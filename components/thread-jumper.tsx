"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatThread } from "@/lib/types";

export function ThreadJumper({
  open,
  threads,
  onClose,
  onSelect
}: {
  open: boolean;
  threads: ChatThread[];
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return threads;
    return threads.filter((thread) => thread.title.toLowerCase().includes(needle));
  }, [query, threads]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  if (!open) return null;

  function choose(id: string) {
    onSelect(id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-black/30 px-4 pt-[15vh]" onMouseDown={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)] shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          aria-label="Jump to a thread"
          className="w-full border-b border-[var(--line)] bg-transparent px-4 py-3 outline-none"
          placeholder="Jump to a thread"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIndex((current) => Math.min(current + 1, Math.max(matches.length - 1, 0)));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setIndex((current) => Math.max(current - 1, 0));
            } else if (event.key === "Enter" && matches[index]) {
              event.preventDefault();
              choose(matches[index].id);
            } else if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
          }}
        />
        <ul className="max-h-72 overflow-auto p-1">
          {matches.length ? (
            matches.map((thread, itemIndex) => (
              <li key={thread.id}>
                <button
                  type="button"
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${itemIndex === index ? "bg-black/5" : ""}`}
                  onMouseEnter={() => setIndex(itemIndex)}
                  onClick={() => choose(thread.id)}
                >
                  {thread.title}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-6 text-sm text-[var(--muted)]">No conversations yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
