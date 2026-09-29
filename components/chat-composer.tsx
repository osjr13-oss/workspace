"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
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
        placeholder="Ask anything, or paste text to transform..."
        rows={1}
        spellCheck
      />
      {hint ? (
        <span className="pointer-events-none absolute bottom-1 left-4 translate-y-full text-[11px] font-bold text-[var(--muted)]">
          {hint}
        </span>
      ) : null}
      <button type="submit" className="btn-primary min-h-11 px-4" disabled={disabled || !value.trim()}>
        <Send size={18} />
      </button>
    </div>
  );
}
