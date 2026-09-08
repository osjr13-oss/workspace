"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Compass } from "lucide-react";
import { autocorrectOnBoundary } from "@/lib/autocorrect";
import { removeEmDashes } from "@/lib/text";

type ChatComposerProps = {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onRecap?: () => void;
  hasMessages?: boolean;
};

const BOUNDARY = /[\s.,!?;:]/;

export function ChatComposer({
  value,
  disabled,
  onChange,
  onRecap,
  hasMessages
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hintTimerRef = useRef<number | null>(null);
  const [hint, setHint] = useState("");

  useEffect(() => {
    return () => {
      if (hintTimerRef.current) {
        window.clearTimeout(hintTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(180, Math.max(44, textarea.scrollHeight))}px`;
  }, [value]);

  function update(rawValue: string) {
    const normalized = removeEmDashes(rawValue);
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? normalized.length;
    const lastCharacter = normalized[cursor - 1] || "";

    if (BOUNDARY.test(lastCharacter) && normalized.length >= value.length) {
      const result = autocorrectOnBoundary(normalized, cursor);
      onChange(result.text);
      if (result.correction) {
        setHint(`Corrected to ${result.correction.correction}`);
        if (hintTimerRef.current) {
          window.clearTimeout(hintTimerRef.current);
        }
        hintTimerRef.current = window.setTimeout(() => setHint(""), 1400);
        requestAnimationFrame(() => {
          textarea?.setSelectionRange(result.cursor, result.cursor);
        });
      }
      return;
    }

    onChange(normalized);
  }

  return (
    <div className="relative flex w-full items-end gap-2">
      <textarea
        ref={textareaRef}
        aria-label="Chat message"
        className="min-h-11 max-h-44 flex-1 resize-none bg-transparent px-4 py-3 text-sm outline-none"
        value={value}
        onChange={(event) => update(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder="Start with a thought. It doesn't have to be clear yet..."
        rows={1}
        spellCheck
      />
      {hint ? (
        <span className="pointer-events-none absolute bottom-1 left-4 translate-y-full text-[11px] font-bold text-[var(--muted)]">
          {hint}
        </span>
      ) : null}
      {onRecap && hasMessages ? (
        <button
          type="button"
          onClick={onRecap}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white/70 px-3 py-2 text-xs font-bold text-[var(--muted-strong)] hover:border-[var(--border-strong)] hover:text-[var(--text)] transition disabled:opacity-50"
          title="Summarize where we are in this conversation"
        >
          <Compass size={14} />
          <span>Where we are</span>
        </button>
      ) : null}
      <button type="submit" className="btn-primary min-h-11 px-4" disabled={disabled || !value.trim()}>
        <Send size={18} />
      </button>
    </div>
  );
}
