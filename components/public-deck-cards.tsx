"use client";

import { useState } from "react";

type PublicCard = {
  id: string;
  front: string;
  back: string;
};

export function PublicDeckCards({ cards }: { cards: PublicCard[] }) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {cards.map((card, index) => {
        const isRevealed = Boolean(revealed[card.id]);
        return (
          <button
            key={card.id}
            type="button"
            onClick={() => setRevealed((prev) => ({ ...prev, [card.id]: !prev[card.id] }))}
            className="glass-card p-5 text-left"
            aria-expanded={isRevealed}
          >
            <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">
              Card {index + 1} · {isRevealed ? "Answer" : "Question — tap to reveal"}
            </p>
            <p className="mt-3 text-sm font-bold leading-6 text-[var(--text)]">
              {isRevealed ? card.back : card.front}
            </p>
          </button>
        );
      })}
    </div>
  );
}
