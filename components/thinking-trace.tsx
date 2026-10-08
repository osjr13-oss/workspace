"use client";

/**
 * Compact waiting indicator: a thin ring with a bright arc that sweeps around
 * it and a small dot orbiting the opposite way. Pure CSS, no text.
 */
export function ThinkingTrace() {
  return (
    <div className="thinking-orbit" role="status" aria-live="polite">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <circle className="thinking-orbit-track" cx="12" cy="12" r="9" fill="none" strokeWidth="2" />
        <circle className="thinking-orbit-arc" cx="12" cy="12" r="9" fill="none" strokeWidth="2" strokeLinecap="round" />
        <g className="thinking-orbit-dot">
          <circle cx="12" cy="6" r="1.6" />
        </g>
      </svg>
      <span className="sr-only">Selrano is thinking.</span>
    </div>
  );
}
