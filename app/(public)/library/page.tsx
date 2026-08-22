import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { DECK_CATEGORIES, normalizeDeckCategory } from "@/lib/deck-categories";
import { getAuthenticatedUser, createSupabaseServerClient } from "@/lib/supabase/server";
import { absoluteUrl, brand } from "@/lib/brand";

export const dynamic = "force-dynamic";

type SearchParams = { q?: string; subject?: string; sort?: string; page?: string };

type LibraryDeck = {
  id: string;
  name: string;
  share_slug: string | null;
  category: string | null;
  duplicate_count: number;
  updated_at: string;
  card_count: number;
};

const PAGE_SIZE = 24;

const SORTS = [
  { id: "popular", label: "Most saved" },
  { id: "new", label: "Newest" }
] as const;

export const metadata: Metadata = {
  title: "Free flashcard library",
  description: `Browse flashcard decks shared by ${brand.name} students. Study any deck instantly without an account, then turn your own notes into decks in seconds.`,
  alternates: { canonical: absoluteUrl("/library") }
};

function libraryUrl(parts: { q?: string; subject?: string; sort?: string; page?: number }) {
  const params = new URLSearchParams();
  if (parts.q) params.set("q", parts.q);
  if (parts.subject) params.set("subject", parts.subject);
  if (parts.sort && parts.sort !== "popular") params.set("sort", parts.sort);
  if (parts.page && parts.page > 1) params.set("page", String(parts.page));
  const qs = params.toString();
  return qs ? `/library?${qs}` : "/library";
}

function pillClass(active: boolean) {
  return `shrink-0 rounded-full border px-4 py-1.5 text-sm font-bold transition ${
    active
      ? "border-transparent bg-[var(--text)] text-white"
      : "border-[var(--border)] text-[var(--muted-strong)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
  }`;
}

export default async function LibraryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 80) ?? "";
  const subject = normalizeDeckCategory(sp.subject);
  const sort = sp.sort === "new" ? "new" : "popular";
  const page = Math.max(1, Number.parseInt(sp.page || "1", 10) || 1);

  const supabase = await createSupabaseServerClient();

  let deckQuery = supabase
    .from("public_deck_library")
    .select("id, name, share_slug, category, duplicate_count, updated_at, card_count", { count: "exact" })
    .gt("card_count", 0);

  if (q) deckQuery = deckQuery.ilike("name", `%${q}%`);
  if (subject) deckQuery = deckQuery.eq("category", subject);

  deckQuery =
    sort === "new"
      ? deckQuery.order("updated_at", { ascending: false })
      : deckQuery.order("duplicate_count", { ascending: false }).order("updated_at", { ascending: false });

  const from = (page - 1) * PAGE_SIZE;
  const { data: deckRows, count } = await deckQuery.range(from, from + PAGE_SIZE - 1);

  const decks = (deckRows as LibraryDeck[] | null) ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const { user } = await getAuthenticatedUser();
  const hasFilters = Boolean(q || subject);

  return (
    <div>
      <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">
        Free flashcard library
      </p>
      <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.04em] text-[var(--text)]">
        Study decks shared by students
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted-strong)]">
        Flip through any deck right here, no account needed. Found a keeper? Save it to your
        workspace to practice, review, and make it your own.
      </p>

      <form action="/library" method="get" className="mt-8 flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          aria-label="Search decks"
          placeholder="Search decks"
          defaultValue={q}
          className="input-premium min-w-0 flex-1 px-5"
        />
        {subject ? <input type="hidden" name="subject" value={subject} /> : null}
        {sort !== "popular" ? <input type="hidden" name="sort" value={sort} /> : null}
        <button type="submit" className="btn-primary shrink-0">Search</button>
      </form>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {SORTS.map((option) => (
          <Link
            key={option.id}
            href={libraryUrl({ q, subject: subject ?? undefined, sort: option.id })}
            className={pillClass(sort === option.id)}
          >
            {option.label}
          </Link>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link href={libraryUrl({ q, sort })} className={pillClass(!subject)}>
          All subjects
        </Link>
        {DECK_CATEGORIES.map((category) => (
          <Link
            key={category}
            href={libraryUrl({ q, subject: category, sort })}
            className={pillClass(subject === category)}
          >
            {category}
          </Link>
        ))}
      </div>

      <div className="mt-10 flex items-baseline justify-between gap-4">
        <p className="text-sm font-bold text-[var(--muted)]">
          {total} deck{total === 1 ? "" : "s"}
          {hasFilters ? " found" : ""}
        </p>
        {totalPages > 1 ? (
          <p className="text-sm font-bold text-[var(--muted)]">
            Page {Math.min(page, totalPages)} of {totalPages}
          </p>
        ) : null}
      </div>

      {decks.length ? (
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <Link
              key={deck.id}
              href={`/d/${deck.share_slug}`}
              className="glass-card group flex flex-col p-5 transition hover:border-[var(--border-strong)]"
            >
              {deck.category ? (
                <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">
                  {deck.category}
                </p>
              ) : null}
              <h2 className="mt-2 font-extrabold leading-6 text-[var(--text)]">{deck.name}</h2>
              <p className="mt-auto pt-4 text-sm font-bold text-[var(--muted-strong)]">
                {deck.card_count} card{deck.card_count === 1 ? "" : "s"}
                {deck.duplicate_count > 0
                  ? ` · saved ${deck.duplicate_count} time${deck.duplicate_count === 1 ? "" : "s"}`
                  : ""}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="panel mt-4 p-8 text-center">
          <p className="text-sm font-bold text-[var(--text)]">No decks match your filters yet.</p>
          <p className="mt-2 text-sm text-[var(--muted-strong)]">
            Try another subject or search term, or be the first to publish one.
          </p>
          {hasFilters ? (
            <Link href="/library" className="btn-secondary mt-5 inline-flex">
              Clear filters
            </Link>
          ) : null}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="mt-8 flex items-center justify-between gap-4">
          {page > 1 ? (
            <Link href={libraryUrl({ q, subject: subject ?? undefined, sort, page: page - 1 })} className="btn-secondary">
              <ArrowLeft size={16} />
              Previous
            </Link>
          ) : (
            <span />
          )}
          {page < totalPages ? (
            <Link href={libraryUrl({ q, subject: subject ?? undefined, sort, page: page + 1 })} className="btn-secondary">
              Next
              <ArrowRight size={16} />
            </Link>
          ) : (
            <span />
          )}
        </div>
      ) : null}

      <div className="glass-card mt-14 flex flex-col gap-4 p-7 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-extrabold text-[var(--text)]">Turn your notes into decks like these</p>
          <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted-strong)]">
            Upload lecture slides or notes, pick what matters, and {brand.name} builds the deck.
            Share it with one link when you are done.
          </p>
        </div>
        {user ? (
          <Link href="/flashcards" className="btn-primary shrink-0">Open my flashcards</Link>
        ) : (
          <Link href="/signup?next=%2Fflashcards" className="btn-primary shrink-0">Create free account</Link>
        )}
      </div>
    </div>
  );
}
