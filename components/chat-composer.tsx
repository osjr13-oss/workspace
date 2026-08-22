"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, CornerDownLeft } from "lucide-react";
import { autocorrectOnBoundary } from "@/lib/autocorrect";
import { removeEmDashes } from "@/lib/text";

type ChatComposerProps = {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
};

const BOUNDARY = /[\s.,!?;:]/;

export function ChatComposer({
  value,
  disabled,
  onChange
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
    textarea.style.height = `${Math.min(200, Math.max(44, textarea.scrollHeight))}px`;
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
    <div className="relative flex w-full items-end gap-3">
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          aria-label="Chat message"
          className="min-h-[44px] max-h-48 w-full resize-none bg-transparent py-2.5 px-3 text-sm leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
          value={value}
          onChange={(event) => update(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Ask a question, analyze trade-offs, or explore an idea..."
          rows={1}
          spellCheck
        />
        {hint && (
          <span className="pointer-events-none absolute -bottom-5 left-3 text-[11px] font-bold text-slate-500">
            {hint}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 pb-1.5 pr-1.5">
        <button
          type="submit"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white transition hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
          disabled={disabled || !value.trim()}
          aria-label="Send message"
          title="Send (Enter)"
        >
          <ArrowUp size={16} />
        </button>
      </div>
    </div>
  );
}
