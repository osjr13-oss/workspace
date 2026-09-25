"use client";

import { useEffect, useRef } from "react";

export type AttachedFile = {
  id: string;
  name: string;
  notice: string | null;
};

export function ChatComposer({
  value,
  sending,
  uploading,
  attached,
  onChange,
  onSubmit,
  onStop,
  onAttach,
  onRemove
}: {
  value: string;
  sending: boolean;
  uploading: boolean;
  attached: AttachedFile[];
  onChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onStop: () => void;
  onAttach: (file: File) => void;
  onRemove: (id: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(180, Math.max(56, textarea.scrollHeight))}px`;
  }, [value]);

  const canSend = !sending && !uploading && (value.trim().length > 0 || attached.length > 0);

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-3 shadow-sm">
      {attached.length ? (
        <ul className="mb-2 flex flex-wrap gap-2">
          {attached.map((file) => (
            <li key={file.id} className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-xs">
              <span className="max-w-[180px] truncate">{file.name}</span>
              <button type="button" className="text-[var(--muted)]" onClick={() => onRemove(file.id)} aria-label={`Remove ${file.name}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <textarea
        ref={textareaRef}
        aria-label="Message"
        className="max-h-48 min-h-14 w-full resize-none bg-transparent px-1 py-1 text-[15.5px] leading-7 outline-none placeholder:text-[var(--muted)]"
        placeholder="Write a message"
        rows={2}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            if (canSend) event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <div>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".txt,.md,.csv,.json,.pdf,.docx,text/plain,application/pdf"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onAttach(file);
              event.target.value = "";
            }}
          />
          <button type="button" className="rounded-full px-2 py-1 text-sm text-[var(--muted)] hover:text-[var(--ink)]" onClick={() => fileRef.current?.click()} disabled={uploading || sending}>
            {uploading ? "Attaching" : "Attach"}
          </button>
        </div>
        {sending ? (
          <button type="button" className="rounded-full bg-[var(--ink)] px-3 py-1.5 text-sm text-white" onClick={onStop}>
            Stop
          </button>
        ) : (
          <button type="submit" className="rounded-full bg-[var(--ink)] px-3 py-1.5 text-sm text-white disabled:opacity-40" disabled={!canSend}>
            Send
          </button>
        )}
      </div>
    </form>
  );
}
