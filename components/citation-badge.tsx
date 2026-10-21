"use client";

import type { Citation } from "@/lib/types";

export function CitationBadge({ citation }: { citation: Citation }) {
  if (citation.kind === "web") {
    return (
      <a
        href={citation.url}
        target="_blank"
        rel="noreferrer"
        title={`Open source: ${citation.title}`}
        className="citation-badge mx-0.5 inline-flex h-4 min-w-4 -translate-y-0.5 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-1 align-super text-[10px] font-extrabold leading-none text-[var(--muted-strong)] no-underline transition-all duration-[170ms] ease-out hover:-translate-y-1 hover:border-[var(--border-strong)] hover:bg-[var(--text)] hover:text-white"
      >
        {citation.marker}
      </a>
    );
  }

  // Files are no longer part of Selrano, so older file citations render as plain markers.
  const title = citation.pageNumber ? `${citation.fileName}, page ${citation.pageNumber}` : citation.fileName;

  return (
    <span
      title={title}
      className="citation-badge mx-0.5 inline-flex h-4 min-w-4 -translate-y-0.5 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-1 align-super text-[10px] font-extrabold leading-none text-[var(--muted-strong)]"
    >
      {citation.marker}
    </span>
  );
}
