"use client";

import { useState } from "react";
import { Check, Pencil, RefreshCw, X } from "lucide-react";
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

export function ChatMessageBubble({
  message,
  busy,
  onEdit,
  onRegenerate
}: ChatMessageProps) {
  const content = removeEmDashes(message.content);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);

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

  return (
    <div className={`group flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-[18px] border border-[var(--border)] p-4 text-sm leading-6 ${
          message.role === "user"
            ? "bg-[var(--text)] text-white"
            : "bg-white/72 text-[var(--muted-strong)]"
        }`}
      >
        {editing ? (
          <div className="min-w-[min(32rem,70vw)]">
            <textarea
              aria-label="Edit message"
              className="min-h-28 w-full resize-y rounded-xl bg-white/10 p-3 text-sm text-white outline-none ring-1 ring-white/30"
              value={draft}
              onChange={(event) => setDraft(removeEmDashes(event.target.value))}
              autoFocus
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setDraft(content);
                }}
                className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Cancel editing"
              >
                <X size={15} />
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Save and resend"
              >
                <Check size={15} />
              </button>
            </div>
          </div>
        ) : message.role === "user" ? (
          <div>
            <p className="whitespace-pre-wrap">{content}</p>
            {!message.id.startsWith("pending") && message.id !== "error" ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                disabled={busy}
                className="mt-2 rounded-lg p-1.5 text-white/55 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100 focus:opacity-100"
                aria-label="Edit and resend message"
                title="Edit and resend"
              >
                <Pencil size={14} />
              </button>
            ) : null}
          </div>
        ) : (
          <div>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              urlTransform={urlTransform}
              className="prose prose-sm max-w-none prose-p:my-1 prose-headings:font-extrabold prose-headings:tracking-tight prose-code:text-xs prose-pre:text-xs"
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
              {message.citations?.length ? withCitationLinks(content) : content}
            </ReactMarkdown>
            {!message.id.startsWith("streaming") && message.id !== "error" ? (
              <button
                type="button"
                onClick={() => onRegenerate(message.id)}
                disabled={busy}
                className="mt-2 rounded-lg p-1.5 text-[var(--muted)] opacity-0 transition hover:bg-[var(--surface-subtle)] hover:text-[var(--text)] group-hover:opacity-100 focus:opacity-100"
                aria-label="Regenerate response"
                title="Regenerate"
              >
                <RefreshCw size={14} />
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
