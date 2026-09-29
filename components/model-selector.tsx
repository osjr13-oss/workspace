"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

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
        className="group inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-100 focus:outline-none"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span>Lumen 1</span>
        <ChevronDown
          size={14}
          className={`text-neutral-400 transition-transform duration-150 group-hover:text-neutral-700 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div
          className="absolute left-0 z-30 mt-1.5 w-64 origin-top-left rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg"
          role="menu"
        >
          <div className="space-y-0.5">
            {MODELS.map((model) => (
              <div
                key={model.id}
                className="flex items-start justify-between gap-2 rounded-lg bg-neutral-50 p-2.5 text-left"
              >
                <div>
                  <p className="text-xs font-semibold text-neutral-900">
                    {model.name}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500 leading-normal">
                    {model.description}
                  </p>
                </div>
                <Check size={14} className="mt-0.5 text-neutral-900 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
