/**
 * Changelog entries, newest first. Add a new entry here whenever a feature ships.
 * This file is the only thing the /changelog page reads.
 */
export type ChangelogEntry = {
  date: string; // e.g. "2026-08-22"
  title: string;
  description: string;
  tag?: "New" | "Improved" | "Fixed";
};

export const changelog: ChangelogEntry[] = [
  {
    date: "2026-08-22",
    title: "Durable Memory Bank and interactive thinking canvas",
    description:
      "Inspect, search, add, or delete lasting facts in your personal Memory Bank. Selrano automatically weaves what matters across your chats, with explicit tool-based memory saving and deep contextual recall on Pro.",
    tag: "New"
  },
  {
    date: "2026-08-22",
    title: "Global Command Palette and first-run milestones",
    description:
      "Press Cmd+K from anywhere in the app to search, switch contexts, or capture a thought. First-run thinkers now get a guided four-step path to explore chat, notes, file grounding, and memory.",
    tag: "New"
  },
  {
    date: "2026-08-22",
    title: "Enterprise-grade design system overhaul",
    description:
      "A complete visual rebuild with daylight canvas, obsidian type, hairline borders, multi-tier elevation shadows, and clean dock composers across notes, files, and projects.",
    tag: "Improved"
  },
  {
    date: "2026-08-21",
    title: "Repositioned as a private thinking companion",
    description:
      "Selrano is built for real-life decisions, personal goals, and daily reflection. The dashboard now leads with a quick-capture box and personal thinking topics.",
    tag: "Improved"
  },
  {
    date: "2026-08-13",
    title: "Founding Pro pricing and plan limits",
    description:
      "Pro is now $6.99 a month as a founding price with unlimited durable memory, deep contextual recall, and 1,500 monthly AI requests.",
    tag: "Improved"
  },
  {
    date: "2026-07-25",
    title: "Grounded live web search with citations",
    description:
      "Ask about current events, news, or recent developments, and Selrano will search the live web and provide numbered source citations directly in your answer.",
    tag: "New"
  },
  {
    date: "2026-07-24",
    title: "Adaptive writing profile and tone learning",
    description:
      "Selrano automatically adapts to your personal communication style, brevity preferences, and technical depth over time.",
    tag: "New"
  },
  {
    date: "2026-07-14",
    title: "Inline citations in chat",
    description:
      "Answers grounded in your uploaded documents and notes now carry clickable citation markers linked to exact source excerpts.",
    tag: "Improved"
  },
  {
    date: "2026-07-10",
    title: "Streaming AI responses and workspace actions",
    description:
      "Chat answers stream in real-time token-by-token. Ask Selrano to draft notes, synthesize materials, or search your workspace effortlessly.",
    tag: "New"
  }
];
