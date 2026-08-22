"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { BookOpen, Brain, Files, MessageSquare, Plus, Trash2 } from "lucide-react";
import { WorkspaceHeader } from "@/components/workspace-header";
import { FileProcessingStatus } from "@/components/file-processing-status";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatDate, formatRelative } from "@/lib/format";
import { useRouter } from "next/navigation";
import type { ChatThread, FlashcardDeck, Note, Project, WorkspaceFile } from "@/lib/types";

type Tab = "notes" | "files" | "chats" | "flashcards";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [tab, setTab] = useState<Tab>("notes");
  const [notes, setNotes] = useState<Note[]>([]);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      // flashcard_decks also has a public-read policy (for the /d/[slug]
      // share page); an explicit user_id filter keeps this project's deck
      // list from ever picking up another user's public deck by a stray
      // project_id match.
      const [projectResult, notesResult, filesResult, threadsResult, decksResult] = await Promise.all([
        supabase.from("projects").select("*").eq("id", id).single(),
        supabase.from("notes").select("*").eq("project_id", id).order("updated_at", { ascending: false }),
        supabase.from("files").select("*").eq("project_id", id).order("created_at", { ascending: false }),
        supabase.from("chat_threads").select("*").eq("project_id", id).order("updated_at", { ascending: false }),
        supabase
          .from("flashcard_decks")
          .select("*")
          .eq("project_id", id)
          .eq("user_id", user?.id || "")
          .order("updated_at", { ascending: false }),
      ]);
      const firstError = projectResult.error || notesResult.error || filesResult.error || threadsResult.error || decksResult.error;
      if (firstError) {
        setError(firstError.message || "Could not load this project.");
        setLoaded(true);
        return;
      }
      setProject(projectResult.data as Project);
      setNotes((notesResult.data as Note[]) || []);
      setFiles((filesResult.data as WorkspaceFile[]) || []);
      setThreads((threadsResult.data as ChatThread[]) || []);
      setDecks((decksResult.data as FlashcardDeck[]) || []);
      setLoaded(true);
    }
    load();
  }, [id]);

  async function deleteProject() {
    if (!confirm("Delete this project? Notes, files, and flashcards linked to it will be unlinked but not deleted.")) return;
    setDeleting(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: deleteError } = await supabase.from("projects").delete().eq("id", id);
      if (deleteError) throw deleteError;
      router.push("/projects");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete this project.");
      setDeleting(false);
    }
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-6">
        {error ? <p className="text-sm font-bold text-[var(--critical)]">{error}</p> : loaded ? <p className="text-sm font-bold text-[var(--muted)]">Project not found.</p> : <span className="status-pill">Loading…</span>}
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: "notes", label: "Notes", icon: <BookOpen size={16} />, count: notes.length },
    { key: "files", label: "Files", icon: <Files size={16} />, count: files.length },
    { key: "chats", label: "Chats", icon: <MessageSquare size={16} />, count: threads.length },
    { key: "flashcards", label: "Flashcards", icon: <Brain size={16} />, count: decks.length },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-7 px-5 py-8 sm:px-6 lg:py-10">
      <WorkspaceHeader title={project.name} eyebrow="Project">
        <Link className="btn-secondary" href={`/chats?project=${id}`}>
          <MessageSquare size={16} /> Open chat
        </Link>
        <Link className="btn-primary" href={`/notes?project=${id}`}>
          <Plus size={16} /> New note
        </Link>
        <button type="button" onClick={deleteProject} disabled={deleting} title="Delete project" className="btn-secondary text-[var(--critical)]">
          <Trash2 size={16} />
        </button>
      </WorkspaceHeader>

      {error ? <p className="text-sm font-bold text-[var(--critical)]">{error}</p> : null}

      {project.description && (
        <p className="max-w-2xl text-sm leading-6 text-[var(--muted-strong)]">{project.description}</p>
      )}

      <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)]">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-4 pb-3 text-sm font-bold transition-colors ${
              tab === t.key
                ? "border-[var(--text)] text-[var(--text)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            {t.icon}
            {t.label}
            <span className="rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-xs font-extrabold">
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {tab === "notes" && (
        <section className="space-y-4">
          <div className="flex justify-end">
            <Link href={`/notes?project=${id}`} className="btn-primary"><Plus size={16} /> New note</Link>
          </div>
          {notes.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {notes.map((note) => (
                <Link key={note.id} href={`/notes?project=${id}`} className="glass-card p-5">
                  <p className="font-extrabold">{note.title}</p>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--muted-strong)]">{note.content || "Empty note."}</p>
                  <p className="mt-3 text-xs text-[var(--muted)]">{formatRelative(note.updated_at)}</p>
                </Link>
              ))}
            </div>
          ) : (
            <Empty label="No notes yet" action={{ href: `/notes?project=${id}`, label: "Write first note" }} />
          )}
        </section>
      )}

      {tab === "files" && (
        <section className="space-y-4">
          <div className="flex justify-end">
            <Link href={`/files?project=${id}`} className="btn-primary"><Plus size={16} /> Upload file</Link>
          </div>
          {files.length ? (
            <div className="panel overflow-hidden">
              <table className="data-table">
                <thead><tr><th>Name</th><th>Status</th><th>Uploaded</th></tr></thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.id}>
                      <td>
                        <p className="font-extrabold">{file.name}</p>
                        <p className="text-xs text-[var(--muted)]">{file.mime_type || "Unknown type"}</p>
                      </td>
                      <td><FileProcessingStatus status={file.extraction_status} /></td>
                      <td className="text-[var(--muted)]">{formatDate(file.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty label="No files uploaded" action={{ href: `/files?project=${id}`, label: "Upload first file" }} />
          )}
        </section>
      )}

      {tab === "chats" && (
        <section className="space-y-4">
          <div className="flex justify-end">
            <Link href={`/chats?project=${id}`} className="btn-primary"><Plus size={16} /> New thought</Link>
          </div>
          {threads.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {threads.map((thread) => (
                <Link key={thread.id} href={`/chats?thread=${thread.id}&project=${id}`} className="glass-card p-5">
                  <p className="font-extrabold">{thread.title}</p>
                  <p className="mt-2 text-xs text-[var(--muted)]">{formatRelative(thread.updated_at)}</p>
                </Link>
              ))}
            </div>
          ) : (
            <Empty label="No chats yet" action={{ href: `/chats?project=${id}`, label: "Start first chat" }} />
          )}
        </section>
      )}

      {tab === "flashcards" && (
        <section className="space-y-4">
          <div className="flex justify-end">
            <Link href={`/flashcards?project=${id}`} className="btn-primary"><Plus size={16} /> New deck</Link>
          </div>
          {decks.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {decks.map((deck) => (
                <Link key={deck.id} href={`/flashcards?project=${id}`} className="glass-card p-5">
                  <p className="font-extrabold">{deck.name}</p>
                  <p className="mt-2 text-xs text-[var(--muted)]">Updated {formatRelative(deck.updated_at)}</p>
                </Link>
              ))}
            </div>
          ) : (
            <Empty label="No flashcard decks yet" action={{ href: `/flashcards?project=${id}`, label: "Create first deck" }} />
          )}
        </section>
      )}
    </div>
  );
}

function Empty({ label, action }: { label: string; action: { href: string; label: string } }) {
  return (
    <div className="panel flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-sm font-bold text-[var(--muted)]">{label}</p>
      <Link href={action.href} className="btn-secondary"><Plus size={16} /> {action.label}</Link>
    </div>
  );
}
