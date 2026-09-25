"use client";

import Link from "next/link";
import { useState } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/lib/types";

function withCitationLinks(content: string) {
  return content.replace(/\[(\d+)\]/g, (_marker, id) => `[[${id}]](citation:${id})`);
}

export function ChatMessageBubble({
  message,
  busy,
  onEdit,
  onRegenerate
}: {
  message: ChatMessage;
  busy: boolean;
  onEdit: (id: string, content: string) => void;
  onRegenerate: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const citations = message.citations || [];
  const artifacts = message.artifacts || [];
  const pending = message.id === "pending-user" || message.id === "streaming";

  if (message.role === "user") {
    return (
      <article className="flex justify-end" aria-label="Your message">
        <div className="max-w-[85%]">
          {editing ? (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-3">
              <textarea
                aria-label="Edit message"
                className="min-h-24 w-full min-w-[16rem] resize-y bg-transparent text-sm leading-6 outline-none"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" className="text-xs text-[var(--muted)]" onClick={() => { setEditing(false); setDraft(message.content); }}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-full bg-[var(--ink)] px-3 py-1 text-xs text-white"
                  onClick={() => {
                    const next = draft.trim();
                    setEditing(false);
                    if (next && next !== message.content) onEdit(message.id, next);
                  }}
                >
                  Save and resend
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-[var(--user)] px-4 py-3 text-[15px] leading-7">
              <p className="whitespace-pre-wrap">{message.content}</p>
              {pending ? null : (
                <div className="mt-1 text-right">
                  <button type="button" className="text-xs text-[var(--muted)]" disabled={busy} onClick={() => setEditing(true)}>
                    Edit
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </article>
    );
  }

  return (
    <article aria-label="Reply">
      <div className="chat-copy text-[15.5px] leading-7">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          urlTransform={(url) => (url.startsWith("citation:") ? url : defaultUrlTransform(url))}
          components={{
            a: ({ href, children }) => {
              const marker = href?.startsWith("citation:") ? href.slice("citation:".length) : null;
              const citation = marker ? citations.find((item) => item.marker === marker) : null;
              if (citation) {
                return (
                  <a href={citation.url} target="_blank" rel="noreferrer" title={citation.title}>
                    [{citation.marker}]
                  </a>
                );
              }
              return (
                <a href={href} target="_blank" rel="noreferrer">
                  {children}
                </a>
              );
            }
          }}
        >
          {citations.length ? withCitationLinks(message.content) : message.content}
        </ReactMarkdown>
      </div>
      {citations.length ? (
        <ul className="mt-3 space-y-1 text-sm">
          {citations.map((citation) => (
            <li key={citation.marker}>
              <a href={citation.url} target="_blank" rel="noreferrer" className="underline">
                [{citation.marker}] {citation.title}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {artifacts.length ? (
        <ul className="mt-3 space-y-1 text-sm">
          {artifacts.map((artifact, index) => {
            if (artifact.type === "search_off") return <li key="search-off">Search is off.</li>;
            if (artifact.type === "note") {
              return (
                <li key={artifact.id}>
                  Note: <Link href={`/notes/${artifact.id}`} className="underline">{artifact.title}</Link>
                </li>
              );
            }
            return (
              <li key={`${artifact.id}-${index}`}>
                Flashcards: <Link href={`/flashcards/${artifact.id}`} className="underline">{artifact.name}</Link>
                {artifact.count ? ` (${artifact.count})` : ""}
              </li>
            );
          })}
        </ul>
      ) : null}
      {pending ? null : (
        <button type="button" className="mt-2 text-xs text-[var(--muted)]" disabled={busy} onClick={() => onRegenerate(message.id)}>
          Regenerate
        </button>
      )}
    </article>
  );
}
