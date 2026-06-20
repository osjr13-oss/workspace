"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Brain, Files, MessageSquare, Sparkles } from "lucide-react";
import { ScrollReveal } from "@/components/launch/scroll-reveal";

const acts = [
  {
    id: "workspace",
    label: "Act 1",
    title: "Create a home for the client.",
    body: "Each client or project gets its own workspace, so notes, files, chats, and decisions stay together.",
    visual: "workspace" as const
  },
  {
    id: "context",
    label: "Act 2",
    title: "Add the messy context.",
    body: "Upload briefs, transcripts, PDFs, research, and source docs. Selrano makes them available to client-aware chat.",
    visual: "context" as const
  },
  {
    id: "draft",
    label: "Act 3",
    title: "Ask, summarize, and draft.",
    body: "Turn raw notes into action items, follow-up emails, project briefs, outlines, and client-ready drafts.",
    visual: "draft" as const
  },
  {
    id: "review",
    label: "Act 4",
    title: "Keep the important details close.",
    body: "Save brief cards for facts, risks, decisions, and open questions you need to remember across the engagement.",
    visual: "review" as const
  }
];

export function ScrollActs() {
  const [active, setActive] = useState(0);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = panelRefs.current.findIndex((node) => node === entry.target);
          if (index >= 0) setActive(index);
        });
      },
      { threshold: 0.55, rootMargin: "-15% 0px -15% 0px" }
    );

    panelRefs.current.forEach((node) => {
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section id="acts" className="relative z-10 mx-auto max-w-7xl px-5 py-24 sm:px-6">
      <ScrollReveal className="mb-14 max-w-2xl">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--muted)]">How it works</p>
        <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">Four acts. One client flow.</h2>
      </ScrollReveal>

      <div className="launch-section-pin">
        <div className="launch-section-pin-sticky space-y-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--muted)]">{acts[active]?.label}</p>
          <h3 className="text-2xl font-extrabold tracking-[-0.02em] sm:text-3xl">{acts[active]?.title}</h3>
          <p className="text-sm leading-7 text-[var(--muted-strong)] sm:text-base">{acts[active]?.body}</p>
          <div className="flex gap-2">
            {acts.map((_, i) => (
              <span
                key={acts[i].id}
                className={`h-1.5 rounded-full transition-all ${i === active ? "w-8 bg-[var(--text)]" : "w-3 bg-[var(--border-strong)]"}`}
              />
            ))}
          </div>
        </div>

        <div className="space-y-8">
          {acts.map((act, index) => (
            <div
              key={act.id}
              ref={(el) => {
                panelRefs.current[index] = el;
              }}
              className={`launch-act-panel launch-glass min-h-[280px] p-6 sm:p-8 ${index === active ? "is-active" : ""}`}
            >
              <ActVisual type={act.visual} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ActVisual({ type }: { type: "workspace" | "context" | "draft" | "review" }) {
  if (type === "workspace") {
    return (
      <div className="flex h-full flex-col items-center justify-center py-6 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--text)] text-[var(--background-elevated)]">
          <BookOpen size={26} />
        </div>
        <p className="mt-5 text-lg font-extrabold">Northstar Retainer</p>
        <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">A dedicated client workspace with notes, files, chats, and briefs.</p>
      </div>
    );
  }

  if (type === "context") {
    return (
      <div className="space-y-3 text-sm leading-7 text-[var(--muted-strong)]">
        {["Discovery notes.md", "Positioning audit.pdf", "Q3 stakeholder feedback.docx"].map((file) => (
          <div key={file} className="rounded-2xl border border-[var(--border)] bg-white/60 p-4">
            <Files size={16} className="mb-2 text-[var(--text)]" />
            <p className="font-bold text-[var(--text)]">{file}</p>
          </div>
        ))}
      </div>
    );
  }

  if (type === "draft") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-white/50 p-4 text-sm leading-6 text-[var(--muted)]">
          <p>Client wants a sharper launch narrative, clearer audience segments, and next steps before Friday.</p>
        </div>
        <div className="rounded-2xl border border-[var(--border-strong)] bg-white/70 p-4 text-sm">
          <MessageSquare size={16} className="mb-3" />
          <p className="font-extrabold">Follow-up email draft</p>
          <p className="mt-3 text-[var(--muted-strong)]">Here is the revised narrative, three open decisions, and a Friday approval path.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <Brain size={32} className="text-[var(--text)]" />
      <p className="mt-4 text-lg font-extrabold">Brief cards saved</p>
      <div className="mt-6 flex gap-2">
        {["Decision", "Risk", "Action"].map((label) => (
          <div key={label} className="launch-glass flex h-24 w-32 flex-col justify-between p-3 text-left text-xs font-bold">
            <BookOpen size={14} />
            <span>{label}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-2 text-sm text-[var(--muted)]">
        <Sparkles size={14} /> Ready for review
      </p>
    </div>
  );
}
