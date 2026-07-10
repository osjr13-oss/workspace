"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { WorkspaceHeader } from "@/components/workspace-header";
import { EmptyState } from "@/components/empty-state";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Flashcard } from "@/lib/types";

// Cards are ordered oldest-due-first for spaced repetition, but that means a large
// backlog of never-reviewed cards can push brand-new cards past the fetch limit,
// making them silently invisible. A generous batch size keeps that from happening
// for the vast majority of users; totalDue below covers the rest.
const BATCH_SIZE = 300;

export default function StudyPage() {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const current = useMemo(() => cards[index] || null, [cards, index]);

  async function load() {
    const supabase = createSupabaseBrowserClient();
    setError("");
    const dueFilter = `due_at.is.null,due_at.lte.${new Date().toISOString()}`;
    const [cardsResult, countResult] = await Promise.all([
      supabase
        .from("flashcards")
        .select("*")
        .or(dueFilter)
        .order("due_at", { ascending: true, nullsFirst: true })
        .limit(BATCH_SIZE),
      supabase.from("flashcards").select("id", { count: "exact", head: true }).or(dueFilter)
    ]);
    if (cardsResult.error) {
      setError(cardsResult.error.message || "Could not load cards.");
      return;
    }
    if (countResult.error) {
      setError(countResult.error.message || "Could not load the study queue.");
      return;
    }
    setCards((cardsResult.data as Flashcard[]) || []);
    setTotalDue(countResult.count || 0);
    setIndex(0);
    setRevealed(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function review(correct: boolean) {
    if (!current) return;
    setWorking(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: saved, error: reviewError } = await supabase.rpc("record_study_review", {
        p_flashcard_id: current.id,
        p_correct: correct
      });
      if (reviewError) throw reviewError;
      if (saved !== true) throw new Error("This card could not be found. Refresh the study queue and try again.");
      setRevealed(false);
      setIndex((value) => value + 1);
    } catch (reviewFailure) {
      setError(reviewFailure instanceof Error ? reviewFailure.message : "Could not save this review.");
    } finally {
      setWorking(false);
    }
  }

  const finished = cards.length > 0 && index >= cards.length;

  return (
    <div className="mx-auto max-w-5xl space-y-7 px-5 py-8 sm:px-6 lg:py-10">
      <WorkspaceHeader title="Study mode" eyebrow="Review">
        <button type="button" onClick={load} className="btn-secondary">
          <RotateCcw size={18} />
          Refresh
        </button>
      </WorkspaceHeader>

      {error ? <p className="text-sm font-bold text-[var(--critical)]">{error}</p> : null}

      {!cards.length ? (
        <EmptyState title="No cards due" description="Create flashcards or come back when cards are due for review." />
      ) : finished ? (
        <EmptyState
          title="Study session complete"
          description={
            totalDue > cards.length
              ? `You reviewed this batch. ${totalDue - cards.length} more card${totalDue - cards.length === 1 ? " is" : "s are"} due — refresh to keep going.`
              : "You reviewed every card that was due."
          }
        />
      ) : current ? (
        <section className="panel p-7">
          <div className="flex items-center justify-between">
            <span className="status-pill">{index + 1} of {cards.length}{totalDue > cards.length ? ` (+${totalDue - cards.length} more due)` : ""}</span>
            <span className="status-pill">{revealed ? "Answer shown" : "Question"}</span>
          </div>
          <div className="grid min-h-[360px] place-items-center text-center">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">{revealed ? "Back" : "Front"}</p>
              <h2 className="mt-4 text-4xl font-extrabold tracking-[-0.04em] text-balance">{revealed ? current.back : current.front}</h2>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {!revealed ? (
              <button type="button" onClick={() => setRevealed(true)} className="btn-primary">Reveal answer</button>
            ) : (
              <>
                <button type="button" onClick={() => review(false)} className="btn-secondary" disabled={working}>Incorrect</button>
                <button type="button" onClick={() => review(true)} className="btn-primary" disabled={working}>Correct</button>
              </>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
