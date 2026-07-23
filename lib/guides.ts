/**
 * Guide article registry. Add an entry here and create the matching page
 * under app/(legal)/guides/[slug]/ — both the guides index and the sitemap
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
    slug: "free-quizlet-alternative",
    title: "A Free Quizlet Alternative Built for Your Own Notes",
    description:
      "Quizlet is hard to beat for common courses with existing decks. Here's where it's worth using something else, and where the two actually differ.",
    publishedAt: "2026-07-23"
  }
];
