/**
 * Changelog entries, newest first. Add a new entry here whenever a feature ships
 * — this file is the only thing the /changelog page reads, so no other code
 * changes are needed to post an update.
 */
export type ChangelogEntry = {
  date: string; // e.g. "2026-07-08"
  title: string;
  description: string;
  tag?: "New" | "Improved" | "Fixed";
};

export const changelog: ChangelogEntry[] = [
  {
    date: "2026-07-14",
    title: "Inline citations in AI chat",
    description:
      "Answers grounded in your notes and files now carry clickable citation markers — click one to jump straight to the exact passage, and page for PDFs, it came from.",
    tag: "New"
  },
  {
    date: "2026-07-14",
    title: "Chat says when your material doesn't cover it",
    description:
      "When your project's notes and files don't have anything relevant to a question, Selrano now says so plainly instead of quietly falling back on general knowledge.",
    tag: "Improved"
  },
  {
    date: "2026-07-11",
    title: "Share flashcard decks publicly",
    description:
      "Flip any deck to public from the Flashcards page and get a shareable link — anyone can study it, no account required, and it's fully readable to search engines.",
    tag: "New"
  },
  {
    date: "2026-07-10",
    title: "Real-time streaming replies",
    description: "Chat answers now appear word-by-word as they're written, instead of waiting for the full response.",
    tag: "Improved"
  },
  {
    date: "2026-07-10",
    title: "AI actions in chat",
    description:
      "Ask Selrano to do things, not just answer — \"make me 10 flashcards on this chapter\" or \"draft a note summarizing this\" and it does it, using your own notes and files as context.",
    tag: "New"
  },
  {
    date: "2026-07-10",
    title: "Smarter file search",
    description: "Answers pulled from your uploaded files are now ranked by relevance, so Selrano finds the right passage even in long documents.",
    tag: "Improved"
  },
  {
    date: "2026-07-07",
    title: "The Selrano workspace",
    description: "Projects, notes, document uploads, project-aware chat, flashcards, and study review are available in one workspace.",
    tag: "New"
  }
];
