"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Compass, FileText, Loader2, Paperclip, X } from "lucide-react";
import { autocorrectOnBoundary } from "@/lib/autocorrect";
import { removeEmDashes } from "@/lib/text";

export type AttachedFileItem = {
  id: string;
  name: string;
  size: number;
};

type ChatComposerProps = {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onRecap?: () => void;
  hasMessages?: boolean;
  modelSelector?: React.ReactNode;
  projects?: Array<{ id: string; name: string }>;
  projectId?: string;
  onSelectProject?: (id: string) => void;
  placeholder?: string;
  attachedFiles?: AttachedFileItem[];
  onAttachFile?: (file: File) => Promise<void>;
  onRemoveAttachedFile?: (fileId: string) => void;
  isUploadingFile?: boolean;
};

const BOUNDARY = /[\s.,!?;:]/;

export function ChatComposer({
  value,
  disabled,
  onChange,
  onSubmit,
  onRecap,
  hasMessages,
  modelSelector,
  projects,
  projectId,
  onSelectProject,
  placeholder,
  attachedFiles,
  onAttachFile,
  onRemoveAttachedFile,
  isUploadingFile
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    textarea.style.height = `${Math.min(180, Math.max(56, textarea.scrollHeight))}px`;
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

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected || !onAttachFile) return;
    try {
      await onAttachFile(selected);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  const canSubmit = !disabled && !isUploadingFile && (value.trim().length > 0 || (attachedFiles && attachedFiles.length > 0));

  return (
    <form
      onSubmit={onSubmit}
      className="w-full rounded-2xl border border-neutral-200 bg-white p-3 shadow-xs transition focus-within:border-neutral-400 focus-within:shadow-sm"
    >
      {attachedFiles && attachedFiles.length > 0 ? (
        <div className="flex flex-wrap gap-2 px-2 pt-1 pb-2.5">
          {attachedFiles.map((file) => (
            <div
              key={file.id}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-800"
            >
              <FileText size={13} className="text-neutral-500" />
              <span className="font-medium max-w-[180px] truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => onRemoveAttachedFile?.(file.id)}
                className="ml-0.5 rounded-full p-0.5 text-neutral-400 hover:text-neutral-800 transition cursor-pointer"
                aria-label={`Remove ${file.name}`}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <textarea
        ref={textareaRef}
        aria-label="Chat message"
        className="min-h-14 max-h-48 w-full resize-none bg-transparent px-2 py-1 text-[15.5px] outline-none text-neutral-900 placeholder:text-neutral-400 leading-relaxed"
        value={value}
        onChange={(event) => update(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder={placeholder || "How can I help you today?"}
        rows={2}
        spellCheck
      />
      {hint ? (
        <span className="pointer-events-none block px-2 pb-1 text-[11px] font-medium text-neutral-500">
          {hint}
        </span>
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-neutral-100 pt-2.5">
        <div className="flex items-center gap-2">
          {onAttachFile ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.txt,.md,.markdown"
                onChange={handleFileSelect}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isUploadingFile}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition disabled:opacity-40 cursor-pointer"
                title="Attach file (.pdf, .docx, .txt, .md)"
                aria-label="Attach file"
              >
                {isUploadingFile ? (
                  <Loader2 size={16} className="animate-spin text-neutral-600" />
                ) : (
                  <Paperclip size={16} />
                )}
              </button>
            </>
          ) : null}

          {projects && projects.length > 0 ? (
            <div className="relative inline-block">
              <select
                aria-label="Project context"
                value={projectId || ""}
                onChange={(e) => onSelectProject?.(e.target.value)}
                disabled={disabled}
                className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200/80 px-2.5 py-1 text-xs font-medium text-neutral-700 outline-none transition cursor-pointer border-0"
              >
                <option value="">No project context</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {onRecap && hasMessages ? (
            <button
              type="button"
              onClick={onRecap}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 hover:text-neutral-900 transition disabled:opacity-40"
              title="Summarize where we are in this conversation"
            >
              <Compass size={13} />
              <span>Recap</span>
            </button>
          ) : null}

          {modelSelector}

          <button
            type="submit"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-white hover:opacity-85 disabled:opacity-20 transition shrink-0 cursor-pointer"
            disabled={!canSubmit}
            aria-label="Send message"
          >
            <ArrowUp size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </form>
  );
}
