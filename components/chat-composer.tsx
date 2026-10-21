"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";
import { autocorrectOnBoundary } from "@/lib/autocorrect";
import { removeEmDashes } from "@/lib/text";

type ChatComposerProps = {
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  onStop: () => void;
};

const BOUNDARY = /[\s.,!?;:]/;

export function ChatComposer({
  value,
  busy,
  onChange,
  onStop
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hintTimerRef = useRef<number | null>(null);
  const [hint, setHint] = useState("");
  const canSend = Boolean(value.trim());

  useEffect(() => {
    return () => {
      if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(240, Math.max(28, textarea.scrollHeight))}px`;
  }, [value]);

  // Typing "/" anywhere outside a field jumps to the message box.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (target && (target.closest("input, textarea, select, [contenteditable='true']"))) return;
      event.preventDefault();
      textareaRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
        if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
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
    <div className="composer">
      <div className="relative px-4 pt-3">
        <textarea
          ref={textareaRef}
          aria-label="Chat message"
          className="block max-h-60 min-h-7 w-full resize-none bg-transparent text-[15px] leading-7 outline-none placeholder:text-[var(--muted)]"
          value={value}
          onChange={(event) => update(event.target.value)}
          onKeyDown={(event) => {
            // IME confirmation/cancellation belongs to the input method. Safari
            // can clear isComposing before the confirming Enter (keyCode 229).
            if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
            if (event.key === "Escape" && busy) {
              event.preventDefault();
              onStop();
            }
          }}
          placeholder="Ask your coach anything"
          rows={1}
          spellCheck
          autoFocus
        />
        {hint ? (
          <span className="pointer-events-none absolute -top-5 left-4 text-[11px] font-bold text-[var(--muted)]">{hint}</span>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 px-2 pb-2 pt-1">
        <div className="flex-1" />
        {busy ? (
          <button type="button" onClick={onStop} className="send-button" aria-label="Stop responding" title="Stop (Esc)">
            <Square size={13} fill="currentColor" />
          </button>
        ) : (
          <button type="submit" className="send-button" disabled={!canSend} aria-label="Send message" title="Send (Enter)">
            <ArrowUp size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
