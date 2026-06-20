import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { ScrollReveal } from "@/components/launch/scroll-reveal";

export function LaunchCta() {
  return (
    <section className="relative z-10 mx-auto max-w-7xl px-5 pb-24 sm:px-6">
      <ScrollReveal>
        <div className="launch-glass-dark px-8 py-12 text-center sm:px-14 sm:py-16">
          <Sparkles size={28} className="mx-auto opacity-80" />
          <h2 className="mt-6 text-3xl font-extrabold tracking-[-0.03em] text-balance sm:text-4xl">
            Start free. Upgrade when client work gets heavy.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[rgba(255,255,255,0.72)] sm:text-base">
            Free includes real usage for a few client workspaces. Pro is for solo consultants who want unlimited
            workspaces, larger uploads, and higher AI limits.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className="btn-invert min-h-12 px-7">
              Create free account
              <ArrowRight size={18} />
            </Link>
            <Link href="/pro/waitlist" className="btn-secondary min-h-12 border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.08)] px-7 text-[#fffefa]">
              Join Pro waitlist
            </Link>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
