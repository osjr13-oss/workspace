import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SelranoLogo } from "@/components/selrano-logo";
import { SiteFooter } from "@/components/site-footer";
import { Reveal } from "@/components/reveal";
import { SpotlightCard } from "@/components/spotlight-card";

export default function LandingPage() {
  return (
    <main>
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[rgba(247,245,240,0.82)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6">
          <SelranoLogo />
          <Link href="/signin" className="btn-primary">
            Sign in
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 pb-16 pt-16 sm:px-6 lg:pt-24">
        <h1 className="text-5xl font-extrabold leading-[1.02] tracking-[-0.035em] text-balance sm:text-6xl">
          Lose weight without turning your life into a spreadsheet.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--muted-strong)] sm:text-lg">
          Tell Selrano what you ate in a sentence or a photo, check in on your weight, and get a coach that knows your
          week. Targets stay safe, numbers stay honest, and the small steps add up.
        </p>
        <div className="mt-8">
          <Link href="/signin" className="btn-primary">
            Get started
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 pb-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {[
          { label: "Log", title: "Seconds, not minutes", body: "Type a meal, snap a photo, scan a barcode, or tap a recent favorite." },
          { label: "Coach", title: "Advice that knows you", body: "Your coach sees your targets, your days, and your trend, and talks like a person." },
          { label: "Trend", title: "Signal over noise", body: "A smoothed weight trend shows real progress through daily ups and downs." },
          { label: "Safe", title: "Sensible by design", body: "Targets have floors and pace limits, and the coach never pushes extremes." }
        ].map((feature, index) => (
          <Reveal key={feature.title} delay={index * 0.06}>
            <SpotlightCard className="glass-card h-full p-6">
              <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">{feature.label}</p>
              <h2 className="mt-5 text-base font-extrabold tracking-[-0.01em]">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">{feature.body}</p>
            </SpotlightCard>
          </Reveal>
        ))}
      </section>

      <div className="mx-auto max-w-7xl px-5 sm:px-6">
        <SiteFooter />
      </div>
    </main>
  );
}
