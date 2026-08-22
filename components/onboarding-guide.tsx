"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Circle,
  Files,
  Lightbulb,
  MessageSquare,
  Settings,
  Sparkles,
  X
} from "lucide-react";

type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  cta: string;
};

const STEPS: OnboardingStep[] = [
  {
    id: "first_thought",
    title: "Start your first thinking session",
    description: "Work through a complex decision, technical strategy, or raw idea with grounded AI.",
    href: "/chats?compose=Help%20me%20break%20down%20our%20Q3%20architecture%20priorities",
    icon: MessageSquare,
    cta: "Try a starter thought"
  },
  {
    id: "create_note",
    title: "Distill insights into a note",
    description: "Capture key conclusions and reference points in your workspace notes.",
    href: "/notes",
    icon: BookOpen,
    cta: "Open Notes"
  },
  {
    id: "upload_file",
    title: "Ground AI with your materials",
    description: "Upload PDFs, docs, or specs to let Selrano search and cite your private documents.",
    href: "/files",
    icon: Files,
    cta: "Upload files"
  },
  {
    id: "style_profile",
    title: "Review memory and writing style",
    description: "See what Selrano learns about your communication style and durable constraints.",
    href: "/settings",
    icon: Settings,
    cta: "Open Settings"
  }
];

export function OnboardingGuide({
  hasThoughts = false,
  hasNotes = false,
  hasFiles = false
}: {
  hasThoughts?: boolean;
  hasNotes?: boolean;
  hasFiles?: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  useEffect(() => {
    const isDismissed = localStorage.getItem("selrano_onboarding_dismissed") === "true";
    setDismissed(isDismissed);

    const completed: string[] = [];
    if (hasThoughts) completed.push("first_thought");
    if (hasNotes) completed.push("create_note");
    if (hasFiles) completed.push("upload_file");
    setCompletedSteps(completed);
  }, [hasThoughts, hasNotes, hasFiles]);

  if (dismissed) return null;

  const progress = Math.round((completedSteps.length / STEPS.length) * 100);

  function dismiss() {
    setDismissed(true);
    localStorage.setItem("selrano_onboarding_dismissed", "true");
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-brand">Guiding Path</span>
            <span className="text-xs font-semibold text-[var(--muted)]">
              {completedSteps.length} of {STEPS.length} completed ({progress}%)
            </span>
          </div>
          <h2 className="mt-2 text-lg font-bold tracking-tight text-[var(--text)]">
            Welcome to Selrano. Here is how to get the most out of your thinking space.
          </h2>
          <p className="mt-1 text-sm text-[var(--muted-strong)]">
            Follow these guided milestones to experience durable memory and grounded context.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss guide"
          className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-slate-100 hover:text-[var(--text)]"
        >
          <X size={16} />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full bg-slate-900 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Grid of Milestones */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step) => {
          const isDone = completedSteps.includes(step.id);
          const Icon = step.icon;
          return (
            <div
              key={step.id}
              className={`flex flex-col justify-between rounded-xl border p-4 transition ${
                isDone
                  ? "border-emerald-200 bg-emerald-50/40"
                  : "border-[var(--border)] bg-slate-50/60 hover:border-[var(--border-strong)] hover:bg-white"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      isDone ? "bg-emerald-100 text-emerald-700" : "bg-slate-200/70 text-slate-700"
                    }`}
                  >
                    <Icon size={16} />
                  </div>
                  {isDone ? (
                    <CheckCircle2 size={18} className="text-emerald-600" />
                  ) : (
                    <Circle size={18} className="text-slate-300" />
                  )}
                </div>
                <h3 className="mt-3 text-sm font-bold text-[var(--text)]">{step.title}</h3>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{step.description}</p>
              </div>
              <div className="mt-4 pt-2">
                <Link
                  href={step.href}
                  className={`inline-flex items-center gap-1 text-xs font-semibold ${
                    isDone
                      ? "text-emerald-700 hover:underline"
                      : "text-slate-900 hover:underline"
                  }`}
                >
                  {isDone ? "Completed" : step.cta}
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
