"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle, Copy, Link2, Play, Plus, Sparkles, Trash2 } from "lucide-react";
import { FlashcardPracticeSession } from "@/components/flashcard-practice";
import { WorkspaceHeader } from "@/components/workspace-header";
import { EmptyState } from "@/components/empty-state";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Flashcard, FlashcardDeck, Note, Project, WorkspaceFile } from "@/lib/types";

export default function FlashcardsPage() {
  return (
    <Suspense>
      <FlashcardsContent />
    </Suspense>
  );
}

function FlashcardsContent() {
  const searchParams = useSearchParams();
  const projectFilter = searchParams.get("project");
  const deckFromQuery = searchParams.get("deck");

  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);

  const [deckId, setDeckId] = useState(deckFromQuery || "");
  const deckIdRef = useRef(deckId);
  useEffect(() => { deckIdRef.current = deckId; }, [deckId]);

  const [deckName, setDeckName] = useState("");
  const [projectId, setProjectId] = useState(projectFilter || "");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [source, setSource] = useState("");
  const [working, setWorking] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [generateSuccess, setGenerateSuccess] = useState("");
  const [pageError, setPageError] = useState("");
  const [sharingDeckId, setSharingDeckId] = useState("");
  const [copiedDeckId, setCopiedDeckId] = useState("");
  const [practicing, setPracticing] = useState(false);

  async function load() {
    const supabase = createSupabaseBrowserClient();
    const [deckResult, cardResult, projectResult, noteResult, fileResult] = await Promise.all([
      supabase.from("flashcard_decks").select("*").order("updated_at", { ascending: false }),
      supabase.from("flashcards").select("*").order("created_at", { ascending: false }),
      supabase.from("projects").select("*").order("name"),
      supabase.from("notes").select("*").order("updated_at", { ascending: false }),
      supabase.from("files").select("*").eq("extraction_status", "ready").order("created_at", { ascending: false })
    ]);
    const loadedDecks = (deckResult.data as FlashcardDeck[]) || [];
    setDecks(loadedDecks);
    setCards((cardResult.data as Flashcard[]) || []);
    setProjects((projectResult.data as Project[]) || []);
    setNotes((noteResult.data as Note[]) || []);
    setFiles((fileResult.data as WorkspaceFile[]) || []);
    // Prefer ?deck= from clone redirect, then keep current selection, else first deck.
    const preferred = deckIdRef.current;
    if (preferred && loadedDecks.some((deck) => deck.id === preferred)) {
      setDeckId(preferred);
    } else if (loadedDecks[0]) {
      setDeckId(loadedDecks[0].id);
      deckIdRef.current = loadedDecks[0].id;
    }
  }

  useEffect(() => {
    if (deckFromQuery) {
      setDeckId(deckFromQuery);
      deckIdRef.current = deckFromQuery;
    }
  }, [deckFromQuery]);

  useEffect(() => {
    setProjectId(projectFilter || "");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFilter]);

  useEffect(() => {
    setPracticing(false);
  }, [deckId]);

  async function createDeck(event: React.FormEvent) {
    event.preventDefault();
    if (!deckName.trim()) return;
    const res = await fetch("/api/flashcard-decks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: deckName, projectId: projectId || null })
    });
    const payload = await res.json();
    if (!res.ok) {
      alert(payload.error || "Could not create deck.");
      return;
    }
    setDeckName("");
    if (payload.deck) {
      setDeckId(payload.deck.id);
      deckIdRef.current = payload.deck.id;
    }
    await load();
  }

  async function createCard(event: React.FormEvent) {
    event.preventDefault();
    if (!deckId) return;
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("Your session has expired. Please refresh the page and sign in again.");
      return;
    }
    const { error } = await supabase.from("flashcards").insert({
      front,
      back,
      deck_id: deckId,
      project_id: projectId || null,
      user_id: user.id,
      due_at: new Date().toISOString()
    });
    if (error) {
      alert(error.message || "Could not create the card. Please try again.");
      return;
    }
    setFront("");
    setBack("");
    await load();
  }

  async function generate() {
    if (!deckId || !source) return;
    setWorking(true);
    setGenerateError("");
    setGenerateSuccess("");
    const [type, id] = source.split(":");
    try {
      const res = await fetch("/api/ai/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId, sourceType: type, sourceId: id, projectId: projectId || null })
      });
      const payload = await res.json();
      if (!res.ok) {
        setGenerateError(payload.error || "Generation failed. Please try again.");
      } else {
        setGenerateSuccess(`Generated ${payload.cards} cards successfully!`);
        await load();
      }
    } catch {
      setGenerateError("Network error. Please try again.");
    }
    setWorking(false);
  }

  async function toggleShare(deck: FlashcardDeck) {
    setSharingDeckId(deck.id);
    setPageError("");
    try {
      const res = await fetch(`/api/flashcard-decks/${deck.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !deck.is_public })
      });
      const payload = await res.json();
      if (!res.ok) {
        setPageError(payload.error || "Could not update sharing for this deck.");
        return;
      }
      await load();
    } catch {
      setPageError("Network error. Please try again.");
    } finally {
      setSharingDeckId("");
    }
  }

  async function copyShareLink(deck: FlashcardDeck) {
    if (!deck.share_slug) return;
    const url = `${window.location.origin}/d/${deck.share_slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedDeckId(deck.id);
      window.setTimeout(() => setCopiedDeckId(""), 2000);
    } catch {
      setPageError("Could not copy the link. Copy it manually instead.");
    }
  }

  async function removeDeck(id: string) {
    if (!confirm("Delete this deck and all its cards?")) return;
    setPageError("");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("flashcard_decks").delete().eq("id", id);
    if (error) {
      setPageError(error.message || "Could not delete the deck.");
      return;
    }
    if (deckId === id) {
      setDeckId("");
      deckIdRef.current = "";
    }
    await load();
  }

  async function removeCard(id: string) {
    setPageError("");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("flashcards").delete().eq("id", id);
    if (error) {
      setPageError(error.message || "Could not delete the card.");
      return;
    }
    await load();
  }

  const visibleCards = deckId ? cards.filter((c) => c.deck_id === deckId) : cards;
  const practiceCards = [...visibleCards].reverse();
  const selectedDeck = decks.find((d) => d.id === deckId);

  if (practicing && selectedDeck) {
    return (
      <div className="mx-auto max-w-5xl space-y-7 px-5 py-8 sm:px-6 lg:py-10">
        <WorkspaceHeader title={selectedDeck.name} eyebrow="Practice anytime">
          <button type="button" onClick={() => setPracticing(false)} className="btn-secondary">
            <ArrowLeft size={18} />
            Back to deck
          </button>
        </WorkspaceHeader>
        <FlashcardPracticeSession
          cards={practiceCards}
          mode="practice"
          emptyTitle="No cards in this deck"
          emptyDescription="Add cards manually or generate them from a note or file, then come back to practice."
          finishedTitle="Practice complete"
          finishedDescription="You flipped through every card in this deck. Study mode still handles due-card review and scheduling."
          footerNote="Practice anytime — this does not change your study schedule."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7 px-5 py-8 sm:px-6 lg:py-10">
      <WorkspaceHeader title="Flashcards" eyebrow="Study system" />

      {pageError ? <p className="text-sm font-bold text-[var(--critical)]">{pageError}</p> : null}

      {/* Top row: create deck + generate */}
      <section className="grid gap-5 lg:grid-cols-2">
        <form onSubmit={createDeck} className="panel flex flex-wrap items-center gap-3 p-5">
          <input
            aria-label="Deck name"
            className="input-premium min-w-0 flex-1 px-5"
            placeholder="New deck name"
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            required
          />
          <select
            aria-label="Project"
            className="input-premium w-44 shrink-0 px-5"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">No project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn-primary shrink-0" type="submit">
            <Plus size={18} /> Deck
          </button>
        </form>

        <div className="panel flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Generation source"
              className="input-premium min-w-0 flex-1 px-5"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="">Choose a note or file to generate from</option>
              {notes.map((n) => <option key={n.id} value={`note:${n.id}`}>Note: {n.title}</option>)}
              {files.map((f) => <option key={f.id} value={`file:${f.id}`}>File: {f.name}</option>)}
            </select>
            <button
              type="button"
              onClick={generate}
              className="btn-primary shrink-0"
              disabled={!source || !deckId || working}
            >
              <Sparkles size={18} />
              {working ? "Generating…" : "Generate"}
            </button>
          </div>
          {!deckId && (
            <p className="text-xs font-bold text-[var(--muted)]">
              ← Create or select a deck on the left first
            </p>
          )}
          {generateError && (
            <p className="rounded-xl bg-red-50 px-4 py-2 text-xs font-bold text-[var(--critical)]">
              {generateError}
            </p>
          )}
          {generateSuccess && (
            <p className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-2 text-xs font-bold text-[var(--low)]">
              <CheckCircle size={14} /> {generateSuccess}
            </p>
          )}
        </div>
      </section>

      {/* Bottom row: decks sidebar + cards */}
      <section className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <aside className="panel p-4">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">
            Decks ({decks.length})
          </p>
          {decks.length === 0 && (
            <p className="text-sm text-[var(--muted)]">No decks yet. Create one above.</p>
          )}
          {decks.map((deck) => {
            const isSelected = deckId === deck.id;
            return (
              <div
                key={deck.id}
                className={`group mb-2 flex items-center gap-2 rounded-2xl border px-4 py-3 transition-colors ${
                  isSelected
                    ? "border-[var(--border-strong)] bg-[var(--text)] text-white"
                    : "border-transparent hover:border-[var(--border)] hover:bg-[var(--surface-subtle)]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setDeckId(deck.id)}
                  className="min-w-0 flex-1 truncate text-left text-sm font-bold"
                >
                  {deck.name}
                </button>
                <button
                  type="button"
                  onClick={() => removeDeck(deck.id)}
                  title="Delete deck"
                  className={`shrink-0 opacity-0 transition-opacity group-hover:opacity-100 ${isSelected ? "text-white/60 hover:text-white" : "text-[var(--muted)] hover:text-[var(--critical)]"}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </aside>

        <main className="space-y-5">
          <form onSubmit={createCard} className="panel flex flex-wrap items-center gap-3 p-5">
            <input
              aria-label="Card front"
              className="input-premium min-w-0 flex-1 px-5"
              placeholder="Front (question)"
              value={front}
              onChange={(e) => setFront(e.target.value)}
              required
            />
            <input
              aria-label="Card back"
              className="input-premium min-w-0 flex-1 px-5"
              placeholder="Back (answer)"
              value={back}
              onChange={(e) => setBack(e.target.value)}
              required
            />
            <button className="btn-primary shrink-0" type="submit" disabled={!deckId}>
              <Plus size={18} /> Card
            </button>
          </form>

          {selectedDeck && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">
                  {selectedDeck.name} — {visibleCards.length} card{visibleCards.length !== 1 ? "s" : ""}
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setPracticing(true)}
                    disabled={!visibleCards.length}
                    className="btn-primary"
                  >
                    <Play size={16} />
                    Practice
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleShare(selectedDeck)}
                    disabled={sharingDeckId === selectedDeck.id}
                    className="btn-secondary"
                  >
                    <Link2 size={16} />
                    {sharingDeckId === selectedDeck.id
                      ? "Working…"
                      : selectedDeck.is_public
                        ? "Unshare"
                        : "Share"}
                  </button>
                </div>
              </div>
              {selectedDeck.is_public && selectedDeck.share_slug && (
                <div className="glass-card flex flex-wrap items-center justify-between gap-3 p-4">
                  <p className="min-w-0 flex-1 truncate text-sm font-bold text-[var(--muted-strong)]">
                    selrano.com/d/{selectedDeck.share_slug}
                  </p>
                  <button type="button" onClick={() => copyShareLink(selectedDeck)} className="btn-secondary shrink-0">
                    {copiedDeckId === selectedDeck.id ? <CheckCircle size={16} /> : <Copy size={16} />}
                    {copiedDeckId === selectedDeck.id ? "Copied" : "Copy link"}
                  </button>
                </div>
              )}
            </div>
          )}

          {visibleCards.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {visibleCards.map((card) => (
                <article key={card.id} className="panel p-5">
                  <div className="flex justify-between gap-4">
                    <h2 className="font-extrabold">{card.front}</h2>
                    <button
                      type="button"
                      onClick={() => removeCard(card.id)}
                      title="Delete card"
                      className="shrink-0 text-[var(--muted)] hover:text-[var(--critical)]"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted-strong)]">{card.back}</p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title={deckId ? "No cards in this deck" : "Select a deck to see its cards"}
              description={deckId ? "Add cards manually or generate them from a note or file." : "Click a deck on the left to view and add cards."}
            />
          )}
        </main>
      </section>
    </div>
  );
}
