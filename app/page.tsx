import Link from "next/link";
import { ArrowRight, Check, FileText, Globe2, ImageIcon, KeyRound, Lock, ShieldCheck, Trash2, Type } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { HeroDemo } from "@/components/marketing/hero-demo";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import {
  AskVignette,
  CitationVignette,
  GatherVignette,
  KeepVignette,
  StyleVignette,
  TransformVignette,
  WebVignette
} from "@/components/marketing/vignettes";
import { SiteFooter } from "@/components/site-footer";
import { Reveal } from "@/components/reveal";
import { formatPlanPrice, PLANS } from "@/lib/plans";

const formats = [
  { icon: <FileText size={16} />, label: "PDF" },
  { icon: <FileText size={16} />, label: "Word" },
  { icon: <Type size={16} />, label: "Text and Markdown" },
  { icon: <ImageIcon size={16} />, label: "Images, text read for you" },
  { icon: <Globe2 size={16} />, label: "The live web" }
];

const steps = [
  {
    n: "1",
    title: "Gather",
    body: "Put lecture slides, readings, drafts, and photos of the whiteboard into a project. Selrano reads them so you do not have to paste anything twice.",
    Vignette: GatherVignette
  },
  {
    n: "2",
    title: "Ask",
    body: "Ask the way you would ask a friend who read everything. Answers come from your material first, with a number on each claim.",
    Vignette: AskVignette
  },
  {
    n: "3",
    title: "Keep",
    body: "Save a good answer as a note, or turn a reading into review cards. What you learn stays in the project for next time.",
    Vignette: KeepVignette
  }
];

const features = [
  {
    eyebrow: "Grounded answers",
    title: "Answers that show their work.",
    body: "Every claim that comes from your files carries a number. Click it and Selrano opens the document at the exact passage, highlighted, so checking takes a second instead of a search.",
    points: ["Page-level citations for PDFs", "Notes and files from the same project", "One click to the cited passage"],
    Vignette: CitationVignette
  },
  {
    eyebrow: "Live research",
    title: "Current when it needs to be.",
    body: "When a question depends on something recent, Selrano searches the web on its own and lists the pages it used next to your own sources. You always know which is which.",
    points: ["Searches only when it helps", "Sources listed with every answer", "Your files and the web kept apart"],
    Vignette: WebVignette
  },
  {
    eyebrow: "Transformations",
    title: "Turn reading into something you keep.",
    body: "Summarize a chapter, pull out notes, or make a flashcard deck from any file or answer. Study mode brings the cards back when they are due, so review fits into a few minutes a day.",
    points: ["Summaries and structured notes", "Flashcard decks from any source", "Spaced review in Study"],
    Vignette: TransformVignette
  },
  {
    eyebrow: "Adapts to you",
    title: "Gets better at how you like answers.",
    body: "Tell Selrano once that you want shorter replies or bullets first, and it carries that into later chats. It learns your preferences without mixing them up with the facts in your sources.",
    points: ["Remembers lasting preferences", "Matches your tone over time", "Keeps facts tied to their sources"],
    Vignette: StyleVignette
  }
];

const privacy = [
  { icon: <Lock size={18} />, title: "Private by default", body: "Uploads live in private storage that only your account can open." },
  { icon: <ShieldCheck size={18} />, title: "Not used for training", body: "Your notes, files, and chats are used only to run Selrano for you." },
  { icon: <KeyRound size={18} />, title: "Encrypted", body: "Encrypted in transit and at rest, with passwords stored hashed." },
  { icon: <Trash2 size={18} />, title: "Yours to delete", body: "Delete your account and everything in it from Settings, any time." }
];

const faqs = [
  {
    q: "When can I sign up?",
    a: "New accounts are paused while we finish this version. Join the waitlist and we will email you as soon as sign-ups open. If you already have an account, you can sign in as usual."
  },
  {
    q: "What can I upload?",
    a: "PDFs, Word documents, plain text and Markdown, and images. Selrano reads the text in photos and screenshots too. Scanned PDFs without a text layer are not supported yet."
  },
  {
    q: "Is my content used to train AI models?",
    a: "No. Your notes, files, and chats are used only to give you answers inside Selrano. See the Privacy and Security pages for the details."
  },
  {
    q: "Is there a free plan?",
    a: "Yes. The free plan includes chat with your sources, projects, uploads, notes, and flashcards. Pro adds unlimited projects and decks and larger uploads."
  },
  {
    q: "Can Selrano search the web?",
    a: "Yes. When a question needs current information, Selrano searches the live web and lists the pages it used, separate from your own files."
  },
  {
    q: "Does it work on my phone?",
    a: "Yes. Selrano runs in any modern browser, and you can add it to your home screen for an app-like window."
  }
];

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main id="top" className="overflow-x-clip">
        {/* Hero */}
        <section className="relative">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px] bg-[radial-gradient(50%_45%_at_50%_0%,rgba(255,253,247,0.95),transparent_75%),radial-gradient(35%_35%_at_88%_18%,rgba(236,212,138,0.2),transparent_70%),radial-gradient(30%_30%_at_10%_30%,rgba(27,45,80,0.035),transparent_70%)]"
          />
          <div className="mx-auto max-w-6xl px-5 pb-10 pt-14 text-center sm:px-8 sm:pt-20 lg:pt-24">
            <p className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[13px] text-[var(--muted-strong)] shadow-[0_1px_2px_rgba(40,36,28,0.05)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--medium)]" />
              New accounts open soon
            </p>
            <h1 className="title-display mx-auto mt-6 max-w-4xl text-balance text-[44px] leading-[1.02] sm:text-[64px] lg:text-[78px]">
              Your notes, files, and the web, in one <em className="italic text-[var(--accent)]">calm</em> place to think.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-[17px] leading-[1.65] text-[var(--muted-strong)] sm:text-lg">
              Selrano is an AI workspace for the material you already have. Ask a question and get an answer that points to the exact page
              it came from, then keep what matters as notes and review cards.
            </p>
            <div className="mx-auto mt-9 max-w-lg text-left">
              <WaitlistForm />
            </div>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Already have an account?{" "}
              <Link href="/signin" className="font-medium text-[var(--accent)] underline decoration-[var(--accent-ring)] underline-offset-4 hover:decoration-current">
                Sign in
              </Link>
            </p>
          </div>

          <div className="mx-auto max-w-6xl px-3 sm:px-8">
            <Reveal>
              <HeroDemo />
            </Reveal>
          </div>
        </section>

        {/* Formats */}
        <section aria-labelledby="formats" className="mx-auto max-w-6xl px-5 pt-16 sm:px-8">
          <h2 id="formats" className="text-center text-sm text-[var(--muted)]">
            Works with what you already have
          </h2>
          <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {formats.map((format) => (
              <li key={format.label} className="flex items-center gap-2 text-[15px] font-medium text-[var(--muted-strong)]">
                <span className="text-[var(--accent)]">{format.icon}</span>
                {format.label}
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 pt-28 sm:px-8">
          <div className="max-w-2xl">
            <p className="eyebrow eyebrow-accent">How it works</p>
            <h2 className="title-display mt-3 text-balance text-4xl sm:text-5xl">Bring your material. Ask. Keep what helps.</h2>
          </div>
          <ol className="mt-14 grid gap-10 lg:grid-cols-3 lg:gap-8">
            {steps.map(({ n, title, body, Vignette }, index) => (
              <li key={title}>
                <Reveal delay={index * 0.08} className="flex h-full flex-col">
                  <div className="flex items-center gap-4">
                    <span className="font-display text-[44px] leading-none text-[var(--accent)]">{n}</span>
                    <span className="h-px flex-1 bg-[var(--border-strong)]" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold tracking-[-0.015em]">{title}</h3>
                  <p className="mt-2 text-[15px] leading-[1.65] text-[var(--muted-strong)]">{body}</p>
                  <div className="mt-6 flex-1">
                    <Vignette />
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-5 pt-32 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow eyebrow-accent">What you can do</p>
            <h2 className="title-display mt-3 text-balance text-4xl sm:text-5xl">One place for reading, asking, and remembering.</h2>
          </div>
          <div className="mt-20 space-y-24 lg:space-y-32">
            {features.map(({ eyebrow, title, body, points, Vignette }, index) => (
              <Reveal key={title}>
                <article className="grid items-center gap-10 lg:grid-cols-2 lg:gap-20">
                  <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                    <p className="eyebrow eyebrow-accent">{eyebrow}</p>
                    <h3 className="title-display mt-3 text-balance text-3xl sm:text-[40px]">{title}</h3>
                    <p className="mt-4 max-w-lg text-[16px] leading-[1.7] text-[var(--muted-strong)]">{body}</p>
                    <ul className="mt-6 space-y-2.5">
                      {points.map((point) => (
                        <li key={point} className="flex items-start gap-3 text-[15px] text-[var(--text)]">
                          <Check size={16} className="mt-[3px] shrink-0 text-[var(--accent)]" strokeWidth={2.25} />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={`relative ${index % 2 === 1 ? "lg:order-1" : ""}`}>
                    <div aria-hidden="true" className="absolute -inset-3 -z-10 rounded-[28px] bg-[var(--surface-sunken)] sm:-inset-5" />
                    <Vignette />
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Privacy */}
        <section className="px-3 pt-32 sm:px-6">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-[var(--accent)] px-6 py-14 text-[var(--on-accent)] sm:px-12 sm:py-16">
            <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
              <div>
                <p className="text-[13px] font-medium text-white/60">Privacy</p>
                <h2 className="mt-3 font-display text-4xl font-medium leading-[1.08] tracking-[-0.02em] text-balance sm:text-5xl">Your material stays yours.</h2>
                <p className="mt-4 max-w-md text-[16px] leading-[1.7] text-white/72">
                  Selrano is built to work with private coursework, drafts, and notes. Here is what that means in practice.
                </p>
                <Link href="/security" className="mt-7 inline-flex items-center gap-2 text-[15px] font-medium text-white hover:underline">
                  How we protect your data <ArrowRight size={16} />
                </Link>
              </div>
              <ul className="grid gap-x-10 gap-y-9 sm:grid-cols-2">
                {privacy.map((item) => (
                  <li key={item.title}>
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white">{item.icon}</span>
                    <h3 className="mt-4 text-[17px] font-semibold">{item.title}</h3>
                    <p className="mt-1.5 text-[15px] leading-[1.6] text-white/70">{item.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="mx-auto max-w-6xl px-5 pt-32 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow eyebrow-accent">Pricing</p>
            <h2 className="title-display mt-3 text-4xl sm:text-5xl">Start free. Grow into Pro.</h2>
          </div>
          <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
            <PlanCard
              name={PLANS.free.name}
              price="$0"
              note={PLANS.free.tagline}
              items={[
                "Chat grounded in your sources",
                `${PLANS.free.maxProjects} projects`,
                `Uploads up to ${PLANS.free.maxFileMb} MB`,
                `${PLANS.free.maxDecks} flashcard decks`
              ]}
              cta={
                <Link href="#waitlist" className="btn-secondary w-full">
                  Join the waitlist
                </Link>
              }
            />
            <PlanCard
              featured
              name={PLANS.pro.name}
              price={formatPlanPrice(PLANS.pro.priceMonthly)}
              note={PLANS.pro.tagline}
              items={["Everything in Free", "Unlimited projects", `Uploads up to ${PLANS.pro.maxFileMb} MB`, "Unlimited flashcard decks"]}
              cta={
                <Link href="/pricing" className="btn-primary w-full">
                  See Pro details
                </Link>
              }
            />
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-5 pt-32 sm:px-8">
          <h2 className="title-display text-center text-4xl sm:text-5xl">Questions</h2>
          <div className="mt-10 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {faqs.map((item) => (
              <details key={item.q} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 rounded-lg py-4 text-[17px] font-medium focus-ring [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span className="relative h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden="true">
                    <span className="absolute left-0 top-1/2 h-px w-4 bg-current" />
                    <span className="absolute left-1/2 top-0 h-4 w-px bg-current transition-transform duration-200 group-open:scale-y-0" />
                  </span>
                </summary>
                <p className="pb-5 pr-10 text-[15.5px] leading-[1.7] text-[var(--muted-strong)]">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section id="waitlist" className="scroll-mt-24 px-5 pb-24 pt-32 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="title-display text-balance text-4xl sm:text-[56px]">Be first in when Selrano opens.</h2>
            <p className="mx-auto mt-4 max-w-lg text-[17px] leading-[1.65] text-[var(--muted-strong)]">
              Leave your email and we will let you know the moment new accounts are available.
            </p>
            <div className="mx-auto mt-8 max-w-lg text-left">
              <WaitlistForm />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function PlanCard({
  name,
  price,
  note,
  items,
  cta,
  featured = false
}: {
  name: string;
  price: string;
  note: string;
  items: string[];
  cta: React.ReactNode;
  featured?: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded-[22px] border bg-[var(--surface)] p-7 ${
        featured ? "border-[var(--accent)] shadow-[var(--shadow-lift)]" : "border-[var(--border)] shadow-[var(--shadow-tight)]"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-semibold">{name}</p>
        {featured ? <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-[12px] font-medium text-[var(--accent)]">Founding price</span> : null}
      </div>
      <p className="mt-4 flex items-baseline gap-1">
        <span className="font-display text-[46px] font-medium leading-none tracking-[-0.02em]">{price}</span>
        <span className="text-[15px] text-[var(--muted)]">/ month</span>
      </p>
      <p className="mt-3 text-[15px] text-[var(--muted-strong)]">{note}</p>
      <ul className="mt-6 flex-1 space-y-2.5 border-t border-[var(--border)] pt-6">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-[15px]">
            <Check size={16} className="mt-[3px] shrink-0 text-[var(--accent)]" strokeWidth={2.25} />
            {item}
          </li>
        ))}
      </ul>
      <div className="mt-8">{cta}</div>
    </div>
  );
}
