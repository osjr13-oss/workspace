/**
 * Guide article registry. Add an entry here and create the matching page
 * under app/(legal)/guides/[slug]/. Both the guides index and the sitemap
 * read this file, so nothing else needs to change to publish one.
 */
export type Guide = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string; // e.g. "2026-07-23"
};

export const guides: Guide[] = [
  {
    slug: "study-from-lecture-pdfs",
    title: "How to Study From Lecture PDFs Without Losing the Thread",
    description:
      "Upload the week's slides once, then ask grounded questions, write notes, and review the parts that matter for your class.",
    publishedAt: "2026-08-03"
  },
  {
    slug: "private-study-workspace",
    title: "A Private Study Workspace for Your Own Class Materials",
    description:
      "Keep syllabi, lecture notes, chats, and review in one project that stays tied to the material you actually uploaded.",
    publishedAt: "2026-08-03"
  },
  {
    slug: "free-quizlet-alternative",
    title: "A Free Quizlet Alternative Built for Your Own Notes",
    description:
      "Quizlet is hard to beat for common courses with existing decks. Here's where it's worth using something else, and where the two actually differ.",
    publishedAt: "2026-07-23"
  }
];
