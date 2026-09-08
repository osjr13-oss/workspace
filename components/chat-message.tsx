"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  Copy,
  Pencil,
  RefreshCw,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
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
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
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

  function toggleSpeech() {
    if (!("speechSynthesis" in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(content);
    utterance.rate = 1;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  return (
    <article
      className={`group flex w-full ${message.role === "user" ? "justify-end" : "justify-start"}`}
      aria-label={message.role === "user" ? "Your thought" : "Lumen response"}
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
          <div className="relative rounded-2xl sm:rounded-3xl border border-[var(--border)] bg-white/80 px-5 py-4 text-[15px] font-medium leading-relaxed text-[var(--text)] shadow-sm backdrop-blur-sm sm:px-6 sm:py-5 sm:text-[16px]">
            <p className="whitespace-pre-wrap">{content}</p>
            {!message.id.startsWith("pending") && message.id !== "error" ? (
              <div className="mt-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  disabled={busy}
                  className="rounded-full p-1.5 text-[var(--muted)] opacity-0 transition hover:bg-[var(--surface-subtle)] hover:text-[var(--text)] group-hover:opacity-100 focus:opacity-100"
                  aria-label="Edit and resend thought"
                  title="Edit and resend"
                >
                  <Pencil size={13} />
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="py-2">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              urlTransform={urlTransform}
              className="prose max-w-none text-[var(--text)] prose-p:my-0 prose-p:mb-5 prose-p:text-[16px] prose-p:leading-[1.75] prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-[var(--text)] prose-h2:mt-6 prose-h2:mb-3 prose-h3:mt-5 prose-h3:mb-2 prose-ul:my-3 prose-ol:my-3 prose-li:my-1 prose-li:text-[16px] prose-li:leading-[1.7] prose-strong:font-bold prose-strong:text-[var(--text)] prose-blockquote:border-l-2 prose-blockquote:border-[var(--border-strong)] prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-[var(--muted-strong)] prose-code:rounded-md prose-code:bg-[var(--surface-subtle)] prose-code:px-1.5 prose-code:py-0.5 prose-code:text-xs prose-pre:rounded-2xl prose-pre:bg-[#15181f] prose-pre:p-4 prose-pre:text-xs sm:prose-p:text-[17px] sm:prose-li:text-[17px]"
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
              <div className="mt-3 flex items-center gap-1 text-[var(--muted)]">
                <button
                  type="button"
                  onClick={copyResponse}
                  className="rounded-full p-2 transition hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]"
                  aria-label={copied ? "Response copied" : "Copy response"}
                  title={copied ? "Copied" : "Copy"}
                >
                  {copied ? <CheckCheck size={16} /> : <Copy size={16} />}
                </button>
                <button
                  type="button"
                  onClick={toggleSpeech}
                  className="rounded-full p-2 transition hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]"
                  aria-label={speaking ? "Stop reading response" : "Read response aloud"}
                  title={speaking ? "Stop reading" : "Read aloud"}
                >
                  {speaking ? <VolumeX size={17} /> : <Volume2 size={17} />}
                </button>
                <button
                  type="button"
                  onClick={() => onRegenerate(message.id)}
                  disabled={busy}
                  className="rounded-full p-2 transition hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]"
                  aria-label="Regenerate response"
                  title="Regenerate"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </article>
  );
}
