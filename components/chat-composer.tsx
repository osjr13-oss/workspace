"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, FileText, FolderOpen, Loader2, Mic, MicOff, Paperclip, SlidersHorizontal, Sparkles, Square, X } from "lucide-react";
import { RESPONSE_STYLES, type ResponseStyleId } from "@/lib/response-styles";
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
  /** Today's composer hands the message to chat and has no file picker. */
  allowAttachments?: boolean;
  /** How Selrano should answer in this chat; hidden when not given. */
  responseStyle?: ResponseStyleId;
  onResponseStyleChange?: (style: ResponseStyleId) => void;
  /** "fast" (Gemini 4 Hydrogen) or "deep" (Gemini 4 Argon). */
  depth?: "fast" | "deep";
  onDepthChange?: (depth: "fast" | "deep") => void;
};

/** Pasted text longer than this becomes an attachment, so the box stays usable and nothing is cut. */
export const LONG_PASTE_CHARS = 4_000;

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function speechRecognition(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function pastedTextFile(text: string) {
  const stamp = new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).replace(/[/:,]/g, " ").replace(/\s+/g, " ").trim();
  return new File([text], `Pasted text ${stamp}.txt`, { type: "text/plain" });
}

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
  maxAttachments,
  allowAttachments = true,
  responseStyle,
  onResponseStyleChange,
  depth = "fast",
  onDepthChange
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hintTimerRef = useRef<number | null>(null);
  const [hint, setHint] = useState("");
  const uploading = attachments.some((item) => item.status === "uploading" || item.status === "processing");
  const canSend = Boolean(value.trim()) && !uploading;
  const projectName = projects.find((project) => project.id === projectId)?.name;
  const [dragging, setDragging] = useState(false);
  const [listening, setListening] = useState(false);
  const [canDictate, setCanDictate] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);
  // Dictation adds to what was typed before it started.
  const dictationBaseRef = useRef("");
  const room = allowAttachments ? Math.max(0, maxAttachments - attachments.length) : 0;

  useEffect(() => setCanDictate(Boolean(speechRecognition())), []);
  useEffect(() => () => recognitionRef.current?.stop(), []);

  function toggleDictation() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Speech = speechRecognition();
    if (!Speech) return;
    const recognition = new Speech();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    dictationBaseRef.current = value ? `${value.replace(/\s+$/, "")} ` : "";
    recognition.onresult = (event) => {
      let heard = "";
      for (let index = 0; index < event.results.length; index += 1) heard += event.results[index][0].transcript;
      onChange(removeEmDashes(dictationBaseRef.current + heard.trimStart()));
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  function takeFiles(files: File[]) {
    if (!files.length || !room) return;
    onAttach(files.slice(0, room));
  }

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
    <div
      className={`composer ${dragging ? "composer-dragging" : ""}`}
      onDragOver={(event) => {
        if (!allowAttachments || !Array.from(event.dataTransfer.types).includes("Files")) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        if (!allowAttachments) return;
        event.preventDefault();
        setDragging(false);
        takeFiles(Array.from(event.dataTransfer.files || []));
      }}
    >
      {dragging ? <div className="composer-drop-hint" aria-hidden="true">Drop files to attach</div> : null}
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
          onPaste={(event) => {
            if (!allowAttachments) return;
            // Pasted pictures and files are attached; very long text becomes a text attachment.
            const files = Array.from(event.clipboardData.files || []);
            if (files.length) {
              event.preventDefault();
              takeFiles(files);
              return;
            }
            const text = event.clipboardData.getData("text/plain");
            if (text.length > LONG_PASTE_CHARS && room) {
              event.preventDefault();
              takeFiles([pastedTextFile(removeEmDashes(text))]);
            }
          }}
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
          placeholder="Ask Selrano anything"
          rows={1}
          spellCheck
          autoFocus
        />
        {hint ? (
          <span className="pointer-events-none absolute -top-5 left-4 text-[11px] font-semibold text-[var(--muted)]">{hint}</span>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 px-2 pb-2 pt-1">
        {allowAttachments ? (
        <>
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
        </>
        ) : null}

        {onDepthChange ? (
          <label className="project-chip project-chip-select" title="Fast uses Gemini 4 Hydrogen; Deep uses Gemini 4 Argon with extended thinking">
            <Sparkles size={14} />
            <select
              aria-label="Thinking depth"
              value={depth}
              onChange={(event) => onDepthChange(event.target.value === "deep" ? "deep" : "fast")}
              className="max-w-[6rem] appearance-none truncate bg-transparent pr-1 outline-none"
            >
              <option value="fast">Fast</option>
              <option value="deep">Deep</option>
            </select>
          </label>
        ) : null}

        {onResponseStyleChange ? (
          <label className="project-chip project-chip-select" title="How Selrano answers in this chat">
            <SlidersHorizontal size={14} />
            <select
              aria-label="Response style"
              value={responseStyle || "normal"}
              onChange={(event) => onResponseStyleChange(event.target.value as ResponseStyleId)}
              className="max-w-[9rem] appearance-none truncate bg-transparent pr-1 outline-none"
            >
              {RESPONSE_STYLES.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

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
        {canDictate && !busy ? (
          <button
            type="button"
            className={`icon-button ${listening ? "text-[var(--accent)]" : ""}`}
            onClick={toggleDictation}
            aria-pressed={listening}
            aria-label={listening ? "Stop dictation" : "Dictate"}
            title={listening ? "Stop dictation" : "Dictate"}
          >
            {listening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        ) : null}
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
