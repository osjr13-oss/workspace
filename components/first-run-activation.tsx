"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, FileUp, FolderOpen, MessageSquare, X } from "lucide-react";

const STORAGE_KEY = "selrano_activation_dismissed";

type FirstRunActivationProps = {
  ready: boolean;
  projectId: string | null;
  hasMaterial: boolean;
  hasChat: boolean;
};

export function FirstRunActivation({ ready, projectId, hasMaterial, hasChat }: FirstRunActivationProps) {
  // null = localStorage not read yet; stay hidden to avoid a flash for established users.
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  useEffect(() => {
    // Established workspaces should never flash the checklist again.
    if (!ready) return;
    if (!(hasMaterial && hasChat)) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  }, [ready, hasMaterial, hasChat]);

  if (!ready || dismissed === null || dismissed || (hasMaterial && hasChat)) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // localStorage unavailable; still hide for this session.
    }
    setDismissed(true);
  }

  const steps = [
    {
      id: "project",
      title: "Open your class project",
      description: "Your Fall 2026 workspace is ready for a syllabus or lecture notes.",
      done: Boolean(projectId),
      href: projectId ? `/projects/${projectId}` : "/projects",
      icon: <FolderOpen size={18} />
    },
    {
      id: "material",
      title: "Add a file or note",
      description: "Upload a PDF or write a short note so Selrano has material to work from.",
      done: hasMaterial,
      href: projectId ? `/files?project=${projectId}` : "/files",
      icon: <FileUp size={18} />
    },
    {
      id: "chat",
      title: "Ask Selrano a question",
      description: "Ask about what you uploaded from the project chat.",
      done: hasChat,
      href: projectId ? `/chats?project=${projectId}` : "/chats",
      icon: <MessageSquare size={18} />
    }
  ];

  return (
    <section className="panel relative p-6">
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-4 top-4 rounded-full p-2 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
        aria-label="Dismiss getting started"
      >
        <X size={18} />
      </button>

      <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">Getting started</p>
      <h2 className="mt-2 text-base font-extrabold tracking-[-0.01em]">Set up your first study workspace</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-strong)]">
        Start with one class project, add your materials, then ask Selrano grounded questions.
      </p>

      <ol className="mt-5 space-y-3">
        {steps.map((step) => (
          <li key={step.id}>
            <Link
              href={step.href}
              className="flex items-start gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-[var(--surface-subtle)]"
            >
              <span
                className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                  step.done
                    ? "bg-[var(--low)] text-white"
                    : "bg-[var(--surface-subtle)] text-[var(--muted-strong)]"
                }`}
              >
                {step.done ? <Check size={16} /> : step.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-extrabold tracking-[-0.01em] text-[var(--text)]">
                  {step.title}
                </span>
                <span className="mt-1 block text-sm leading-6 text-[var(--muted)]">{step.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
