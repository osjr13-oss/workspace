import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { absoluteUrl, brand } from "@/lib/brand";
import { guides } from "@/lib/guides";

const guide = guides.find((entry) => entry.slug === "private-study-workspace")!;

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

export default function PrivateStudyWorkspaceGuide() {
  return (
    <article className="prose-selrano">
      <p className="text-sm font-bold text-[var(--muted)]">Guide</p>
      <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.035em] text-[var(--text)]">{guide.title}</h1>
      <p className="mt-4 text-base leading-7 text-[var(--muted-strong)]">
        Most study tools split your work across tabs: files in Drive, notes in one app, cards in another, questions
        nowhere in particular. A private study workspace keeps your class materials together so the next question still
        knows what you uploaded.
      </p>

      <h2 className="mt-10 text-xl font-extrabold tracking-[-0.02em] text-[var(--text)]">One project per class</h2>
      <p className="mt-3 text-base leading-7">
        Treat a project as the boundary for a course. Syllabus, lecture uploads, personal notes, chats, and review decks
        all stay inside that project. Switching classes means switching projects, not rebuilding context from scratch.
      </p>

      <h2 className="mt-10 text-xl font-extrabold tracking-[-0.02em] text-[var(--text)]">Your materials stay yours</h2>
      <p className="mt-3 text-base leading-7">
        Uploads are private to your account. That matters when the slides are from your professor, the reading is not
        already online, or you want to draft messy notes before they are ready to share. Public decks can still help for
        common courses, but the core workflow is built around your own files.
      </p>

      <h2 className="mt-10 text-xl font-extrabold tracking-[-0.02em] text-[var(--text)]">Chat, notes, and review in the same place</h2>
      <p className="mt-3 text-base leading-7">
        Ask a question grounded in the project, save the useful answer as a note, then turn the hard sections into
        flashcards when you want spaced practice. The point is continuity: source material first, then the
        transformations that help you remember it.
      </p>

      <h2 className="mt-10 text-xl font-extrabold tracking-[-0.02em] text-[var(--text)]">When this is the right tool</h2>
      <p className="mt-3 text-base leading-7">
        If you already have a public deck that covers the whole course, a shared library may be enough. If the material
        is specific to your class, or you want answers that cite what you uploaded, a private workspace is the cleaner
        path.
      </p>

      <div className="panel mt-12 flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="font-extrabold text-[var(--text)]">Build a workspace around your classes</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Create a free account and start with one project.</p>
        </div>
        <Link href="/signup" className="btn-primary">
          Get started free
          <ArrowRight size={18} />
        </Link>
      </div>
    </article>
  );
}
