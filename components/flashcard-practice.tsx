"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";

export type PracticeCard = {
  id: string;
  front: string;
  back: string;
};

type FlashcardPracticeSessionProps = {
  cards: PracticeCard[];
  mode: "study" | "practice";
  onReview?: (cardId: string, correct: boolean) => Promise<void>;
  working?: boolean;
  error?: string;
  totalDue?: number;
  emptyTitle: string;
  emptyDescription: string;
  finishedTitle: string;
  finishedDescription: string;
  footerNote?: string;
};

export function FlashcardPracticeSession({
  cards,
  mode,
  onReview,
  working = false,
  error,
  totalDue,
  emptyTitle,
  emptyDescription,
  finishedTitle,
  finishedDescription,
  footerNote
}: FlashcardPracticeSessionProps) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setIndex(0);
    setRevealed(false);
  }, [cards]);

  const current = useMemo(() => cards[index] || null, [cards, index]);
  const finished = cards.length > 0 && index >= cards.length;
  const dueExtra = typeof totalDue === "number" && totalDue > cards.length ? totalDue - cards.length : 0;

  async function handleReview(correct: boolean) {
    if (!current || !onReview) return;
    try {
      await onReview(current.id, correct);
      setRevealed(false);
      setIndex((value) => value + 1);
    } catch {
      // Parent surfaces the error message; keep the current card visible.
    }
  }

  function handleNext() {
    setRevealed(false);
    setIndex((value) => value + 1);
  }

  if (!cards.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  if (finished) {
    return <EmptyState title={finishedTitle} description={finishedDescription} />;
  }

  if (!current) return null;

  return (
    <section className="panel p-7">
      {error ? <p className="mb-4 text-sm font-bold text-[var(--critical)]">{error}</p> : null}
      <div className="flex items-center justify-between">
        <span className="status-pill">
          {index + 1} of {cards.length}
          {dueExtra > 0 ? ` (+${dueExtra} more due)` : ""}
        </span>
        <span className="status-pill">{revealed ? "Answer shown" : "Question"}</span>
      </div>
      <div className="grid min-h-[360px] place-items-center text-center">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">
            {revealed ? "Back" : "Front"}
          </p>
          <h2 className="mt-4 text-4xl font-extrabold tracking-[-0.04em] text-balance">
            {revealed ? current.back : current.front}
          </h2>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {!revealed ? (
          <button type="button" onClick={() => setRevealed(true)} className="btn-primary">
            Reveal answer
          </button>
        ) : mode === "study" ? (
          <>
            <button type="button" onClick={() => handleReview(false)} className="btn-secondary" disabled={working}>
              Incorrect
            </button>
            <button type="button" onClick={() => handleReview(true)} className="btn-primary" disabled={working}>
              Correct
            </button>
          </>
        ) : (
          <button type="button" onClick={handleNext} className="btn-primary">
            Next card
          </button>
        )}
      </div>
      {footerNote ? (
        <p className="mt-5 text-center text-xs font-bold text-[var(--muted)]">{footerNote}</p>
      ) : null}
    </section>
  );
}
