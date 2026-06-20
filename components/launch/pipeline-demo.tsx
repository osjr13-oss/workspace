"use client";

import { useEffect, useState } from "react";
import { Brain, CheckCircle2, Files, FolderOpen, MessageSquare, Sparkles } from "lucide-react";
import { ScrollReveal } from "@/components/launch/scroll-reveal";

const steps = ["workspace", "context", "chat", "briefs"] as const;
type Step = (typeof steps)[number];

const stepLabels: Record<Step, string> = {
  workspace: "Client workspace",
  context: "Context files",
  chat: "Client-aware chat",
  briefs: "Brief cards"
};

export function PipelineDemo() {
  const [step, setStep] = useState<Step>("workspace");

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((current) => {
        const index = steps.indexOf(current);
        return steps[(index + 1) % steps.length];
      });
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="demo" className="relative z-10 mx-auto max-w-7xl px-5 py-24 sm:px-6">
      <ScrollReveal className="text-center">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--muted)]">Client pipeline</p>
        <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">From scattered context to client-ready work.</h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--muted-strong)] sm:text-base">
          Give each client a workspace, add the source material, then use AI to ask, draft, summarize, and preserve the
          details you need later.
        </p>
      </ScrollReveal>

      <ScrollReveal className="mt-12 flex justify-center">
        <div className="launch-phone-frame w-full max-w-[340px]">
          <div className="launch-phone-screen p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">Client Hub</p>
              <span className="status-pill">{stepLabels[step]}</span>
            </div>

            {step === "workspace" ? (
              <div className="mt-14 text-center">
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-2xl bg-[var(--text)] text-[var(--background-elevated)]">
                  <FolderOpen size={34} />
                </div>
                <p className="mt-6 text-xl font-extrabold">Acme Strategy Sprint</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Briefs, notes, files, chats, and decisions in one place.</p>
              </div>
            ) : null}

            {step === "context" ? (
              <div className="mt-10 space-y-3">
                {["Discovery call transcript.docx", "Brand audit.pdf", "Stakeholder feedback.md"].map((file) => (
                  <div key={file} className="launch-glass flex items-center gap-3 p-3 text-sm font-bold">
                    <Files size={17} />
                    <span>{file}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {step === "chat" ? (
              <div className="mt-10 space-y-3 text-sm leading-7">
                <div className="ml-auto max-w-[88%] rounded-[18px] bg-[var(--text)] p-3 text-left text-white">
                  Draft the follow-up email and flag open risks.
                </div>
                <div className="max-w-[92%] rounded-[18px] border border-[var(--border)] bg-white/72 p-3 text-[var(--muted-strong)]">
                  Here is a concise follow-up with three risks: timeline ownership, brand approvals, and missing analytics access.
                </div>
              </div>
            ) : null}

            {step === "briefs" ? (
              <div className="mt-12 text-center">
                <CheckCircle2 size={40} className="mx-auto text-[var(--low)]" />
                <p className="mt-4 text-lg font-extrabold">12 brief cards saved</p>
                <p className="mt-2 text-sm text-[var(--muted)]">Facts, risks, action items, and decisions ready for review.</p>
                <div className="mx-auto mt-8 flex justify-center gap-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="launch-glass h-20 w-28 p-3 text-left text-xs font-bold shadow-sm"
                      style={{ transform: `rotate(${-4 + i * 4}deg) translateY(${i * 4}px)` }}
                    >
                      Card {i + 1}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </ScrollReveal>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {steps.map((s) => (
          <span key={s} className={`status-pill ${step === s ? "border-[var(--border-strong)] bg-[var(--surface-strong)]" : ""}`}>
            {step === s ? <Sparkles size={12} /> : null}
            {stepLabels[s]}
          </span>
        ))}
      </div>
    </section>
  );
}
