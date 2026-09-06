import Link from "next/link";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { SelranoLogo } from "@/components/selrano-logo";
import { SiteFooter } from "@/components/site-footer";
import { Reveal } from "@/components/reveal";
import { SpotlightCard } from "@/components/spotlight-card";

export default function LandingPage() {
  return (
    <main>
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[rgba(247,245,240,0.82)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <SelranoLogo />
          <nav className="flex items-center gap-5 text-sm font-bold text-[var(--muted)]">
            <a href="#how-it-works" className="hidden md:block">
              How it works
            </a>
            <Link href="/pricing" className="hidden sm:block">
              Pricing
            </Link>
            <Link href="/signin" className="hidden sm:block">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="btn-primary min-h-10 px-5 text-xs sm:text-sm"
            >
              Get started
              <ArrowRight size={15} />
            </Link>
          </nav>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-5 pb-16 pt-16 sm:px-8 sm:pt-24 lg:pb-24 lg:pt-28">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div>
            <div className="inline-flex items-center gap-2.5 text-xs font-bold text-[var(--muted-strong)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--low)]" />
              FOR PEOPLE BUILDING WITH AI
            </div>
            <h1 className="mt-7 text-5xl font-extrabold leading-[1.08] tracking-[-0.055em] sm:text-6xl lg:text-[4.25rem]">
              You built it.
              <br />
              <span className="text-[var(--muted)]">
                Now launch
                <br />
                with confidence.
              </span>
            </h1>
            <p className="mt-7 max-w-md text-base leading-8 text-[var(--muted-strong)]">
              Turn a website URL into a clear security report. Understand the
              issues, get prompts to fix them, and work through the details with
              your AI copilot.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn-primary">
                Scan your website
                <ArrowRight size={17} />
              </Link>
              <Link href="/sample-report" className="btn-secondary">
                View sample report
              </Link>
            </div>
            <p className="mt-5 text-xs text-[var(--muted)]">
              Start free. No code to connect. No credit card required.
            </p>
          </div>
          <Reveal>
            <SpotlightCard className="panel overflow-hidden !rounded-[24px]">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <ShieldCheck size={16} />
                  Website report
                </div>
                <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
                  Illustrative preview
                </span>
              </div>
              <div className="p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-[var(--muted)]">
                      Your public website
                    </p>
                    <p className="mt-2 text-xl font-extrabold tracking-tight">
                      your-next-idea.com
                    </p>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      A clear next step for every finding.
                    </p>
                  </div>
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-[var(--border-strong)]">
                    <ShieldCheck size={25} className="text-[var(--low)]" />
                  </div>
                </div>
                <div className="mt-8 flex items-center justify-between border-b border-[var(--border)] pb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                  <span>What needs attention</span>
                  <span>Priority</span>
                </div>
                {[
                  ["Content Security Policy is missing", "Medium", "--medium"],
                  ["Cookies need the Secure attribute", "Medium", "--medium"],
                  ["Add a security contact", "Low", "--low"],
                ].map(([title, level, color]) => (
                  <div
                    key={title}
                    className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-4"
                  >
                    <p className="text-xs font-semibold sm:text-sm">{title}</p>
                    <span
                      className="status-pill text-[10px]"
                      style={{ color: `var(${color})` }}
                    >
                      {level}
                    </span>
                  </div>
                ))}
                <div className="mt-6 rounded-2xl bg-[var(--surface-subtle)] p-5">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--muted)]">
                    From finding to fix
                  </p>
                  <p className="mt-3 text-sm leading-6">
                    “Help me add a Content Security Policy that works with my
                    existing app...”
                  </p>
                  <Link
                    href="/sample-report"
                    className="mt-4 inline-flex items-center gap-2 text-xs font-bold"
                  >
                    Explore the report
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </SpotlightCard>
          </Reveal>
        </div>
      </section>
      <div className="border-y border-[var(--border)]">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-4 px-5 py-6 text-xs font-semibold text-[var(--muted)] sm:px-8">
          {[
            "Public website scanning",
            "Evidence, not guesswork",
            "Fix prompts for your AI builder",
            "A copilot with context",
          ].map((text) => (
            <span key={text} className="flex items-center gap-2">
              <Check size={14} />
              {text}
            </span>
          ))}
        </div>
      </div>
      <section
        id="how-it-works"
        className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28"
      >
        <Reveal>
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
            A calmer way to check your work
          </p>
          <h2 className="mt-4 max-w-2xl text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">
            From “is this safe?”
            <br />
            to knowing what to do next.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            [
              "01",
              "Start with a link.",
              "Paste your public website URL. Selrano checks its pages, headers, HTTPS, forms, and frontend exposure for observable issues.",
            ],
            [
              "02",
              "Understand what matters.",
              "Read prioritized findings in plain language. See the evidence behind each issue and the limits of what was checked.",
            ],
            [
              "03",
              "Take it back to your builder.",
              "Copy a focused fix prompt into your AI coding tool. Ask Copilot for help, deploy your changes, and scan again.",
            ],
          ].map(([number, title, text]) => (
            <SpotlightCard key={number} className="panel p-7">
              <p className="text-xs font-bold text-[var(--muted)]">{number}</p>
              <h3 className="mt-10 text-lg font-extrabold tracking-tight">
                {title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">
                {text}
              </p>
            </SpotlightCard>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
        <Reveal>
          <div className="panel grid gap-8 p-8 sm:p-12 lg:grid-cols-2">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--muted)]">
                Built for your workflow
              </p>
              <h2 className="mt-5 max-w-md text-3xl font-extrabold tracking-[-0.035em]">
                Keep building.
                <br />
                We’ll help you see the gaps.
              </h2>
            </div>
            <div className="space-y-5 text-sm leading-7 text-[var(--muted-strong)]">
              <p>
                Whether you use an AI website builder or a coding assistant, the
                last mile can be hard to judge. Selrano gives you something
                concrete to work with: observed issues, clear explanations, and
                prompts you can act on.
              </p>
              <p className="text-[var(--muted)]">
                A passive scan is one useful check. It does not inspect private
                server code, test database permissions, or guarantee that a site
                is secure.
              </p>
              <Link
                href="/guides"
                className="inline-flex items-center gap-2 font-bold text-[var(--text)]"
              >
                Understand scan coverage
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
      <section className="mx-auto max-w-7xl px-5 pb-20 text-center sm:px-8">
        <h2 className="text-3xl font-extrabold tracking-[-0.035em] sm:text-4xl">
          Your next launch, a little clearer.
        </h2>
        <p className="mt-4 text-sm text-[var(--muted)]">
          Start with the website you’ve already built.
        </p>
        <Link href="/signup" className="btn-primary mt-7">
          Run your first scan
          <ArrowRight size={17} />
        </Link>
      </section>
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SiteFooter showHome={false} />
      </div>
    </main>
  );
}
