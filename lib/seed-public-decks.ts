import { PUBLIC_SEED_DECKS, type PublicSeedCard, type PublicSeedDeck } from "@/lib/seed-public-decks-data";

export type { PublicSeedCard, PublicSeedDeck };

/** Typed public starter decks for outreach and optional seeding scripts/APIs. */
export function getPublicSeedDecks(): PublicSeedDeck[] {
  return PUBLIC_SEED_DECKS;
}

export function getPublicSeedDeckBySlug(slug: string): PublicSeedDeck | undefined {
  return PUBLIC_SEED_DECKS.find((deck) => deck.slug === slug);
}

export { PUBLIC_SEED_DECKS };
