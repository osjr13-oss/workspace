"use client";

import { useId, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { ToolStep } from "@/lib/types";

/**
 * What a reply did before answering (searched email, read a page, checked the
 * calendar), as one quiet line above the answer that opens into the steps.
 * It stays with the answer after it is saved, so the owner can always see
 * what Selrano looked at.
 */
export function ActivityTrail({ steps, durationMs, sourceCount = 0, live = false }: { steps: ToolStep[]; durationMs?: number; sourceCount?: number; live?: boolean }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const labels = dedupe(steps.map((step) => step.label).filter(Boolean));
  if (!labels.length) return null;
  const seconds = durationMs ? Math.max(1, Math.round(durationMs / 1000)) : 0;
  const summary = labels.length <= 2 ? labels.join(", then ") : `${labels[0]}, then ${labels.length - 1} more steps`;
  return (
    <div className="activity-trail" data-live={live || undefined}>
      <button type="button" className="activity-trail-toggle" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((value) => !value)}>
        <ChevronRight size={14} className="activity-trail-chevron" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{summary}</span>
        <span className="activity-trail-meta">
          {sourceCount ? `${sourceCount} ${sourceCount === 1 ? "source" : "sources"}` : null}
          {sourceCount && seconds ? ", " : null}
          {seconds ? `${seconds}s` : null}
        </span>
      </button>
      {open ? (
        <ol id={listId} className="activity-trail-steps">
          {labels.map((label, index) => (
            <li key={`${index}-${label}`}>{label}</li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function dedupe(labels: string[]) {
  return labels.filter((label, index) => label !== labels[index - 1]);
}
