import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SelranoLogo } from "@/components/selrano-logo";
import { SiteFooter } from "@/components/site-footer";
import { LandingCta } from "@/components/landing-cta";
import { LandingPreview } from "@/components/landing-preview";
import { Reveal } from "@/components/reveal";
import { SpotlightCard } from "@/components/spotlight-card";

export default function LandingPage() {
  return (
    <main>
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[rgba(247,245,240,0.82)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6">
          <SelranoLogo />
          <nav className="hidden items-center gap-6 text-sm font-bold text-[var(--muted)] sm:flex">
            <a href="#features">Features</a>
            <Link href="/pricing">Pricing</Link>
            <Link href="/guides">Guides</Link>
            <a href="#workspace">Preview</a>
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
            A private place to think out loud.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--muted-strong)] sm:text-lg">
            Talk through decisions, goals, and half-formed ideas. Selrano remembers what matters across every conversation and brings it back exactly when it helps.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LandingCta />
            <Link href="#workflow" className="btn-secondary">
              See how it works
            </Link>
          </div>
          <div className="mt-8 grid max-w-2xl gap-3 text-sm font-bold text-[var(--muted-strong)] sm:grid-cols-3">
            {[
              { label: "Memory", value: "What you figure out carries forward" },
              { label: "Grounding", value: "Web answers stay sourced" },
              { label: "Control", value: "Delete any conversation, anytime" }
            ].map((item) => (
              <div key={item.label} className="border-l border-[var(--border-strong)] pl-3">
                <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">{item.label}</p>
                <p className="mt-1">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <LandingPreview />
      </section>

      <section id="workflow" className="mx-auto max-w-7xl px-5 pb-16 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            { label: "Capture", title: "Say what is on your mind", body: "Type the raw version: a decision you keep circling, a goal, a worry, a rough plan. No structure required." },
            { label: "Go deeper", title: "Add context when it helps", body: "Selrano can search the live web with citations, or read your own notes and files when they should shape the answer." },
            { label: "Remember", title: "Pick up where you left off", body: "Durable facts and ongoing threads carry into future conversations. Ask what Selrano remembers anytime." }
          ].map((step, index) => {
            return (
              <Reveal key={step.title} delay={index * 0.08}>
                <SpotlightCard className="panel p-6 transition-transform duration-300 hover:-translate-y-1">
                  <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">{step.label}</p>
                  <h2 className="mt-5 text-lg font-extrabold tracking-[-0.01em]">{step.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">{step.body}</p>
                </SpotlightCard>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section id="features" className="mx-auto grid max-w-7xl gap-4 px-5 pb-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {[
          { label: "Think", title: "A conversation that goes deeper", body: "Work one idea as long as it needs. Responses adapt to the way you think and write." },
          { label: "Memory", title: "Continuity across sessions", body: "Goals, constraints, and preferences persist between chats, so you never start from zero." },
          { label: "Sources", title: "Grounded when facts matter", body: "Live web results arrive cited and clearly separated from your own material." },
          { label: "Notes", title: "Keep the good parts", body: "Save conclusions as notes, so a passing thought becomes something you can act on." },
          { label: "Control", title: "You hold the keys", body: "Edit any message, regenerate any answer, delete any conversation, or delete your account outright." }
        ].map((feature, index) => {
          return (
            <Reveal key={feature.title} delay={index * 0.06}>
              <SpotlightCard className="glass-card h-full p-6">
                <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">{feature.label}</p>
                <h3 className="mt-5 text-base font-extrabold tracking-[-0.01em]">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">{feature.body}</p>
              </SpotlightCard>
            </Reveal>
          );
        })}
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-10 sm:px-6">
        <SpotlightCard
          className="rounded-[24px] bg-[var(--text)] p-8 text-[var(--background-elevated)] sm:p-10"
          size="420px"
        >
          <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-white/60">Start with one thought</p>
          <h2 className="mt-5 max-w-2xl text-3xl font-extrabold tracking-[-0.03em] text-balance">Say it once. Selrano keeps the thread.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/72">
            Start free with private chat, durable memory, grounded web answers, and notes.
          </p>
          <div className="mt-6">
            <Link href="/signup" className="btn-invert">
              Start thinking
              <ArrowRight size={18} />
            </Link>
          </div>
        </SpotlightCard>
      </section>

      <div className="mx-auto max-w-7xl px-5 sm:px-6">
        <SiteFooter />
      </div>
    </main>
  );
}
