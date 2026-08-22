"use client";

import { useEffect, useRef, useState } from "react";
import {
  Brain,
  Check,
  CheckCheck,
  Copy,
  Pencil,
  RefreshCw,
  User,
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

  const isUser = message.role === "user";

  return (
    <article
      className={`group flex w-full gap-4 ${isUser ? "justify-end" : "justify-start"}`}
      aria-label={isUser ? "Your message" : "Selrano response"}
    >
      <div className={isUser ? "max-w-[85%] sm:max-w-[75%]" : "w-full max-w-3xl"}>
        {editing ? (
          <div className="rounded-2xl border border-[var(--border-strong)] bg-slate-50 p-4">
            <textarea
              aria-label="Edit message"
              className="min-h-[100px] w-full resize-y rounded-xl border border-[var(--border)] bg-white p-3 text-sm leading-relaxed text-[var(--text)] outline-none focus:border-slate-900"
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
                className="btn-secondary min-h-[32px] px-3 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className="btn-primary min-h-[32px] px-3 text-xs"
              >
                Save and retry
              </button>
            </div>
          </div>
        ) : isUser ? (
          <div className="relative rounded-2xl border border-slate-200/80 bg-slate-100/90 px-4 py-3.5 text-sm leading-relaxed text-[var(--text)] shadow-xs">
            <p className="whitespace-pre-wrap">{content}</p>
            {!message.id.startsWith("pending") && message.id !== "error" && (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-md p-1 text-xs font-semibold text-[var(--muted)] opacity-0 transition hover:bg-white hover:text-[var(--text)] group-hover:opacity-100 focus:opacity-100"
                  aria-label="Edit message"
                  title="Edit"
                >
                  <Pencil size={12} />
                  <span>Edit</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-white">
                <Brain size={13} />
              </div>
              <span className="text-xs font-bold text-[var(--text)]">Selrano</span>
            </div>

            <div className="prose-selrano">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                urlTransform={urlTransform}
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
                            <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 underline">
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
            </div>

            {!message.id.startsWith("streaming") && message.id !== "error" && (
              <div className="flex items-center gap-1 pt-2 border-t border-[var(--border)] text-[var(--muted)]">
                <button
                  type="button"
                  onClick={copyResponse}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition hover:bg-slate-100 hover:text-[var(--text)]"
                  aria-label={copied ? "Response copied" : "Copy response"}
                  title={copied ? "Copied" : "Copy"}
                >
                  {copied ? <CheckCheck size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
                <button
                  type="button"
                  onClick={toggleSpeech}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition hover:bg-slate-100 hover:text-[var(--text)]"
                  aria-label={speaking ? "Stop reading" : "Read aloud"}
                  title={speaking ? "Stop reading" : "Read aloud"}
                >
                  {speaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  <span>{speaking ? "Stop" : "Read"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRegenerate(message.id)}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition hover:bg-slate-100 hover:text-[var(--text)]"
                  aria-label="Regenerate response"
                  title="Regenerate"
                >
                  <RefreshCw size={14} />
                  <span>Regenerate</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
