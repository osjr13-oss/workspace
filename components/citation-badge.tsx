"use client";

import Link from "next/link";
import { Globe, FileText } from "lucide-react";
import type { Citation } from "@/lib/types";

export function CitationBadge({ citation }: { citation: Citation }) {
  if (citation.kind === "web") {
    return (
      <a
        href={citation.url}
        target="_blank"
        rel="noreferrer"
        title={`Web Source: ${citation.title}`}
        className="mx-0.5 inline-flex h-4 min-w-4 -translate-y-0.5 items-center justify-center gap-0.5 rounded-full border border-blue-200 bg-blue-50 px-1.5 align-super text-[10px] font-bold leading-none text-blue-700 no-underline transition hover:bg-blue-600 hover:text-white"
      >
        <Globe size={9} />
        <span>{citation.marker}</span>
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
      title={`File Source: ${title}`}
      className="mx-0.5 inline-flex h-4 min-w-4 -translate-y-0.5 items-center justify-center gap-0.5 rounded-full border border-slate-300 bg-slate-100 px-1.5 align-super text-[10px] font-bold leading-none text-slate-700 no-underline transition hover:bg-slate-900 hover:text-white"
    >
      <FileText size={9} />
      <span>{citation.marker}</span>
    </Link>
  );
}
