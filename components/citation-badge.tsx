"use client";

import Link from "next/link";
import type { Citation } from "@/lib/types";

export function CitationBadge({ citation }: { citation: Citation }) {
  if (citation.kind === "memory") {
    return (
      <Link
        href={`/memory#${citation.memoryId}`}
        title={`From memory: ${citation.content}`}
        aria-label={`From memory: ${citation.content}`}
        className="citation-badge mx-0.5 inline-flex h-[17px] -translate-y-[2px] items-center justify-center rounded-[5px] border border-[var(--border-strong)] bg-[var(--surface-sunken)] px-1.5 align-baseline text-[10.5px] font-medium leading-none text-[var(--muted-strong)] no-underline transition-colors duration-[160ms] ease-out hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        Memory
      </Link>
    );
  }

  if (citation.kind === "web") {
    return (
      <a
        href={citation.url}
        target="_blank"
        rel="noreferrer"
        title={`Open source: ${citation.title}`}
        className="citation-badge mx-0.5 inline-flex h-[17px] min-w-[17px] -translate-y-[2px] items-center justify-center rounded-[5px] border border-[var(--accent-ring)] bg-[var(--accent-soft-strong)] px-1 align-baseline text-[10.5px] font-semibold leading-none text-[var(--accent)] no-underline transition-colors duration-[160ms] ease-out hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--on-accent)]"
      >
        {citation.marker}
      </a>
    );
  }

  const hasRange = citation.charStart !== null && citation.charEnd !== null;
  const href = hasRange
    ? `/files/${citation.fileId}?highlight=${citation.charStart},${citation.charEnd}${citation.pageNumber ? `&page=${citation.pageNumber}` : ""}`
    : `/files/${citation.fileId}`;
  const title = citation.pageNumber ? `${citation.fileName}, page ${citation.pageNumber}` : citation.fileName;

  return (
    <Link
      href={href}
      title={`Jump to source: ${title}`}
      className="citation-badge mx-0.5 inline-flex h-[17px] min-w-[17px] -translate-y-[2px] items-center justify-center rounded-[5px] border border-[var(--accent-ring)] bg-[var(--accent-soft-strong)] px-1 align-baseline text-[10.5px] font-semibold leading-none text-[var(--accent)] no-underline transition-colors duration-[160ms] ease-out hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--on-accent)]"
    >
      {citation.marker}
    </Link>
  );
}
