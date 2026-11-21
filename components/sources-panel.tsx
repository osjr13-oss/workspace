"use client";

import Link from "next/link";
import { Dialog } from "@/components/dialog";
import { removeEmDashes } from "@/lib/text";
import type { Citation } from "@/lib/types";

/**
 * Everything one answer relied on, in one place: web pages, the owner's files
 * and notes, memories, and the connected accounts it looked at. Opened from
 * "Sources" under the answer.
 */
export function SourcesPanel({ open, onClose, citations }: { open: boolean; onClose: () => void; citations: Citation[] }) {
  const sources = usableSources(citations);
  return (
    <Dialog open={open} onClose={onClose} title="Sources" description="What this answer is based on." side>
      <ol className="grid gap-1">
        {sources.map((citation) => (
          <li key={citation.marker} className="sources-row">
            <SourceRow citation={citation} />
          </li>
        ))}
      </ol>
    </Dialog>
  );
}

/** Citations worth listing: not the files attached to the question itself. */
export function usableSources(citations: Citation[]) {
  return citations.filter((citation) => !citation.marker.startsWith("attachment-"));
}

function SourceRow({ citation }: { citation: Citation }) {
  const number = /^\d+$/.test(citation.marker) ? `${citation.marker}.` : null;
  if (citation.kind === "web") {
    const date = citation.publishedAt ? new Date(citation.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
    return (
      <a href={citation.url} target="_blank" rel="noreferrer" className="sources-link">
        <span className="sources-number">{number}</span>
        <span className="min-w-0">
          <span className="sources-title">{removeEmDashes(citation.title)}</span>
          <span className="sources-meta">{[citation.publisher || hostOf(citation.url), date].filter(Boolean).join(", ")}</span>
          {citation.evidence || citation.snippet ? <span className="sources-snippet">{removeEmDashes(citation.evidence || citation.snippet).slice(0, 220)}</span> : null}
        </span>
      </a>
    );
  }
  if (citation.kind === "memory") {
    return (
      <Link href="/memory" className="sources-link">
        <span className="sources-number">{citation.marker}</span>
        <span className="min-w-0">
          <span className="sources-title">{removeEmDashes(citation.content)}</span>
          <span className="sources-meta">From your memory</span>
        </span>
      </Link>
    );
  }
  if (citation.kind === "tool") {
    return (
      <div className="sources-link">
        <span className="sources-number" aria-hidden="true" />
        <span className="min-w-0">
          <span className="sources-title">Looked at {removeEmDashes(citation.label).replace(/\bthe user's\b/g, "your")}</span>
        </span>
      </div>
    );
  }
  const page = citation.pageNumber ? `Page ${citation.pageNumber}` : null;
  return (
    <Link href={`/files/${citation.fileId}`} className="sources-link">
      <span className="sources-number">{number}</span>
      <span className="min-w-0">
        <span className="sources-title">{removeEmDashes(citation.fileName)}</span>
        <span className="sources-meta">{["Your file", page].filter(Boolean).join(", ")}</span>
      </span>
    </Link>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
