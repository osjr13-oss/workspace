"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { WorkspaceHeader } from "@/components/workspace-header";
import { EmptyState } from "@/components/empty-state";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Flashcard, FlashcardDeck, Note, Project, WorkspaceFile } from "@/lib/types";

export default function FlashcardsPage() {
  const searchParams = useSearchParams();
  const projectFilter = searchParams.get("project");
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [deckId, setDeckId] = useState("");
  const [deckName, setDeckName] = useState("");
  const [projectId, setProjectId] = useState(projectFilter || "");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [source, setSource] = useState("");
  const [working, setWorking] = useState(false);

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
    if (!deckId && loadedDecks[0]) setDeckId(loadedDecks[0].id);
  }

  useEffect(() => {
    setProjectId(projectFilter || "");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFilter]);

  async function createDeck(event: React.FormEvent) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("flashcard_decks").insert({ name: deckName, project_id: projectId || null, user_id: user.id }).select("*").single();
    setDeckName("");
    if (data) setDeckId(data.id);
    await load();
  }

  async function createCard(event: React.FormEvent) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user || !deckId) return;
    await supabase.from("flashcards").insert({ front, back, deck_id: deckId, project_id: projectId || null, user_id: user.id, due_at: new Date().toISOString() });
    setFront("");
    setBack("");
    await load();
  }

  async function generate() {
    if (!deckId || !source) return;
    setWorking(true);
    const [type, id] = source.split(":");
    await fetch("/api/ai/flashcards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deckId, sourceType: type, sourceId: id, projectId: projectId || null })
    });
    await load();
    setWorking(false);
  }

  async function removeCard(id: string) {
    const supabase = createSupabaseBrowserClient();
    await supabase.from("flashcards").delete().eq("id", id);
    await load();
  }

  const visibleCards = deckId ? cards.filter((card) => card.deck_id === deckId) : cards;

  return (
    <div className="mx-auto max-w-7xl space-y-7 px-5 py-8 sm:px-6 lg:py-10">
      <WorkspaceHeader title="Flashcards" eyebrow="Study system" />
      <section className="grid gap-5 lg:grid-cols-2">
        <form onSubmit={createDeck} className="panel grid gap-3 p-5 sm:grid-cols-[1fr_220px_auto]">
          <input aria-label="Deck name" className="input-premium px-5" placeholder="Deck name" value={deckName} onChange={(event) => setDeckName(event.target.value)} required />
          <select aria-label="Project" className="input-premium px-5" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="">No project</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <button className="btn-primary" type="submit"><Plus size={18} />Deck</button>
        </form>
        <div className="panel grid gap-3 p-5 sm:grid-cols-[1fr_auto]">
          <select aria-label="Flashcard generation source" className="input-premium px-5" value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="">Choose note or extracted file</option>
            {notes.map((note) => <option key={note.id} value={`note:${note.id}`}>Note: {note.title}</option>)}
            {files.map((file) => <option key={file.id} value={`file:${file.id}`}>File: {file.name}</option>)}
          </select>
          <button type="button" onClick={generate} className="btn-secondary" disabled={!source || !deckId || working}>
            <Sparkles size={18} />
            {working ? "Generating" : "Generate"}
          </button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[300px_1fr]">
        <aside className="panel p-4">
          <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">Decks</p>
          {decks.map((deck) => (
            <button key={deck.id} type="button" onClick={() => setDeckId(deck.id)} className={`mb-2 w-full rounded-2xl p-4 text-left font-bold ${deckId === deck.id ? "bg-[var(--surface-subtle)]" : "hover:bg-[var(--surface-subtle)]"}`}>
              {deck.name}
            </button>
          ))}
        </aside>
        <main className="space-y-5">
          <form onSubmit={createCard} className="panel grid gap-3 p-5 lg:grid-cols-[1fr_1fr_auto]">
            <input aria-label="Flashcard front" className="input-premium px-5" placeholder="Front" value={front} onChange={(event) => setFront(event.target.value)} required />
            <input aria-label="Flashcard back" className="input-premium px-5" placeholder="Back" value={back} onChange={(event) => setBack(event.target.value)} required />
            <button className="btn-primary" type="submit" disabled={!deckId}><Plus size={18} />Card</button>
          </form>
          {visibleCards.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {visibleCards.map((card) => (
                <article key={card.id} className="panel p-5">
                  <div className="flex justify-between gap-4">
                    <h2 className="font-extrabold">{card.front}</h2>
                    <button type="button" onClick={() => removeCard(card.id)} title="Delete" className="text-[var(--muted)] hover:text-[var(--critical)]"><Trash2 size={17} /></button>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[var(--muted-strong)]">{card.back}</p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="No cards in this deck" description="Add cards manually or generate them from a note or extracted file." />
          )}
        </main>
      </section>
    </div>
  );
}
