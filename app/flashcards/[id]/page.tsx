import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseConfigured } from "@/lib/supabase/config";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DeckPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { id } = await params;
  if (!supabaseConfigured()) {
    return <main className="p-8 text-sm">Sign in is not configured.</main>;
  }
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect(`/signin?next=/flashcards/${id}`);
  const { data: deck, error } = await supabase.from("flashcard_decks").select("id, name, thread_id").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!deck) notFound();
  const { data: cards, error: cardsError } = await supabase
    .from("flashcards")
    .select("id, front, back")
    .eq("deck_id", id)
    .order("created_at", { ascending: true });
  if (cardsError) throw cardsError;

  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-[var(--bg)] px-5 py-10">
      <Link href={deck.thread_id ? `/chats?thread=${deck.thread_id}` : "/chats"} className="text-sm text-[var(--muted)]">
        Back to chat
      </Link>
      <h1 className="mt-6 font-serif text-4xl tracking-tight">{deck.name}</h1>
      <ol className="mt-8 space-y-4">
        {(cards || []).length ? (
          (cards || []).map((card, index) => (
            <li key={card.id} className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4">
              <p className="text-xs text-[var(--muted)]">{index + 1}</p>
              <p className="mt-1 font-medium">{card.front}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{card.back}</p>
            </li>
          ))
        ) : (
          <li className="text-sm text-[var(--muted)]">This deck has no cards.</li>
        )}
      </ol>
    </main>
  );
}
