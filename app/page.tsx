import Link from "next/link";
import { ArrowRight, BookOpen, Brain, Check, Globe, Lock, Shield, Sparkles, Zap } from "lucide-react";
import { SelranoLogo } from "@/components/selrano-logo";
import { SiteFooter } from "@/components/site-footer";
import { LandingCta } from "@/components/landing-cta";
import { LandingPreview } from "@/components/landing-preview";
import { Reveal } from "@/components/reveal";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[var(--background)]">
      {/* Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
          <SelranoLogo />
          <nav className="hidden items-center gap-6 text-xs font-bold text-[var(--muted)] sm:flex">
            <a href="#features" className="hover:text-[var(--text)]">Features</a>
            <Link href="/pricing" className="hover:text-[var(--text)]">Pricing</Link>
            <Link href="/signin" className="hover:text-[var(--text)]">Sign In</Link>
            <Link href="/signup" className="btn-primary min-h-[36px] px-4 text-xs">
              Get Started
            </Link>
          </nav>
          <Link href="/signup" className="btn-primary min-h-[34px] px-3 text-xs sm:hidden">
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-5 pt-14 pb-16 sm:px-8 lg:pt-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-[var(--text)] sm:text-5xl lg:text-6xl text-balance">
              A private place to think out loud.
            </h1>

            <p className="mt-5 text-base leading-relaxed text-[var(--muted-strong)] sm:text-lg">
              Talk through complex decisions, architectural trade-offs, and half-formed ideas. Selrano remembers what matters across every session and brings it back when it counts.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <LandingCta />
              <a href="#features" className="btn-secondary">
                See How It Works
              </a>
            </div>

            {/* Micro Highlights */}
            <div className="mt-10 grid grid-cols-3 gap-4 border-t border-[var(--border)] pt-6 text-xs text-[var(--muted)]">
              <div>
                <p className="font-bold text-[var(--text)]">Durable Memory</p>
                <p className="mt-0.5">Facts persist across chats</p>
              </div>
              <div>
                <p className="font-bold text-[var(--text)]">Live Grounding</p>
                <p className="mt-0.5">Web and file citations</p>
              </div>
              <div>
                <p className="font-bold text-[var(--text)]">Private by Design</p>
                <p className="mt-0.5">You own your data</p>
              </div>
            </div>
          </div>

          <LandingPreview />
        </div>
      </section>

      {/* Bento Grid Feature Matrix */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-16 sm:px-8 border-t border-[var(--border)]">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
            How Selrano Works
          </h2>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
            Built for deep thinking, not ephemeral chat.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Card 1 */}
          <div className="panel p-6 bg-white shadow-xs space-y-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Brain size={18} />
            </div>
            <h3 className="text-base font-bold text-[var(--text)]">Durable Memory Bank</h3>
            <p className="text-xs leading-relaxed text-[var(--muted-strong)]">
              Selrano extracts key decisions, project constraints, and ongoing goals. You never have to re-explain your context from scratch.
            </p>
          </div>

          {/* Card 2 */}
          <div className="panel p-6 bg-white shadow-xs space-y-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Globe size={18} />
            </div>
            <h3 className="text-base font-bold text-[var(--text)]">Sourced Web Grounding</h3>
            <p className="text-xs leading-relaxed text-[var(--muted-strong)]">
              When facts and live data matter, Selrano searches the web in real-time and provides numbered source citations.
            </p>
          </div>

          {/* Card 3 */}
          <div className="panel p-6 bg-white shadow-xs space-y-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
              <BookOpen size={18} />
            </div>
            <h3 className="text-base font-bold text-[var(--text)]">Structured Knowledge</h3>
            <p className="text-xs leading-relaxed text-[var(--muted-strong)]">
              Distill passing thoughts into structured markdown notes and project spaces with one click.
            </p>
          </div>

          {/* Card 4 */}
          <div className="panel p-6 bg-white shadow-xs space-y-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Lock size={18} />
            </div>
            <h3 className="text-base font-bold text-[var(--text)]">Complete Data Sovereignty</h3>
            <p className="text-xs leading-relaxed text-[var(--muted-strong)]">
              Your conversations are private. Inspect what Selrano remembers, delete any fact, or erase your entire account anytime.
            </p>
          </div>

          {/* Card 5 */}
          <div className="panel p-6 bg-white shadow-xs space-y-3 sm:col-span-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Zap size={18} />
            </div>
            <h3 className="text-base font-bold text-[var(--text)]">Adaptive Writing Profile</h3>
            <p className="text-xs leading-relaxed text-[var(--muted-strong)]">
              Selrano automatically learns your communication style, brevity preferences, and technical depth over time to provide natural, zero-fluff responses.
            </p>
          </div>
        </div>
      </section>

      {/* Enterprise Bottom Banner */}
      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="rounded-2xl bg-slate-950 p-8 sm:p-12 text-white shadow-xl">
          <div className="max-w-2xl space-y-4">
            <span className="badge bg-slate-800 border-slate-700 text-slate-300 text-xs">
              Start with one thought
            </span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-balance">
              Say it once. Selrano maintains the thread.
            </h2>
            <p className="text-sm leading-relaxed text-slate-400">
              Get started with private thinking sessions, durable memory, grounded citations, and notes.
            </p>
            <div className="pt-2">
              <Link href="/signup" className="btn-invert min-h-[44px] px-6 text-sm font-bold">
                <span>Start Thinking Free</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SiteFooter />
      </div>
    </main>
  );
}
