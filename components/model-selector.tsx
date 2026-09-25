"use client";

import { useEffect, useRef, useState } from "react";

export function ModelSelector({
  models,
  value,
  onChange
}: {
  models: string[];
  value: string;
  onChange: (model: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [open]);

  return (
    <div className="relative min-w-0" ref={rootRef}>
      <button
        type="button"
        className="flex max-w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm hover:bg-black/5"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate font-medium">{value}</span>
        <span aria-hidden className="text-xs text-[var(--muted)]">
          ▾
        </span>
      </button>
      {open ? (
        <ul className="absolute left-0 z-40 mt-1 w-80 max-w-[80vw] rounded-xl border border-[var(--line)] bg-[var(--paper)] p-1 shadow-lg" role="listbox">
          {models.map((model) => (
            <li key={model}>
              <button
                type="button"
                role="option"
                aria-selected={model === value}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-black/5"
                onClick={() => {
                  onChange(model);
                  setOpen(false);
                }}
              >
                <span className="truncate">{model}</span>
                {model === value ? <span className="text-[var(--muted)]">Selected</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
