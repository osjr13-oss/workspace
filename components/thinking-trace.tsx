"use client";

import { AudioLines, Feather, MoveRight, Waypoints } from "lucide-react";

const phases = [
  { label: "Reading your intent", icon: AudioLines },
  { label: "Connecting what matters", icon: Waypoints },
  { label: "Finding the cleanest words", icon: Feather }
] as const;

export function ThinkingTrace() {
  return (
    <div className="thinking-trace" role="status" aria-live="polite">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--muted)]">
        Lumen is thinking
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {phases.map((phase, index) => {
          const Icon = phase.icon;
          return (
            <div key={phase.label} className="contents">
              <span
                className="thinking-phase inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold text-[var(--muted-strong)]"
                data-phase={index}
              >
                <Icon size={15} strokeWidth={1.8} />
                {phase.label}
              </span>
              {index < phases.length - 1 ? (
                <MoveRight size={14} className="text-[var(--border-strong)]" aria-hidden="true" />
              ) : null}
            </div>
          );
        })}
      </div>
      <span className="sr-only">Preparing a response.</span>
    </div>
  );
}
