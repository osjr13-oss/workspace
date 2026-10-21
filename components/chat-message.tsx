"use client";

import Link from "next/link";
import { isValidElement, useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  Copy,
  FileText,
  Pencil,
  RefreshCw,
  Volume2,
  VolumeX
} from "lucide-react";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CitationBadge } from "@/components/citation-badge";
import { healStreamingMarkdown } from "@/lib/stream-markdown";
import { removeEmDashes } from "@/lib/text";
import type { ChatMessage, FileCitation } from "@/lib/types";

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

function isAttachment(citation: { marker: string }): citation is FileCitation {
  return citation.marker.startsWith("attachment-");
}

export function ChatMessageBubble({ message, busy, onEdit, onRegenerate }: ChatMessageProps) {
  const content = removeEmDashes(message.content);
  // Unfinished formatting at the tail of a reply that is still arriving is tidied so it never flashes as raw symbols.
  const streaming = message.id.startsWith("streaming");
  const displayed = streaming ? healStreamingMarkdown(content) : content;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);
  const citations = message.citations || [];
  const attachments = citations.filter(isAttachment);
  const limitations = (message.research?.limitations || []).filter((text) => !content.includes(text));

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

  async function copyText() {
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

  if (message.role === "user") {
    const saved = !message.id.startsWith("pending") && message.id !== "error";
    return (
      <article className="group flex w-full flex-col items-end" aria-label="Your message">
        {attachments.length ? (
          <ul className="mb-2 flex max-w-[88%] flex-wrap justify-end gap-1.5" aria-label="Attached files">
            {attachments.map((file) => (
              <li key={file.marker}>
                <Link href={`/files/${file.fileId}`} className="attachment-chip hover:border-[var(--border-strong)]">
                  <FileText size={14} />
                  <span className="max-w-[14rem] truncate">{file.fileName}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {editing ? (
          <div className="w-full max-w-[88%] rounded-[22px] border border-[var(--border-strong)] bg-[var(--background-elevated)] p-3 sm:max-w-[78%]">
            <textarea
              aria-label="Edit message"
              className="min-h-24 w-full resize-y bg-transparent px-2 py-1 text-[15px] leading-7 text-[var(--text)] outline-none"
              value={draft}
              onChange={(event) => setDraft(removeEmDashes(event.target.value))}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void saveEdit();
                }
                if (event.key === "Escape") {
                  setEditing(false);
                  setDraft(content);
                }
              }}
              autoFocus
            />
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setDraft(content);
                }}
                className="chip-button text-[var(--muted-strong)]"
              >
                Cancel
              </button>
              <button type="button" onClick={saveEdit} className="chip-button bg-[var(--text)] text-white hover:bg-[var(--text)]" aria-label="Save and resend">
                Send
              </button>
            </div>
          </div>
        ) : (
          <div className="user-bubble">
            <p className="whitespace-pre-wrap">{content}</p>
          </div>
        )}
        {saved && !editing ? (
          <div className="message-actions mt-1 flex items-center gap-0.5">
            <button type="button" onClick={copyText} className="icon-button h-8 w-8" aria-label={copied ? "Message copied" : "Copy message"} title="Copy">
              {copied ? <CheckCheck size={15} /> : <Copy size={15} />}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(content);
                setEditing(true);
              }}
              disabled={busy}
              className="icon-button h-8 w-8"
              aria-label="Edit and resend message"
              title="Edit and resend"
            >
              <Pencil size={15} />
            </button>
          </div>
        ) : null}
      </article>
    );
  }

  const isError = message.id === "error";
  const stoppedEmpty = !streaming && !isError && !content.trim();

  const components: Components = {
    pre: ({ children }) => {
      const child = Array.isArray(children) ? children[0] : children;
      const props = isValidElement<{ className?: string; children?: React.ReactNode }>(child) ? child.props : null;
      const language = /language-([\w+#-]+)/.exec(props?.className || "")?.[1] || "";
      const code = String(props?.children ?? "").replace(/\n$/, "");
      return <CodeBlock code={code} language={language} highlight={!streaming} />;
    },
    table: ({ children }) => (
      <div className="table-scroll">
        <table>{children}</table>
      </div>
    ),
    a: ({ href, children }) => {
      const marker = href?.startsWith("citation:") ? href.slice("citation:".length) : null;
      const citation = marker ? citations.find((item) => item.marker === marker) : null;
      if (citation) return <CitationBadge citation={citation} />;
      if (marker) return <>{children}</>;
      return (
        <a href={href} target="_blank" rel="noreferrer">
          {children}
        </a>
      );
    }
  };

  return (
    <article className="group w-full" aria-label="Selrano response">
      {isError ? (
        <div className="rounded-2xl border border-[rgba(194,65,61,0.22)] bg-[rgba(194,65,61,0.05)] px-4 py-3 text-[15px] leading-7 text-[var(--text)]">
          {content}
        </div>
      ) : stoppedEmpty ? (
        <p className="text-sm italic text-[var(--muted)]">Stopped before replying.</p>
      ) : (
        <div className="answer-prose">
          <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={urlTransform} components={components}>
            {citations.length ? withCitationLinks(displayed) : displayed}
          </ReactMarkdown>
        </div>
      )}

      {content.trim() && message.research?.groundingProvider === "google" && message.research.searchSuggestionsHtml ? (
        <iframe
          title="Google Search suggestions"
          className="mt-3 h-40 w-full border-0"
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; base-uri 'none'; form-action 'none'"><base target="_blank">${message.research.searchSuggestionsHtml}`}
        />
      ) : null}

      {!streaming && limitations.length ? (
        <div className="mt-3 text-sm text-[var(--muted)]" aria-label="Research limitations">
          {limitations.map((limitation, index) => <p key={index}>{limitation}</p>)}
        </div>
      ) : null}

      {!streaming && !isError ? (
        <div className="message-actions mt-2 flex items-center gap-0.5 text-[var(--muted)]">
          {!stoppedEmpty ? (
            <>
              <button type="button" onClick={copyText} className="icon-button h-8 w-8" aria-label={copied ? "Response copied" : "Copy response"} title={copied ? "Copied" : "Copy"}>
                {copied ? <CheckCheck size={15} /> : <Copy size={15} />}
              </button>
              <button
                type="button"
                onClick={toggleSpeech}
                className="icon-button h-8 w-8"
                aria-label={speaking ? "Stop reading response" : "Read response aloud"}
                title={speaking ? "Stop reading" : "Read aloud"}
              >
                {speaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => onRegenerate(message.id)}
            disabled={busy}
            className="icon-button h-8 w-8"
            aria-label="Regenerate response"
            title="Regenerate"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      ) : null}
    </article>
  );
}

let highlighter: Promise<typeof import("highlight.js").default> | null = null;

/** Code with a language label and a copy button. Highlighting loads only when a reply contains code. */
function CodeBlock({ code, language, highlight }: { code: string; language: string; highlight: boolean }) {
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!highlight || !code) return;
    let cancelled = false;
    highlighter ??= import("highlight.js/lib/common").then((module) => module.default);
    void highlighter.then((hljs) => {
      if (cancelled) return;
      const result = language && hljs.getLanguage(language) ? hljs.highlight(code, { language }) : hljs.highlightAuto(code);
      // highlight.js escapes the code itself; only its own span markup is added.
      setHtml(result.value);
    });
    return () => {
      cancelled = true;
    };
  }, [code, language, highlight]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span>{language || "code"}</span>
        <button type="button" onClick={copy} className="code-copy" aria-label={copied ? "Code copied" : "Copy code"}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        {html !== null && highlight ? <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} /> : <code>{code}</code>}
      </pre>
    </div>
  );
}
