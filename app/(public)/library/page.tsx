import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Plus } from "lucide-react";
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
  title: "Community knowledge decks",
  description: `Browse shared knowledge decks on ${brand.name}.`,
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
  return `shrink-0 rounded-full border px-3.5 py-1 text-xs font-semibold transition ${
    active
      ? "border-transparent bg-slate-900 text-white shadow-xs"
      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
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
    <div className="space-y-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
          Public Knowledge Decks
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
          Browse community shared decks
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted-strong)]">
          Explore shared knowledge decks created with Selrano. Save any deck into your private workspace with one click.
        </p>
      </div>

      <form action="/library" method="get" className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          aria-label="Search decks"
          placeholder="Search by topic or title..."
          defaultValue={q}
          className="input-enterprise min-w-0 flex-1"
        />
        {subject ? <input type="hidden" name="subject" value={subject} /> : null}
        {sort !== "popular" ? <input type="hidden" name="sort" value={sort} /> : null}
        <button type="submit" className="btn-primary shrink-0">
          Search
        </button>
      </form>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
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

        <div className="flex flex-wrap items-center gap-2">
          <Link href={libraryUrl({ q, sort })} className={pillClass(!subject)}>
            All topics
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
      </div>

      <div className="flex items-baseline justify-between gap-4 border-t border-[var(--border)] pt-6">
        <p className="text-xs font-bold text-[var(--muted)]">
          {total} deck{total === 1 ? "" : "s"}
          {hasFilters ? " found" : ""}
        </p>
        {totalPages > 1 && (
          <p className="text-xs font-semibold text-[var(--muted)]">
            Page {Math.min(page, totalPages)} of {totalPages}
          </p>
        )}
      </div>

      {decks.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <Link
              key={deck.id}
              href={`/d/${deck.share_slug}`}
              className="panel group flex flex-col p-5 bg-white shadow-xs transition hover:border-[var(--border-strong)]"
            >
              {deck.category && (
                <span className="badge badge-subtle text-[10px] w-fit">
                  {deck.category}
                </span>
              )}
              <h2 className="mt-2 text-sm font-bold leading-snug text-[var(--text)]">{deck.name}</h2>
              <p className="mt-auto pt-4 text-xs font-medium text-[var(--muted)]">
                {deck.card_count} card{deck.card_count === 1 ? "" : "s"}
                {deck.duplicate_count > 0 ? ` · saved ${deck.duplicate_count} times` : ""}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="panel p-8 text-center bg-white shadow-xs">
          <p className="text-sm font-bold text-[var(--text)]">No decks match your filters yet.</p>
          <p className="mt-1 text-xs text-[var(--muted-strong)]">
            Try another subject or search query.
          </p>
          {hasFilters && (
            <Link href="/library" className="btn-secondary mt-4 inline-flex">
              Clear filters
            </Link>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 pt-4">
          {page > 1 ? (
            <Link href={libraryUrl({ q, subject: subject ?? undefined, sort, page: page - 1 })} className="btn-secondary">
              <ArrowLeft size={15} />
              <span>Previous</span>
            </Link>
          ) : (
            <span />
          )}
          {page < totalPages ? (
            <Link href={libraryUrl({ q, subject: subject ?? undefined, sort, page: page + 1 })} className="btn-secondary">
              <span>Next</span>
              <ArrowRight size={15} />
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}

      <div className="panel flex flex-col gap-4 p-7 sm:flex-row sm:items-center sm:justify-between bg-slate-900 text-white">
        <div className="space-y-1">
          <p className="text-sm font-bold text-white">Build decks from your private thoughts</p>
          <p className="max-w-md text-xs leading-relaxed text-slate-300">
            Upload notes or think out loud in chat, and Selrano will structure your knowledge into concise review decks.
          </p>
        </div>
        {user ? (
          <Link href="/flashcards" className="btn-invert shrink-0">Open Flashcards</Link>
        ) : (
          <Link href="/signup?next=%2Fflashcards" className="btn-invert shrink-0">Create Free Workspace</Link>
        )}
      </div>
    </div>
  );
}
