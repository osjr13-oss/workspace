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
  if (!result) return { title: "Deck not found" };

  const { deck, cards } = result;
  const title = `${deck.name} | Knowledge Deck`;
  const description = `${cards.length} card${cards.length === 1 ? "" : "s"} on "${deck.name}". Review freely, then make your own with ${brand.name}.`;
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
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Public Knowledge Deck</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">{deck.name}</h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--muted-strong)]">
        {cards.length} card{cards.length === 1 ? "" : "s"} · Review freely or save into your workspace.
      </p>

      <div className="mt-8">
        {cards.length ? (
          <PublicDeckCards cards={cards} />
        ) : (
          <div className="panel p-8 text-center text-xs text-[var(--muted)] bg-white shadow-xs">This deck has no cards yet.</div>
        )}
      </div>

      <div className="mt-6">
        <AddPublicDeckButton
          slug={slug}
          deckName={deck.name}
          isAuthenticated={Boolean(user)}
          autoAdd={add === "1"}
        />
      </div>
    </article>
  );
}
