"use client";

export function ThinkingTrace() {
  return (
    <div className="py-2 flex items-center gap-2 text-xs text-neutral-500" role="status" aria-live="polite">
      <div className="h-1.5 w-1.5 rounded-full bg-neutral-400 animate-pulse" />
      <span>Selrano is thinking...</span>
    </div>
  );
}
