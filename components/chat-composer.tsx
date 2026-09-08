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
    <div className="relative flex w-full items-end gap-2 px-1">
      <textarea
        ref={textareaRef}
        aria-label="Chat message"
        className="min-h-11 max-h-44 flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] outline-none text-neutral-900 placeholder:text-neutral-400"
        value={value}
        onChange={(event) => update(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder="Ask anything or start an idea..."
        rows={1}
        spellCheck
      />
      {hint ? (
        <span className="pointer-events-none absolute bottom-1 left-4 translate-y-full text-[11px] font-medium text-neutral-500">
          {hint}
        </span>
      ) : null}
      {onRecap && hasMessages ? (
        <button
          type="button"
          onClick={onRecap}
          disabled={disabled}
          className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 transition disabled:opacity-40"
          title="Summarize where we are in this conversation"
        >
          <Compass size={13} />
          <span>Recap</span>
        </button>
      ) : null}
      <button
        type="submit"
        className="mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-black text-white hover:opacity-85 disabled:opacity-20 transition shrink-0"
        disabled={disabled || !value.trim()}
        aria-label="Send message"
      >
        <Send size={14} />
      </button>
    </div>
  );
}
