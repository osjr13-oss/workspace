"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCheck, Copy, Pencil, RefreshCw } from "lucide-react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CitationBadge } from "@/components/citation-badge";
import { removeEmDashes } from "@/lib/text";
import type { ChatMessage } from "@/lib/types";

type ChatMessageProps = {
  message: ChatMessage;
  busy: boolean;
  onEdit: (messageId: string, content: string) => Promise<void>;
  onRegenerate: (messageId: string) => Promise<void>;
};

function withCitationLinks(content: string) {
  return content.replace(/\[(\d+)\]/g, (marker, id) => `[${marker}](citation:${id})`);
}

function urlTransform(url: string) {
  return url.startsWith("citation:") ? url : defaultUrlTransform(url);
}

function formatStructuredContent(raw: string) {
  // Ensures single newlines following sentence endings become double newlines
  // so markdown parser renders clean distinct paragraphs rather than collapsing into one block.
  return raw.replace(/([.!?:])\n(?!\n)/g, "$1\n\n");
}

export function ChatMessageBubble({
  message,
  busy,
  onEdit,
  onRegenerate
}: ChatMessageProps) {
  const content = removeEmDashes(message.content);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
    };
  }, []);

  async function saveEdit() {
    const next = removeEmDashes(draft).trim();
    if (!next || next === content) {
      setEditing(false);
      setDraft(content);
      return;
    }
    setEditing(false);
    await onEdit(message.id, next);
  }

  async function copyResponse() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  const structuredContent = formatStructuredContent(content);

  return (
    <article
      className={`group flex w-full ${message.role === "user" ? "justify-end" : "justify-start"}`}
      aria-label={message.role === "user" ? "Your thought" : "Selrano response"}
    >
      <div className={message.role === "user" ? "max-w-[88%] sm:max-w-[78%]" : "w-full max-w-3xl"}>
        {editing ? (
          <div className="rounded-2xl border border-[var(--border)] bg-white/90 p-4 shadow-sm sm:min-w-[min(34rem,70vw)]">
            <textarea
              aria-label="Edit thought"
              className="min-h-28 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] p-4 text-base leading-7 text-[var(--text)] outline-none focus:border-[var(--border-strong)]"
              value={draft}
              onChange={(event) => setDraft(removeEmDashes(event.target.value))}
              autoFocus
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setDraft(content);
                }}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)] transition"
                aria-label="Cancel editing"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className="rounded-full bg-[var(--text)] px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90 transition"
                aria-label="Save and resend"
              >
                Save
              </button>
            </div>
          </div>
        ) : message.role === "user" ? (
          <div className="rounded-3xl bg-neutral-100 px-5 py-3 text-[15px] leading-relaxed text-neutral-900">
            <p className="whitespace-pre-wrap">{content}</p>
            {!message.id.startsWith("pending") && message.id !== "error" ? (
              <div className="mt-1 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  disabled={busy}
                  className="rounded p-1 text-neutral-400 opacity-0 transition hover:text-neutral-800 group-hover:opacity-100 focus:opacity-100"
                  aria-label="Edit thought"
                  title="Edit"
                >
                  <Pencil size={12} />
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="py-1">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              urlTransform={urlTransform}
              className="prose max-w-none text-neutral-900 prose-p:my-0 prose-p:mb-5 prose-p:text-[15.5px] prose-p:leading-[1.75] prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-neutral-900 prose-h2:mt-7 prose-h2:mb-3 prose-h3:mt-5 prose-h3:mb-2 prose-ul:my-4 prose-ol:my-4 prose-li:my-1.5 prose-li:text-[15.5px] prose-li:leading-[1.75] prose-strong:font-semibold prose-strong:text-neutral-900 prose-blockquote:border-l-2 prose-blockquote:border-neutral-300 prose-blockquote:pl-4 prose-blockquote:text-neutral-600 prose-code:rounded prose-code:bg-neutral-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-xs prose-pre:rounded-xl prose-pre:bg-neutral-900 prose-pre:p-4 prose-pre:text-xs"
              components={
                message.citations?.length
                  ? {
                      a: ({ href, children }) => {
                        const marker = href?.startsWith("citation:")
                          ? href.slice("citation:".length)
                          : null;
                        const citation = marker
                          ? message.citations?.find((item) => item.marker === marker)
                          : null;
                        if (citation) return <CitationBadge citation={citation} />;
                        return (
                          <a href={href} target="_blank" rel="noreferrer">
                            {children}
                          </a>
                        );
                      }
                    }
                  : undefined
              }
            >
              {message.citations?.length ? withCitationLinks(structuredContent) : structuredContent}
            </ReactMarkdown>
            {!message.id.startsWith("streaming") && message.id !== "error" ? (
              <div className="mt-2 flex items-center gap-1 text-neutral-400">
                <button
                  type="button"
                  onClick={copyResponse}
                  className="rounded p-1.5 transition hover:bg-neutral-100 hover:text-neutral-800"
                  aria-label={copied ? "Response copied" : "Copy response"}
                  title={copied ? "Copied" : "Copy"}
                >
                  {copied ? <CheckCheck size={14} className="text-neutral-900" /> : <Copy size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() => onRegenerate(message.id)}
                  disabled={busy}
                  className="rounded p-1.5 transition hover:bg-neutral-100 hover:text-neutral-800"
                  aria-label="Regenerate response"
                  title="Regenerate"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </article>
  );
}
