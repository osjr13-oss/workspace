"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, FileText, FolderOpen, Loader2, Paperclip, Square, X } from "lucide-react";
import { autocorrectOnBoundary } from "@/lib/autocorrect";
import { removeEmDashes } from "@/lib/text";
import { ACCEPTED_FILE_TYPES } from "@/lib/upload-file";
import type { Project } from "@/lib/types";

export type ComposerAttachment = {
  key: string;
  name: string;
  status: "uploading" | "processing" | "ready" | "failed";
  progress: number;
  fileId?: string;
  error?: string;
};

type ChatComposerProps = {
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  onStop: () => void;
  attachments: ComposerAttachment[];
  onAttach: (files: File[]) => void;
  onRemoveAttachment: (key: string) => void;
  projects: Project[];
  projectId: string;
  onProjectChange: (projectId: string) => void;
  /** An existing conversation keeps the project it started with. */
  projectLocked: boolean;
  maxAttachments: number;
};

const BOUNDARY = /[\s.,!?;:]/;

export function ChatComposer({
  value,
  busy,
  onChange,
  onStop,
  attachments,
  onAttach,
  onRemoveAttachment,
  projects,
  projectId,
  onProjectChange,
  projectLocked,
  maxAttachments
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hintTimerRef = useRef<number | null>(null);
  const [hint, setHint] = useState("");
  const uploading = attachments.some((item) => item.status === "uploading" || item.status === "processing");
  const canSend = Boolean(value.trim()) && !uploading;
  const projectName = projects.find((project) => project.id === projectId)?.name;

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
      {attachments.length ? (
        <ul className="flex flex-wrap gap-2 px-3 pt-3" aria-label="Attached files">
          {attachments.map((item) => (
            <li
              key={item.key}
              className={`attachment-chip ${item.status === "failed" ? "attachment-chip-failed" : ""}`}
              title={item.error || item.name}
            >
              {item.status === "uploading" || item.status === "processing" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FileText size={14} />
              )}
              <span className="max-w-[12rem] truncate">{item.name}</span>
              <span className="text-[11px] font-semibold text-[var(--muted)]">
                {item.status === "uploading"
                  ? `${item.progress}%`
                  : item.status === "processing"
                    ? "Reading"
                    : item.status === "failed"
                      ? "Failed"
                      : null}
              </span>
              <button
                type="button"
                onClick={() => onRemoveAttachment(item.key)}
                className="rounded-md p-0.5 text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]"
                aria-label={`Remove ${item.name}`}
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative px-4 pt-3">
        <textarea
          ref={textareaRef}
          aria-label="Chat message"
          className="block max-h-60 min-h-7 w-full resize-none bg-transparent text-[15px] leading-7 outline-none placeholder:text-[var(--muted)]"
          value={value}
          onChange={(event) => update(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
            if (event.key === "Escape" && busy) {
              event.preventDefault();
              onStop();
            }
          }}
          placeholder="Ask Selrano anything"
          rows={1}
          spellCheck
          autoFocus
        />
        {hint ? (
          <span className="pointer-events-none absolute -top-5 left-4 text-[11px] font-bold text-[var(--muted)]">{hint}</span>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 px-2 pb-2 pt-1">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILE_TYPES}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const files = Array.from(event.target.files || []);
            event.target.value = "";
            if (files.length) onAttach(files);
          }}
        />
        <button
          type="button"
          className="icon-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={attachments.length >= maxAttachments}
          aria-label="Attach files"
          title={attachments.length >= maxAttachments ? `Up to ${maxAttachments} files per message` : "Attach files"}
        >
          <Paperclip size={18} />
        </button>

        {projectLocked ? (
          <span className="project-chip" title="A conversation keeps the project it started with">
            <FolderOpen size={14} />
            <span className="max-w-[11rem] truncate">{projectName || "No project"}</span>
          </span>
        ) : (
          <label className="project-chip project-chip-select" title="Use a project's notes and files as context">
            <FolderOpen size={14} />
            <select
              aria-label="Project context"
              value={projectId}
              onChange={(event) => onProjectChange(event.target.value)}
              className="max-w-[11rem] appearance-none truncate bg-transparent pr-1 outline-none"
            >
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        )}

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
