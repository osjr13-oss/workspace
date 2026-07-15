"use client";

import Link from "next/link";
import { Suspense, use, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { WorkspaceHeader } from "@/components/workspace-header";
import { EmptyState } from "@/components/empty-state";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fileSize, formatDate } from "@/lib/format";
import type { WorkspaceFile } from "@/lib/types";

/**
 * PDF extraction (see extractText in app/api/files/upload/route.ts) inserts a
 * "\n" after nearly every text item, mirroring pdf-parse's own default line
 * detection — real prose ends up with a line break after almost every word.
 * Display-only reflow: collapse those into spaces while keeping genuine
 * paragraph gaps (2+ blank lines) as line breaks. Must never touch the
 * underlying text used to compute charStart/charEnd, only what's rendered.
 */
function reflowForDisplay(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/([^\n])\n(?!\n)/g, "$1 ");
}

export default function FileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense>
      <FileDetailContent params={params} />
    </Suspense>
  );
}

function FileDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const [file, setFile] = useState<WorkspaceFile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const highlightRef = useRef<HTMLElement>(null);

  const page = searchParams.get("page");
  const highlight = searchParams.get("highlight");
  const [highlightStartRaw, highlightEndRaw] = (highlight || "").split(",");
  const highlightStart = Number(highlightStartRaw);
  const highlightEnd = Number(highlightEndRaw);
  const hasHighlight = Number.isFinite(highlightStart) && Number.isFinite(highlightEnd) && highlightEnd > highlightStart;

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("files")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        setFile((data as WorkspaceFile) || null);
        setLoaded(true);
      });
  }, [id]);

  useEffect(() => {
    if (!hasHighlight) return;
    highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [hasHighlight, file]);

  if (!loaded) {
    return (
      <div className="mx-auto max-w-4xl space-y-7 px-5 py-8 sm:px-6 lg:py-10">
        <WorkspaceHeader title="Loading…" eyebrow="Files" />
      </div>
    );
  }

  if (!file) {
    return (
      <div className="mx-auto max-w-4xl space-y-7 px-5 py-8 sm:px-6 lg:py-10">
        <WorkspaceHeader title="File not found" eyebrow="Files" />
        <EmptyState title="File not found" description="This file may have been deleted, or it isn't yours to view." />
        <Link href="/files" className="btn-secondary inline-flex w-fit">
          <ArrowLeft size={16} /> Back to files
        </Link>
      </div>
    );
  }

  const text = file.extracted_text || "";
  const start = hasHighlight ? Math.max(0, Math.min(highlightStart, text.length)) : 0;
  const end = hasHighlight ? Math.max(start, Math.min(highlightEnd, text.length)) : 0;
  const before = hasHighlight ? text.slice(0, start) : text;
  const highlighted = hasHighlight ? text.slice(start, end) : "";
  const after = hasHighlight ? text.slice(end) : "";

  return (
    <div className="mx-auto max-w-4xl space-y-7 px-5 py-8 sm:px-6 lg:py-10">
      <div>
        <Link href="/files" className="mb-4 inline-flex items-center gap-2 text-xs font-bold text-[var(--muted)] hover:text-[var(--text)]">
          <ArrowLeft size={14} /> Back to files
        </Link>
        <WorkspaceHeader title={file.name} eyebrow="Source file" />
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="status-pill">{file.mime_type || "Unknown type"}</span>
          <span className="status-pill">{fileSize(file.size_bytes)}</span>
          <span className="status-pill">Uploaded {formatDate(file.created_at)}</span>
          {page ? <span className="status-pill">Page {page}</span> : null}
        </div>
      </div>

      {file.extraction_status !== "ready" || !text ? (
        <EmptyState
          title="No extracted text yet"
          description="This file hasn't finished processing, or its text couldn't be extracted."
        />
      ) : (
        <article className="panel whitespace-pre-wrap p-7 text-base leading-8 text-[var(--muted-strong)]">
          {reflowForDisplay(before)}
          {hasHighlight ? (
            <mark
              ref={highlightRef}
              className="rounded-md bg-[rgba(154,107,19,0.22)] px-0.5 text-[var(--text)] transition-colors duration-150"
            >
              {reflowForDisplay(highlighted)}
            </mark>
          ) : null}
          {reflowForDisplay(after)}
        </article>
      )}
    </div>
  );
}
