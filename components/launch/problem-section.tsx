"use client";

import { ScrollReveal } from "@/components/launch/scroll-reveal";
import { useScrollReveal } from "@/components/launch/use-scroll-reveal";

const chips = ["Google Drive", "Call notes", "Client emails", "Briefs", "ChatGPT tab"];

export function ProblemSection() {
  const { ref, visible } = useScrollReveal<HTMLDivElement>(0.35);

  return (
    <section className="relative z-10 mx-auto max-w-7xl px-5 py-24 sm:px-6">
      <ScrollReveal>
        <div className="launch-glass-dark p-8 sm:p-12 lg:p-16">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[rgba(255,255,255,0.55)]">The problem</p>
          <h2 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-[-0.03em] text-balance sm:text-4xl lg:text-5xl">
            Five places for one client. None of them remember the work.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[rgba(255,255,255,0.72)]">
            You have the brief in one folder, call notes somewhere else, feedback in email, drafts in docs, and AI in
            another tab. By delivery day you are reconstructing context instead of moving the work forward.
          </p>

          <div
            ref={ref}
            className={`launch-problem-merge relative mt-12 grid min-h-[220px] place-items-center ${visible ? "is-visible" : ""}`}
          >
            <div className="flex flex-wrap items-center justify-center gap-3">
              {chips.map((chip) => (
                <span
                  key={chip}
                  className={`launch-chip launch-glass px-4 py-2 text-sm font-bold text-[var(--text)] ${visible ? "is-merged" : ""}`}
                >
                  {chip}
                </span>
              ))}
            </div>
            <div className="launch-merge-target absolute launch-glass px-8 py-6 text-center">
              <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">One workspace</p>
              <p className="mt-2 text-xl font-extrabold tracking-[-0.02em]">Selrano Client Hub</p>
              <p className="mt-1 text-sm text-[var(--muted-strong)]">Files - Notes - Briefs - Drafts</p>
            </div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
