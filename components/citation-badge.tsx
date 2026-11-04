"use client";

import Link from "next/link";
import type { Citation } from "@/lib/types";

export function CitationBadge({ citation }: { citation: Citation }) {
  if (citation.kind === "web") {
    return (
      <a
        href={citation.url}
        target="_blank"
        rel="noreferrer"
        title={`Open source: ${citation.title}`}
        className="citation-badge mx-0.5 inline-flex h-[17px] min-w-[17px] -translate-y-0.5 items-center justify-center rounded-[5px] border border-[var(--accent-ring)] bg-[var(--accent-soft)] px-1 align-super text-[10px] font-semibold leading-none text-[var(--accent)] no-underline transition-colors duration-[160ms] ease-out hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--on-accent)]"
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
      className="citation-badge mx-0.5 inline-flex h-[17px] min-w-[17px] -translate-y-0.5 items-center justify-center rounded-[5px] border border-[var(--accent-ring)] bg-[var(--accent-soft)] px-1 align-super text-[10px] font-semibold leading-none text-[var(--accent)] no-underline transition-colors duration-[160ms] ease-out hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--on-accent)]"
    >
      {citation.marker}
    </Link>
  );
}
