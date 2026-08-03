/**
 * Changelog entries, newest first. Add a new entry here whenever a feature ships
 * This file is the only thing the /changelog page reads, so no other code
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
    date: "2026-08-03",
    title: "A more polished landing page",
    description:
      "The homepage and pricing cards now have a subtle cursor-tracking glow and a gentle reveal as you scroll, making the first look at Selrano feel more crafted.",
    tag: "Improved"
  },
  {
    date: "2026-07-25",
    title: "Web search that actually works",
    description:
      "Ask about anything time-sensitive, like news, prices, or a recent release, and Selrano now reliably searches the web and cites what it finds. The AI decides when a question needs current information instead of relying on specific trigger words.",
    tag: "Fixed"
  },
  {
    date: "2026-07-25",
    title: "A cleaner plan and billing page",
    description:
      "Removed the redundant usage counters from Settings. Also replaced a generic sparkle icon across the app with clearer ones: a crown for Pro, and the Selrano mark on shared decks.",
    tag: "Improved"
  },
  {
    date: "2026-07-24",
    title: "A calmer, more capable chat",
    description:
      "Prompts now sit in clean message cards, answers use a more readable editorial layout, and every completed response includes copy, read-aloud, and regenerate controls. A three-stage thinking trace shows what Selrano is doing while you wait.",
    tag: "Improved"
  },
  {
    date: "2026-07-24",
    title: "Memory that reaches back",
    description:
      "Selrano can build durable memories from earlier conversations when an established account has no saved memories yet. Direct questions about what Selrano knows now retrieve the strongest facts instead of relying only on matching words.",
    tag: "Fixed"
  },
  {
    date: "2026-07-24",
    title: "Weekly workspace check-ins",
    description:
      "People who opt into updates can now receive a useful weekly summary even when they are active. Delivery is claimed before sending to prevent duplicates, and failed sends release the claim for a later retry.",
    tag: "Improved"
  },
  {
    date: "2026-07-24",
    title: "Faster conversation cleanup",
    description:
      "Delete a conversation directly from the chat list without opening it first. The Study area also has a sharper, more modern navigation icon.",
    tag: "Improved"
  },
  {
    date: "2026-07-15",
    title: "Practice any deck anytime",
    description:
      "Open a deck from Flashcards and flip through every card whenever you want. Study mode stays for due-card review and spaced repetition, so practice never changes your schedule.",
    tag: "Improved"
  },
  {
    date: "2026-07-15",
    title: "Save shared decks to your workspace",
    description:
      "On any public deck link, tap Add to my workspace to copy the cards into your account, or sign up and return to the deck to save it.",
    tag: "New"
  },
  {
    date: "2026-07-14",
    title: "Inline citations in AI chat",
    description:
      "Answers grounded in your notes and files now carry clickable citation markers. Click one to jump straight to the exact passage and PDF page it came from.",
    tag: "New"
  },
  {
    date: "2026-07-14",
    title: "Chat says when your material doesn't cover it",
    description:
      "When your project's notes and files do not have anything relevant to a question, Selrano now says so plainly instead of quietly falling back on general knowledge.",
    tag: "Improved"
  },
  {
    date: "2026-07-11",
    title: "Share flashcard decks publicly",
    description:
      "Flip any deck to public from the Flashcards page and get a shareable link. Anyone can study it without an account, and it is fully readable to search engines.",
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
      "Ask Selrano to do things, not just answer. Try \"make me 10 flashcards on this chapter\" or \"draft a note summarizing this\" and it will use your own notes and files as context.",
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
