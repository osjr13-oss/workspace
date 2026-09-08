import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BookOpen, Compass, FileText, Layers, ShieldCheck, Sparkles } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { LandingPreview } from "@/components/landing-preview";
import { Reveal } from "@/components/reveal";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#faf9f6] text-[#0d0d0d] antialiased selection:bg-neutral-200">
      {/* Floating Restrained Top Navigation */}
      <div className="sticky top-4 z-50 mx-auto max-w-5xl px-4">
        <header className="flex items-center justify-between rounded-full border border-black/[0.08] bg-white/85 px-4 py-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/logo.svg" alt="Selrano" width={28} height={28} priority />
              <span className="text-lg font-bold tracking-[-0.03em] text-[#0d0d0d]">Selrano</span>
            </Link>
            <span className="hidden sm:inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-600">
              Lumen 1
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-neutral-600">
            <a href="#capabilities" className="transition-colors hover:text-black">Capabilities</a>
            <a href="#materials" className="transition-colors hover:text-black">Materials</a>
            <Link href="/pricing" className="transition-colors hover:text-black">Pricing</Link>
            <Link href="/guides" className="transition-colors hover:text-black">Guides</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/signin"
              className="hidden sm:block text-sm font-medium text-neutral-600 hover:text-black transition-colors px-2"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#0d0d0d] px-4 text-xs font-semibold text-white shadow-sm hover:bg-neutral-800 transition-all active:scale-[0.98]"
            >
              <span>Start thinking</span>
              <ArrowRight size={13} strokeWidth={2.5} />
            </Link>
          </div>
        </header>
      </div>

      {/* Hero Showcase Card */}
      <section className="mx-auto max-w-6xl px-4 pt-6 pb-16 sm:pt-10 sm:pb-24">
        <div className="relative overflow-hidden rounded-[32px] sm:rounded-[44px] border border-black/[0.08] bg-[#090a10] text-white shadow-2xl">
          {/* Celestial atmospheric lighting */}
          <div
            className="pointer-events-none absolute inset-0 opacity-80"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 70% 45% at 50% -10%, rgba(245, 215, 175, 0.22), transparent 70%), radial-gradient(ellipse 60% 50% at 50% 25%, rgba(95, 105, 230, 0.14), transparent 80%)",
            }}
          />

          <div className="relative z-10 mx-auto max-w-4xl px-6 pt-16 pb-10 text-center sm:px-12 sm:pt-20">
            <p className="text-xs font-semibold tracking-[0.16em] uppercase text-white/60">
              Introducing Lumen 1
            </p>
            <h1 className="mt-5 text-4xl sm:text-6xl lg:text-7xl font-bold tracking-[-0.04em] text-white leading-[1.04] text-balance">
              Where early thoughts turn into clear decisions.
            </h1>
            <p className="mt-5 max-w-2xl mx-auto text-base sm:text-lg text-white/70 leading-relaxed font-normal">
              A calm, grounded thinking partner that remembers how you think, organizes your materials, and stays true to the facts.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-black shadow-lg hover:bg-neutral-100 transition-all hover:-translate-y-0.5"
              >
                <span>Begin with a thought</span>
                <ArrowRight size={15} strokeWidth={2.2} />
              </Link>
              <a
                href="#capabilities"
                className="inline-flex h-11 items-center rounded-full border border-white/12 bg-white/5 px-5 text-sm font-medium text-white/80 backdrop-blur-md hover:bg-white/10 transition-colors"
              >
                Explore capabilities
              </a>
            </div>
          </div>

          {/* Product Showcase Window inside Hero */}
          <div className="relative z-10 px-4 pb-12 sm:px-8 sm:pb-16">
            <LandingPreview />
          </div>
        </div>
      </section>

      {/* Capabilities Section */}
      <section id="capabilities" className="mx-auto max-w-6xl px-4 py-16 sm:py-24 border-t border-black/[0.06]">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
            Architecture & Capabilities
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#0d0d0d]">
            Designed for depth. Grounded in your truth.
          </h2>
          <p className="mt-3 text-base text-neutral-600 leading-relaxed">
            Lumen 1 is built around how people actually solve hard problems: starting with messy thoughts, pulling in private sources, and refining decisions over time.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <Reveal delay={0.05}>
            <div className="h-full rounded-2xl border border-black/[0.08] bg-white p-7 shadow-sm transition-all hover:shadow-md">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-800">
                <Sparkles size={20} strokeWidth={2.2} />
              </div>
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.1em] text-neutral-500">Adaptive Voice</p>
              <h3 className="mt-2 text-xl font-bold tracking-[-0.02em] text-[#0d0d0d]">
                Learns your cadence without losing the facts.
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                Lumen 1 adapts to your writing tone and thinking structure as you work together. It never reverts to robotic fluff, empty pleasantries, or generic templates.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="h-full rounded-2xl border border-black/[0.08] bg-white p-7 shadow-sm transition-all hover:shadow-md">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-800">
                <ShieldCheck size={20} strokeWidth={2.2} />
              </div>
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.1em] text-neutral-500">Source Grounding</p>
              <h3 className="mt-2 text-xl font-bold tracking-[-0.02em] text-[#0d0d0d]">
                Private files and live research in one place.
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                Connect PDFs, notes, or web research directly into any session. Sourced facts are strictly verified and isolated from model reasoning so you always know what is real.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="h-full rounded-2xl border border-black/[0.08] bg-white p-7 shadow-sm transition-all hover:shadow-md">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-800">
                <Layers size={20} strokeWidth={2.2} />
              </div>
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.1em] text-neutral-500">Durable Memory</p>
              <h3 className="mt-2 text-xl font-bold tracking-[-0.02em] text-[#0d0d0d]">
                Remembers key decisions across conversations.
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                Pick up where you left off. Durable facts, active projects, and past decisions stay available without cluttering your context window or leaking between projects.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Materials Workspace Section */}
      <section id="materials" className="mx-auto max-w-6xl px-4 py-16 sm:py-24 border-t border-black/[0.06]">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
            Integrated Workspace
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#0d0d0d]">
            Everything your thinking produces, unified.
          </h2>
          <p className="mt-3 text-base text-neutral-600 leading-relaxed">
            Selrano is not an isolated chat box. It is a calm workspace where your files, notes, and review decks live side by side with the model.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-black/[0.08] bg-white p-6 shadow-sm">
            <FileText size={20} className="text-neutral-700" />
            <h3 className="mt-4 text-lg font-bold text-[#0d0d0d]">Private Files</h3>
            <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
              Upload PDFs, research papers, and technical specs with signed uploads and private server-side text extraction.
            </p>
          </div>

          <div className="rounded-2xl border border-black/[0.08] bg-white p-6 shadow-sm">
            <BookOpen size={20} className="text-neutral-700" />
            <h3 className="mt-4 text-lg font-bold text-[#0d0d0d]">Living Notes</h3>
            <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
              Synthesize insights from conversations into structured notes with one click, organized neatly by project.
            </p>
          </div>

          <div className="rounded-2xl border border-black/[0.08] bg-white p-6 shadow-sm">
            <Compass size={20} className="text-neutral-700" />
            <h3 className="mt-4 text-lg font-bold text-[#0d0d0d]">Active Review</h3>
            <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
              Convert key concepts into flashcard decks for spaced practice and mastery without opening another app.
            </p>
          </div>
        </div>
      </section>

      {/* Tranquil Final Invitation */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:pb-28">
        <div className="rounded-[28px] sm:rounded-[36px] border border-black/[0.08] bg-white p-8 sm:p-14 text-center shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
            Begin with Selrano
          </p>
          <h2 className="mt-3 text-3xl sm:text-5xl font-bold tracking-[-0.035em] text-[#0d0d0d] max-w-2xl mx-auto leading-tight">
            Every clear decision begins with an unhurried thought.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-neutral-600 max-w-xl mx-auto leading-relaxed">
            Start free with Lumen 1. Ground your sources, refine your ideas, and keep your workspace organized.
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href="/signup"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-[#0d0d0d] px-7 text-sm font-semibold text-white shadow-md hover:bg-neutral-800 transition-all hover:-translate-y-0.5 active:scale-[0.98]"
            >
              <span>Start thinking in Selrano</span>
              <ArrowRight size={16} strokeWidth={2.2} />
            </Link>
          </div>
          <p className="mt-4 text-xs text-neutral-500">
            Free plan available. No credit card required.
          </p>
        </div>
      </section>

      {/* Site Footer */}
      <div className="mx-auto max-w-6xl px-4">
        <SiteFooter />
      </div>
    </main>
  );
}
