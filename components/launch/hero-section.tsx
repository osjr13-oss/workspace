"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ScrollReveal } from "@/components/launch/scroll-reveal";
import { HeroOrbFallback } from "@/components/launch/hero-orb-fallback";

export function HeroSection() {
  return (
    <section className="relative z-10 mx-auto flex min-h-[92vh] max-w-7xl flex-col items-center px-5 pb-20 pt-10 text-center sm:px-6 lg:pt-16">
      <ScrollReveal className="w-full">
        <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.65)] px-4 py-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--muted)] backdrop-blur-md">
          Built for independent consultants
        </p>
      </ScrollReveal>

      <div className="mt-8 w-full">
        <HeroOrbFallback />
      </div>

      <ScrollReveal className="mt-6 max-w-4xl">
        <h1 className="launch-hero-title text-balance text-[var(--text)]">
          Every client.
          <br />
          In one calm workspace.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-[var(--muted-strong)] sm:text-lg">
          Keep briefs, files, meeting notes, decisions, drafts, and client-aware AI chat together without turning your
          solo practice into enterprise software.
        </p>
      </ScrollReveal>

      <ScrollReveal className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/signup" className="btn-primary min-h-12 px-7 text-base">
          Start free
          <ArrowRight size={18} />
        </Link>
        <a href="#demo" className="btn-secondary min-h-12 px-7 text-base">
          See how it works
        </a>
      </ScrollReveal>
    </section>
  );
}
