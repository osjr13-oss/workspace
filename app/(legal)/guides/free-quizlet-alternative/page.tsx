import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { absoluteUrl, brand } from "@/lib/brand";
import { guides } from "@/lib/guides";

const guide = guides.find((entry) => entry.slug === "free-quizlet-alternative")!;

export const metadata: Metadata = {
  title: guide.title,
  description: guide.description,
  alternates: { canonical: absoluteUrl(`/guides/${guide.slug}`) },
  openGraph: {
    title: guide.title,
    description: guide.description,
    url: absoluteUrl(`/guides/${guide.slug}`),
    siteName: brand.name,
    type: "article"
  }
};

export default function FreeQuizletAlternativeGuide() {
  return (
    <article className="prose-selrano">
      <p className="text-sm font-bold text-[var(--muted)]">Guide</p>
      <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.035em] text-[var(--text)]">{guide.title}</h1>
      <p className="mt-4 text-base leading-7 text-[var(--muted-strong)]">
        Quizlet is genuinely good at what it&apos;s built for, and it&apos;s worth saying that plainly before anything else.
        This is about one specific gap, not a case against it.
      </p>

      <h2 className="mt-10 text-xl font-extrabold tracking-[-0.02em] text-[var(--text)]">When Quizlet is the right call</h2>
      <p className="mt-3 text-base leading-7">
        If you&apos;re studying something common, like intro biology, a standard vocab list, or a widely-taught course, there&apos;s a
        good chance someone already built and shared a solid deck for it. Quizlet&apos;s free tier is generous, its library is
        enormous, and for material that already exists on the platform, there&apos;s often no reason to build anything yourself.
      </p>

      <h2 className="mt-10 text-xl font-extrabold tracking-[-0.02em] text-[var(--text)]">Where the gap actually is</h2>
      <p className="mt-3 text-base leading-7">
        The gap shows up when the material is yours specifically: your professor&apos;s slides, a reading nobody else has
        uploaded, your own lecture notes. Quizlet does have an AI feature for this now, called Magic Notes, which
        generates cards from a PDF or pasted text. It&apos;s a real feature. But it&apos;s gated behind Quizlet Plus, and the free
        tier caps it at two documents a week, which is not much if you&apos;re working through a full course&apos;s worth of
        reading.
      </p>
      <p className="mt-3 text-base leading-7">
        The other difference is structural, not just a pricing detail: in Quizlet, a generated deck is still a
        standalone set of cards. Your notes, your files, and any question you&apos;d want to ask about that same material
        live in separate places, if they live in the product at all.
      </p>

      <h2 className="mt-10 text-xl font-extrabold tracking-[-0.02em] text-[var(--text)]">What {brand.name} does differently</h2>
      <p className="mt-3 text-base leading-7">
        {brand.name} is built around a project, not a deck. Upload your own material once, and it stays connected to
        everything else in that project: notes you write, flashcards generated from it, spaced repetition review, and
        chat that answers questions grounded in the material you actually uploaded, not a generic answer pulled from
        nowhere in particular.
      </p>

      <h2 className="mt-10 text-xl font-extrabold tracking-[-0.02em] text-[var(--text)]">Pricing, honestly</h2>
      <p className="mt-3 text-base leading-7">
        Quizlet Plus runs about $3/month billed annually, or roughly $8/month billed monthly, and its free tier is hard
        to beat on price for basic flashcard use. {brand.name}&apos;s free plan includes 20 AI actions a day across chat,
        flashcard generation, and text transforms combined, plus 3 projects and 5 decks; Pro is $19/month for higher
        limits. If price is the only factor and your material is already common, Quizlet&apos;s free tier likely wins. The
        trade is scope: one tool for your material versus one price for a single feature.
      </p>

      <div className="mt-10 overflow-x-auto">
        <table className="data-table w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">&nbsp;</th>
              <th className="text-left">Quizlet</th>
              <th className="text-left">{brand.name}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>AI cards from your own PDF</td>
              <td>Plus only, 2 docs/week free</td>
              <td>Included in the free daily AI limit</td>
            </tr>
            <tr>
              <td>Chat grounded in your material</td>
              <td>Not part of the product</td>
              <td>Included</td>
            </tr>
            <tr>
              <td>Notes, files, and decks in one place</td>
              <td>Separate features</td>
              <td>One project</td>
            </tr>
            <tr>
              <td>Existing public deck library</td>
              <td>Large</td>
              <td>Small, growing</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="panel mt-12 flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="font-extrabold text-[var(--text)]">Working from your own material?</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Start free, no card required.</p>
        </div>
        <Link href="/signup" className="btn-primary">
          Get started free
          <ArrowRight size={18} />
        </Link>
      </div>
    </article>
  );
}
