import { BookOpen, Brain, Files, FolderOpen, MessageSquare } from "lucide-react";
import { ScrollReveal } from "@/components/launch/scroll-reveal";

const items = [
  { icon: FolderOpen, title: "Client workspaces", body: "One calm home per client, retainer, or project." },
  { icon: Files, title: "Context files", body: "Upload briefs, transcripts, PDFs, and research for AI to reference." },
  { icon: MessageSquare, title: "Client-aware chat", body: "Ask questions and draft deliverables with the right workspace context." },
  { icon: BookOpen, title: "Markdown notes", body: "Capture meeting notes, strategy notes, feedback, and decisions." },
  { icon: Brain, title: "Briefs", body: "Save reusable facts, risks, decisions, and action items for review." }
];

export function WorkspaceBridge() {
  return (
    <section className="relative z-10 mx-auto max-w-7xl px-5 py-24 sm:px-6">
      <ScrollReveal className="max-w-2xl">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--muted)]">Full workspace</p>
        <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
          Built around the way solo client work actually happens.
        </h2>
        <p className="mt-4 text-sm leading-7 text-[var(--muted-strong)] sm:text-base">
          Selrano keeps the messy parts of client work connected: files, notes, chats, briefs, decisions, and the drafts
          you need to send next.
        </p>
      </ScrollReveal>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <ScrollReveal key={item.title} as="article" className="launch-glass p-6">
              <Icon size={22} />
              <h3 className="mt-5 text-base font-extrabold tracking-[-0.01em]">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">{item.body}</p>
            </ScrollReveal>
          );
        })}
      </div>
    </section>
  );
}
