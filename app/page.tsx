import Link from "next/link";
import { ArrowRight, BookOpen, Brain, CheckCircle2, Files, MessageSquare, Sparkles, Upload } from "lucide-react";
import { SelranoLogo } from "@/components/selrano-logo";
import { SiteFooter } from "@/components/site-footer";

export default function LandingPage() {
  return (
    <main>
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[rgba(247,245,240,0.82)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6">
          <SelranoLogo />
          <nav className="hidden items-center gap-6 text-sm font-bold text-[var(--muted)] sm:flex">
            <a href="#features">Features</a>
            <Link href="/pricing">Pricing</Link>
            <a href="#workspace">Workspace</a>
            <Link href="/signin">Sign in</Link>
            <Link href="/signup" className="btn-primary">
              Get started
            </Link>
          </nav>
          <Link href="/signup" className="btn-primary sm:hidden">
            Start
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-14 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:pt-20">
        <div>
          <h1 className="max-w-3xl text-5xl font-extrabold leading-[1.02] tracking-[-0.035em] text-balance sm:text-6xl lg:text-7xl">
            A calm AI workspace for your notes, files, and study sessions.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--muted-strong)] sm:text-lg">
            Keep projects, notes, uploaded readings, grounded chat, flashcards, and review in one place so your material stays organized and usable.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="btn-primary">
              Get started free
              <ArrowRight size={18} />
            </Link>
            <Link href="#workflow" className="btn-secondary">
              See how it works
            </Link>
          </div>
          <div className="mt-8 grid max-w-2xl gap-3 text-sm font-bold text-[var(--muted-strong)] sm:grid-cols-3">
            {["Organize source material", "Ask grounded questions", "Review what matters"].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[var(--low)]" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div id="workspace" className="panel overflow-hidden p-4">
          <div className="grid min-h-[520px] grid-cols-[190px_1fr] overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--background-elevated)] max-sm:grid-cols-1">
            <aside className="border-r border-[var(--border)] p-4 max-sm:hidden">
              {["Home", "Files", "Flashcards", "Study", "Chats", "Notes"].map((item, index) => (
                <div
                  key={item}
                  className={`mb-2 rounded-2xl px-3 py-3 text-sm font-bold ${
                    index === 0 ? "bg-[var(--surface-subtle)] text-[var(--text)]" : "text-[var(--muted)]"
                  }`}
                >
                  {item}
                </div>
              ))}
            </aside>
            <div className="p-6">
              <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">Study plan</p>
              <h2 className="mt-12 text-4xl font-extrabold tracking-[-0.04em]">Bio midterm workspace</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">Notes, files, chats, and review material in one project.</p>
              <div className="panel mt-10 flex items-center justify-between p-5 shadow-none">
                <div className="flex items-center gap-4">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--surface-subtle)]">
                    <Brain size={20} />
                  </span>
                  <div>
                    <p className="font-extrabold">Ask with project context</p>
                    <p className="text-sm text-[var(--muted)]">Use uploaded lectures, notes, and cards as source material.</p>
                  </div>
                </div>
                <ArrowRight size={20} />
              </div>
              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                {[
                  { title: "Recent note", body: "Cell transport summary" },
                  { title: "Source file", body: "Cell biology week 4.pdf" },
                  { title: "Grounded chat", body: "Explain active transport using my lecture." },
                  { title: "Review", body: "18 cards due today." }
                ].map((item) => (
                  <div key={item.title} className="rounded-[16px] border border-[var(--border)] bg-white/60 p-5">
                    <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">{item.title}</p>
                    <p className="mt-6 text-sm font-bold leading-6 text-[var(--muted-strong)]">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="mx-auto max-w-7xl px-5 pb-16 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            { icon: Upload, title: "1. Gather the material", body: "Upload PDFs, DOCX files, text, or Markdown and keep everything organized by project." },
            { icon: MessageSquare, title: "2. Work with context", body: "Ask questions, draft, summarize, and reason with answers grounded in your own materials." },
            { icon: Brain, title: "3. Review what matters", body: "Turn important ideas into cards when repetition is useful, then keep track of what is due." }
          ].map((step) => {
            const Icon = step.icon;
            return (
              <article key={step.title} className="panel p-6">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--text)] text-white">
                  <Icon size={20} />
                </span>
                <h2 className="mt-5 text-lg font-extrabold tracking-[-0.01em]">{step.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">{step.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="features" className="mx-auto grid max-w-7xl gap-4 px-5 pb-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {[
          { icon: MessageSquare, title: "Project-aware chat", body: "Ask questions with notes, files, and flashcards as source context." },
          { icon: BookOpen, title: "Markdown notes", body: "Write structured study notes with a clean editor and preview." },
          { icon: Files, title: "File library", body: "Upload documents, extract text, and reuse them across your work." },
          { icon: Brain, title: "Flashcards and review", body: "Create decks when repetition helps, then review due cards inside the same workspace." },
          { icon: Sparkles, title: "Quick transformations", body: "Summarize, sharpen, expand, outline, and turn pasted text into useful study notes." }
        ].map((feature) => {
          const Icon = feature.icon;
          return (
            <article key={feature.title} className="glass-card p-6">
              <Icon size={22} />
              <h3 className="mt-5 text-base font-extrabold tracking-[-0.01em]">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">{feature.body}</p>
            </article>
          );
        })}
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-10 sm:px-6">
        <div className="rounded-[24px] bg-[var(--text)] p-8 text-[var(--background-elevated)] sm:p-10">
          <Sparkles size={24} />
          <h2 className="mt-5 max-w-2xl text-3xl font-extrabold tracking-[-0.03em] text-balance">Bring your material into one workspace.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/72">
            Start free with projects, uploads, notes, study review, and AI chat that uses your material.
          </p>
          <div className="mt-6">
            <Link href="/signup" className="btn-invert">
              Create workspace
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 sm:px-6">
        <SiteFooter />
      </div>
    </main>
  );
}
