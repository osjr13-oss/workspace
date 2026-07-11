import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { PublicDeckCards } from "@/components/public-deck-cards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { absoluteUrl, brand } from "@/lib/brand";

type Params = { slug: string };

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

export default async function PublicDeckPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const result = await getPublicDeck(slug);
  if (!result) notFound();

  const { deck, cards } = result;

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

      <div className="glass-card mt-12 flex flex-col items-start gap-4 p-7 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-extrabold">
            <Sparkles size={16} /> Made with {brand.name}
          </p>
          <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted-strong)]">
            Upload your notes and get flashcards like this in seconds.
          </p>
        </div>
        <Link href="/signup" className="btn-primary shrink-0">
          Try {brand.name} free
        </Link>
      </div>
    </article>
  );
}
