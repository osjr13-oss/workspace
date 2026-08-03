import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { absoluteUrl, brand } from "@/lib/brand";
import { guides } from "@/lib/guides";

const guide = guides.find((entry) => entry.slug === "study-from-lecture-pdfs")!;

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

export default function StudyFromLecturePdfsGuide() {
  return (
    <article className="prose-selrano">
      <p className="text-sm font-bold text-[var(--muted)]">Guide</p>
      <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.035em] text-[var(--text)]">{guide.title}</h1>
      <p className="mt-4 text-base leading-7 text-[var(--muted-strong)]">
        Lecture PDFs pile up fast. The useful move is not to reread every slide; it is to keep the week&apos;s material in one
        place, then ask questions and review from that same source.
      </p>

      <h2 className="mt-10 text-xl font-extrabold tracking-[-0.02em] text-[var(--text)]">Start with the source file</h2>
      <p className="mt-3 text-base leading-7">
        Create a project for the class, upload the lecture PDF or syllabus, and let extraction finish. Once the file is
        ready, it becomes context for chat, notes, and later review instead of a download sitting in a folder you will
        not reopen.
      </p>

      <h2 className="mt-10 text-xl font-extrabold tracking-[-0.02em] text-[var(--text)]">Ask from the project, not from memory</h2>
      <p className="mt-3 text-base leading-7">
        Open chat inside that project and ask about definitions, examples, or what the professor emphasized. Grounded
        answers are only as good as the material you uploaded, which is the point: you are studying your course, not a
        generic summary of the subject.
      </p>

      <h2 className="mt-10 text-xl font-extrabold tracking-[-0.02em] text-[var(--text)]">Turn the hard parts into review</h2>
      <p className="mt-3 text-base leading-7">
        When a section keeps tripping you up, save a note or generate flashcards from that file. Flashcards are useful
        here as one output from the workspace, not the whole product. Keep the PDF, the note, and the deck attached to
        the same project so exam week does not become a scavenger hunt.
      </p>

      <h2 className="mt-10 text-xl font-extrabold tracking-[-0.02em] text-[var(--text)]">A simple weekly loop</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-base leading-7">
        <li>Upload that week&apos;s slides or reading.</li>
        <li>Ask two or three questions you would not want to miss on a quiz.</li>
        <li>Write a short note with the answers in your own words.</li>
        <li>Review only the cards or notes that still feel shaky.</li>
      </ol>

      <div className="panel mt-12 flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="font-extrabold text-[var(--text)]">Ready to study from your own PDFs?</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Start free with a class project. No card required.</p>
        </div>
        <Link href="/signup" className="btn-primary">
          Get started free
          <ArrowRight size={18} />
        </Link>
      </div>
    </article>
  );
}
