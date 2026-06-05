import Link from "next/link";
import { ArrowRight, BookOpen, Brain, Files, MessageSquare, Sparkles } from "lucide-react";
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
<h1 className="mt-6 max-w-3xl text-5xl font-extrabold leading-[1.02] tracking-[-0.035em] text-balance sm:text-6xl lg:text-7xl">
            A workspace for thinking, writing, and studying.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--muted-strong)] sm:text-lg">
            Selrano brings projects, notes, files, flashcards, study review, and project-aware AI chat into one calm workspace.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="btn-primary">
              Get started free
              <ArrowRight size={18} />
            </Link>
            <Link href="/signin" className="btn-secondary">
              Sign in
            </Link>
          </div>
        </div>

        <div id="workspace" className="panel overflow-hidden p-4">
          <div className="grid min-h-[520px] grid-cols-[190px_1fr] overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--background-elevated)] max-sm:grid-cols-1">
            <aside className="border-r border-[var(--border)] p-4 max-sm:hidden">
              {["Home", "Chats", "Projects", "Files", "Notes", "Flashcards"].map((item, index) => (
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
              <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">Home</p>
              <h2 className="mt-12 text-4xl font-extrabold tracking-[-0.04em]">Good afternoon.</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">What are you working on today?</p>
              <div className="panel mt-10 flex items-center justify-between p-5 shadow-none">
                <div className="flex items-center gap-4">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--surface-subtle)]">
                    <MessageSquare size={20} />
                  </span>
                  <div>
                    <p className="font-extrabold">Start a new conversation</p>
                    <p className="text-sm text-[var(--muted)]">Ask anything, draft something, think it through.</p>
                  </div>
                </div>
                <ArrowRight size={20} />
              </div>
              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                {["Recent chats", "Projects", "Recent files", "Quick actions"].map((item) => (
                  <div key={item} className="rounded-[16px] border border-[var(--border)] bg-white/60 p-5">
                    <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">{item}</p>
                    <div className="mt-6 h-3 w-2/3 rounded-full bg-[var(--surface-subtle)]" />
                    <div className="mt-3 h-3 w-1/2 rounded-full bg-[var(--surface-subtle)]" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto grid max-w-7xl gap-4 px-5 pb-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {[
          { icon: MessageSquare, title: "Project-aware chat", body: "Ask questions with notes, files, and flashcards as source context." },
          { icon: BookOpen, title: "Markdown notes", body: "Write structured study notes with a clean editor and preview." },
          { icon: Files, title: "File library", body: "Upload documents, extract text, and reuse them across your work." },
          { icon: Brain, title: "Study review", body: "Generate flashcards and review them with due-again tracking." }
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
          <h2 className="mt-5 max-w-2xl text-3xl font-extrabold tracking-[-0.03em] text-balance">Organize the work around how you actually think.</h2>
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
