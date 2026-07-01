"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { WorkspaceHeader } from "@/components/workspace-header";
import { EmptyState } from "@/components/empty-state";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Flashcard } from "@/lib/types";

export default function StudyPage() {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const current = useMemo(() => cards[index] || null, [cards, index]);

  async function load() {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("flashcards")
      .select("*")
      .or(`due_at.is.null,due_at.lte.${new Date().toISOString()}`)
      .order("due_at", { ascending: true, nullsFirst: true })
      .limit(50);
    setCards((data as Flashcard[]) || []);
    setIndex(0);
    setRevealed(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function review(correct: boolean) {
    if (!current) return;
    const supabase = createSupabaseBrowserClient();
    const due = new Date();
    due.setDate(due.getDate() + (correct ? 3 : 1));
    await supabase.from("study_reviews").insert({ flashcard_id: current.id, user_id: current.user_id, result: correct ? "correct" : "incorrect" });
    await supabase.from("flashcards").update({ due_at: due.toISOString() }).eq("id", current.id);
    setRevealed(false);
    setIndex((value) => value + 1);
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

      {!cards.length ? (
        <EmptyState title="No cards due" description="Create flashcards or come back when cards are due for review." />
      ) : finished ? (
        <EmptyState title="Study session complete" description="You reviewed every card that was due." />
      ) : current ? (
        <section className="panel p-7">
          <div className="flex items-center justify-between">
            <span className="status-pill">{index + 1} of {cards.length}</span>
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
                <button type="button" onClick={() => review(false)} className="btn-secondary">Incorrect</button>
                <button type="button" onClick={() => review(true)} className="btn-primary">Correct</button>
              </>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
