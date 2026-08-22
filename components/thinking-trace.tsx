"use client";

import { Brain, Sparkles, Waypoints } from "lucide-react";

export function ThinkingTrace() {
  return (
    <div
      className="my-4 flex w-fit items-center gap-3 rounded-xl border border-[var(--border)] bg-slate-50/80 px-4 py-2.5 shadow-xs"
      role="status"
      aria-live="polite"
    >
      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-white">
        <Brain size={13} className="animate-pulse" />
      </div>
      <div className="flex items-center gap-2 text-xs font-semibold text-[var(--muted-strong)]">
        <span className="inline-block h-2 w-2 animate-ping rounded-full bg-slate-900" />
        <span>Thinking & synthesizing grounded memory...</span>
      </div>
      <span className="sr-only">Selrano is preparing a response</span>
    </div>
  );
}
