"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, Sparkles } from "lucide-react";

type ModelOption = {
  id: string;
  name: string;
  description: string;
  tag: string;
  active: boolean;
};

const MODELS: ModelOption[] = [
  {
    id: "lumen-1",
    name: "Lumen 1",
    description: "Flagship thinking partner for exploring ideas and making decisions.",
    tag: "Active",
    active: true,
  },
];

export function ModelSelector() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="group inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3.5 py-1.5 text-xs font-extrabold text-[var(--text)] transition hover:border-[var(--border-strong)] hover:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="flex h-2 w-2 rounded-full bg-[var(--accent)]" />
        <span>Lumen 1</span>
        <ChevronDown
          size={13}
          className={`text-[var(--muted)] transition-transform duration-150 group-hover:text-[var(--text)] ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div
          className="absolute left-0 z-30 mt-2 w-72 origin-top-left rounded-2xl border border-[var(--border)] bg-[var(--background-elevated)] p-2 shadow-xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
          role="menu"
        >
          <div className="px-3 py-2 border-b border-[var(--border)]">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
              Model System
            </p>
          </div>

          <div className="mt-1 space-y-1">
            {MODELS.map((model) => (
              <div
                key={model.id}
                className="flex items-start justify-between gap-2 rounded-xl bg-[var(--surface-subtle)] p-3 text-left transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-[var(--text)]">
                      {model.name}
                    </span>
                    <span className="rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[9px] font-bold text-[var(--accent)]">
                      {model.tag}
                    </span>
                  </div>
                  <p className="text-[11px] leading-4 text-[var(--muted-strong)]">
                    {model.description}
                  </p>
                </div>
                <Check size={14} className="mt-0.5 text-[var(--accent)] shrink-0" />
              </div>
            ))}
          </div>

          <div className="mt-2 border-t border-[var(--border)] px-3 py-2">
            <p className="text-[10px] leading-relaxed text-[var(--muted)]">
              Future model iterations will appear here as releases graduate from testing.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
