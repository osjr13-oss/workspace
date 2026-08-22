"use client";

import Link from "next/link";
import { Suspense, use, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { WorkspaceHeader } from "@/components/workspace-header";
import { EmptyState } from "@/components/empty-state";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fileSize, formatDate } from "@/lib/format";
import type { WorkspaceFile } from "@/lib/types";

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
      <div className="mx-auto max-w-4xl space-y-7 px-5 py-8 sm:px-8">
        <WorkspaceHeader title="Loading file..." eyebrow="Files" />
        <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (!file) {
    return (
      <div className="mx-auto max-w-4xl space-y-7 px-5 py-8 sm:px-8">
        <WorkspaceHeader title="File not found" eyebrow="Files" />
        <EmptyState title="File not found" description="This file may have been deleted, or it is not yours to view." />
        <Link href="/files" className="btn-secondary inline-flex w-fit">
          <ArrowLeft size={15} />
          <span>Back to files</span>
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
    <div className="mx-auto max-w-4xl space-y-8 px-5 py-8 sm:px-8">
      <div>
        <Link href="/files" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)]">
          <ArrowLeft size={13} />
          <span>Back to files</span>
        </Link>
        <WorkspaceHeader title={file.name} eyebrow="Source Material" />
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="badge badge-subtle">{file.mime_type || "Document"}</span>
          <span className="badge badge-subtle">{fileSize(file.size_bytes)}</span>
          <span className="badge badge-subtle">Uploaded {formatDate(file.created_at)}</span>
          {page && <span className="badge badge-brand">Page {page}</span>}
        </div>
      </div>

      {file.extraction_status !== "ready" || !text ? (
        <EmptyState
          title="Text extraction in progress"
          description="This file is being processed, or its text could not be extracted."
        />
      ) : (
        <article className="panel whitespace-pre-wrap p-8 text-xs sm:text-sm leading-relaxed text-[var(--muted-strong)] bg-white shadow-xs font-mono">
          {reflowForDisplay(before)}
          {hasHighlight && (
            <mark
              ref={highlightRef}
              className="rounded bg-amber-200/60 px-1 py-0.5 font-semibold text-[var(--text)]"
            >
              {reflowForDisplay(highlighted)}
            </mark>
          )}
          {reflowForDisplay(after)}
        </article>
      )}
    </div>
  );
}
