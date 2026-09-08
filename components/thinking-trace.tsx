"use client";

import { AudioLines, Feather, MoveRight, Waypoints } from "lucide-react";

const phases = [
  { label: "Reading your intent", icon: AudioLines },
  { label: "Connecting what matters", icon: Waypoints },
  { label: "Finding the cleanest words", icon: Feather }
] as const;

export function ThinkingTrace() {
  return (
    <div
      className="relative rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/[0.06] via-stone-500/[0.04] to-amber-500/[0.06] p-4 sm:p-5 shadow-xs backdrop-blur-md"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
        </span>
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-amber-900">
          Lumen 1 is reasoning
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {phases.map((phase, index) => {
          const Icon = phase.icon;
          return (
            <div key={phase.label} className="contents">
              <span
                className="thinking-phase inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/80 px-3 py-1.5 text-xs font-bold text-[var(--muted-strong)] shadow-2xs"
                data-phase={index}
              >
                <Icon size={14} strokeWidth={2} className="text-amber-600" />
                {phase.label}
              </span>
              {index < phases.length - 1 ? (
                <MoveRight size={13} className="text-[var(--border-strong)]" aria-hidden="true" />
              ) : null}
            </div>
          );
        })}
      </div>
      <span className="sr-only">Preparing a response.</span>
    </div>
  );
}
