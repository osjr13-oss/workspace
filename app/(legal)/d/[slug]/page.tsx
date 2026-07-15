import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AddPublicDeckButton } from "@/components/add-public-deck-button";
import { PublicDeckCards } from "@/components/public-deck-cards";
import { createSupabaseServerClient, getAuthenticatedUser } from "@/lib/supabase/server";
import { absoluteUrl, brand } from "@/lib/brand";

type Params = { slug: string };
type SearchParams = { add?: string };

const getPublicDeck = cache(async (slug: string) => {
  const supabase = await createSupabaseServerClient();
  const { data: deck } = await supabase
    .from("flashcard_decks")
    .select("id, name, is_public, share_slug")
    .eq("share_slug", slug)
    .eq("is_public", true)
    .maybeSingle();

  if (!deck) return null;

  const { data: cards } = await supabase
    .from("flashcards")
    .select("id, front, back")
    .eq("deck_id", deck.id)
    .order("created_at", { ascending: true });

  return { deck, cards: cards || [] };
});

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublicDeck(slug);
  if (!result) return { title: `Deck not found — ${brand.name}` };

  const { deck, cards } = result;
  const title = `${deck.name} flashcards — study free on ${brand.name}`;
  const description = `${cards.length} free flashcard${cards.length === 1 ? "" : "s"} on "${deck.name}". Study instantly, no signup required — then make your own with ${brand.name}.`;
  const url = absoluteUrl(`/d/${slug}`);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: brand.name,
      type: "website"
    },
    twitter: {
      card: "summary",
      title,
      description
    }
  };
}

export default async function PublicDeckPage({
  params,
  searchParams
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const { add } = await searchParams;
  const result = await getPublicDeck(slug);
  if (!result) notFound();

  const { deck, cards } = result;
  const { user } = await getAuthenticatedUser();

  return (
    <article>
      <p className="text-sm font-bold text-[var(--muted)]">Free flashcard deck</p>
      <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.035em] text-[var(--text)]">{deck.name}</h1>
      <p className="mt-4 text-base leading-7 text-[var(--muted-strong)]">
        {cards.length} card{cards.length === 1 ? "" : "s"} · study free, no account required.
      </p>

      <div className="mt-10">
        {cards.length ? (
          <PublicDeckCards cards={cards} />
        ) : (
          <div className="panel p-7 text-center text-sm text-[var(--muted)]">This deck has no cards yet.</div>
        )}
      </div>

      <AddPublicDeckButton
        slug={slug}
        deckName={deck.name}
        isAuthenticated={Boolean(user)}
        autoAdd={add === "1"}
      />
    </article>
  );
}
