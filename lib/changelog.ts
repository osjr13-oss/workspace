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
