"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { FlashcardPracticeSession } from "@/components/flashcard-practice";
import { PageLoading } from "@/components/page-loading";
import { WorkspaceHeader } from "@/components/workspace-header";
import { useWorkspaceSession } from "@/components/workspace-session";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Flashcard } from "@/lib/types";

// Cards are ordered oldest-due-first for spaced repetition, but that means a large
// backlog of never-reviewed cards can push brand-new cards past the fetch limit,
// making them silently invisible. A generous batch size keeps that from happening
// for the vast majority of users; totalDue below covers the rest.
const BATCH_SIZE = 300;

export default function StudyPage() {
  const { user } = useWorkspaceSession();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [ready, setReady] = useState(false);

  async function load() {
    const supabase = createSupabaseBrowserClient();
    setLoadError("");
    setError("");
    const dueFilter = `due_at.is.null,due_at.lte.${new Date().toISOString()}`;
    // Explicit user_id filter: flashcards also has a public-read policy (for
    // the /d/[slug] share page), so this would otherwise pull other users'
    // public-deck cards into the study queue whenever their due_at matched.
    const [cardsResult, countResult] = await Promise.all([
      supabase
        .from("flashcards")
        .select("*")
        .eq("user_id", user.id)
        .or(dueFilter)
        .order("due_at", { ascending: true, nullsFirst: true })
        .limit(BATCH_SIZE),
      supabase.from("flashcards").select("id", { count: "exact", head: true }).eq("user_id", user.id).or(dueFilter)
    ]);
    if (cardsResult.error) {
      setLoadError(cardsResult.error.message || "Could not load cards.");
      setReady(true);
      return;
    }
    if (countResult.error) {
      setLoadError(countResult.error.message || "Could not load the study queue.");
      setReady(true);
      return;
    }
    setCards((cardsResult.data as Flashcard[]) || []);
    setTotalDue(countResult.count || 0);
    setReady(true);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  async function review(cardId: string, correct: boolean) {
    setWorking(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: saved, error: reviewError } = await supabase.rpc("record_study_review", {
        p_flashcard_id: cardId,
        p_correct: correct
      });
      if (reviewError) throw reviewError;
      if (saved !== true) throw new Error("This card could not be found. Refresh the study queue and try again.");
    } catch (reviewFailure) {
      const message = reviewFailure instanceof Error ? reviewFailure.message : "Could not save this review.";
      setError(message);
      throw reviewFailure instanceof Error ? reviewFailure : new Error(message);
    } finally {
      setWorking(false);
    }
  }

  const finishedDescription =
    totalDue > cards.length
      ? `You reviewed this batch. ${totalDue - cards.length} more card${totalDue - cards.length === 1 ? " is" : "s are"} due. Refresh to keep going.`
      : "You reviewed every card that was due.";

  if (!ready) return <PageLoading label="Loading study…" />;

  return (
    <div className="mx-auto max-w-5xl space-y-7 px-5 py-8 sm:px-6 lg:py-10">
      <WorkspaceHeader title="Study mode" eyebrow="Review">
        <button type="button" onClick={load} className="btn-secondary">
          <RotateCcw size={18} />
          Refresh
        </button>
      </WorkspaceHeader>

      {loadError ? <p className="text-sm font-bold text-[var(--critical)]">{loadError}</p> : null}

      <FlashcardPracticeSession
        cards={cards}
        mode="study"
        onReview={review}
        working={working}
        error={error}
        totalDue={totalDue}
        emptyTitle="No cards due"
        emptyDescription="Create flashcards or come back when cards are due for review. You can also practice any deck anytime from Flashcards."
        finishedTitle="Study session complete"
        finishedDescription={finishedDescription}
      />
    </div>
  );
}
