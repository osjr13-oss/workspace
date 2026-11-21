"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FileText, MessageSquare, NotebookPen, Search } from "lucide-react";
import { Dialog } from "@/components/dialog";
import type { SearchResult } from "@/app/api/search/route";

const ICONS = { chat: MessageSquare, note: NotebookPen, file: FileText } as const;
const KIND_LABEL = { chat: "Chat", note: "Note", file: "File" } as const;

/** Search everything: Cmd+K (Ctrl+K) anywhere in the app, or the Search button in the sidebar. */
export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const request = ++requestRef.current;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(text)}`);
        const payload = (await response.json().catch(() => ({}))) as { results?: SearchResult[] };
        if (request !== requestRef.current) return;
        setResults(payload.results || []);
        setActive(0);
      } finally {
        if (request === requestRef.current) setLoading(false);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  function go(result: SearchResult | undefined) {
    if (!result) return;
    onClose();
    router.push(result.href);
  }

  return (
    <Dialog open={open} onClose={onClose} title="Search" size="md">
      <div className="search-box">
        <Search size={16} className="shrink-0 text-[var(--muted)]" aria-hidden="true" />
        <input
          data-autofocus
          aria-label="Search chats, notes and files"
          placeholder="Search chats, notes and files"
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--muted)]"
          value={query}
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="search-results"
          aria-activedescendant={results[active] ? `search-result-${active}` : undefined}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index) => Math.min(results.length - 1, index + 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => Math.max(0, index - 1));
            } else if (event.key === "Enter") {
              event.preventDefault();
              go(results[active]);
            }
          }}
        />
      </div>
      <ul id="search-results" role="listbox" aria-label="Results" className="mt-3 max-h-[min(60vh,28rem)] overflow-y-auto">
        {results.map((result, index) => {
          const Icon = ICONS[result.kind];
          return (
            <li
              key={`${result.kind}-${result.id}`}
              id={`search-result-${index}`}
              role="option"
              aria-selected={index === active}
              className={`search-result ${index === active ? "search-result-active" : ""}`}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                go(result);
              }}
            >
              <Icon size={15} className="mt-0.5 shrink-0 text-[var(--accent)]" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-medium text-[var(--text)]">{result.title}</span>
                {result.snippet ? <span className="mt-0.5 block text-[13px] leading-5 text-[var(--muted-strong)]">{result.snippet}</span> : null}
              </span>
              <span className="shrink-0 text-[12px] text-[var(--muted)]">{KIND_LABEL[result.kind]}</span>
            </li>
          );
        })}
      </ul>
      {query.trim().length >= 2 && !loading && !results.length ? <p className="mt-3 text-sm text-[var(--muted)]">Nothing found for that.</p> : null}
      <p className="mt-4 text-[12.5px] text-[var(--muted)]">Arrow keys to move, Enter to open, Esc to close.</p>
    </Dialog>
  );
}
