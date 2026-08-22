export const DECK_CATEGORIES = [
  "Anatomy & Medicine",
  "Nursing",
  "Pharmacology",
  "Biology",
  "Chemistry",
  "Physics",
  "Mathematics",
  "Computer Science",
  "Engineering",
  "Psychology",
  "Business & Economics",
  "Law & Government",
  "History",
  "Geography",
  "Languages",
  "Exam Prep",
  "Other"
] as const;

export type DeckCategory = (typeof DECK_CATEGORIES)[number];

export function normalizeDeckCategory(value: unknown): DeckCategory | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return (DECK_CATEGORIES as readonly string[]).includes(trimmed) ? (trimmed as DeckCategory) : null;
}
