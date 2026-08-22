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
    if (!confirm("Delete this project? Notes, files, and chats linked to it will be unlinked but not deleted.")) return;
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
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        {error ? (
          <p className="text-xs font-bold text-[var(--critical)]">{error}</p>
        ) : loaded ? (
          <p className="text-xs font-bold text-[var(--muted)]">Project not found.</p>
        ) : (
          <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
        )}
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: "notes", label: "Notes", icon: <BookOpen size={15} />, count: notes.length },
    { key: "files", label: "Files", icon: <Files size={15} />, count: files.length },
    { key: "chats", label: "Chats", icon: <MessageSquare size={15} />, count: threads.length },
    { key: "flashcards", label: "Decks", icon: <Brain size={15} />, count: decks.length },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-5 py-8 sm:px-8">
      <WorkspaceHeader title={project.name} eyebrow="Project Space">
        <Link className="btn-secondary" href={`/chats?project=${id}`}>
          <MessageSquare size={15} />
          <span>Think in Project</span>
        </Link>
        <Link className="btn-primary" href={`/notes?project=${id}`}>
          <Plus size={15} />
          <span>New Note</span>
        </Link>
        <button
          type="button"
          onClick={deleteProject}
          disabled={deleting}
          title="Delete project"
          className="btn-secondary text-[var(--critical)] hover:bg-rose-50"
        >
          <Trash2 size={15} />
        </button>
      </WorkspaceHeader>

      {error && <p className="text-xs font-bold text-[var(--critical)]">{error}</p>}

      {project.description && (
        <p className="max-w-2xl text-xs leading-relaxed text-[var(--muted-strong)]">{project.description}</p>
      )}

      <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)]">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-4 pb-3 text-xs font-bold transition ${
              tab === t.key
                ? "border-slate-900 text-[var(--text)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
            <span className="badge badge-subtle text-[10px]">
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {tab === "notes" && (
        <section className="space-y-4">
          <div className="flex justify-end">
            <Link href={`/notes?project=${id}`} className="btn-primary">
              <Plus size={14} />
              <span>New Note</span>
            </Link>
          </div>
          {notes.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {notes.map((note) => (
                <Link
                  key={note.id}
                  href={`/notes?project=${id}`}
                  className="panel p-5 bg-white shadow-xs transition hover:border-[var(--border-strong)]"
                >
                  <p className="text-sm font-bold text-[var(--text)]">{note.title}</p>
                  <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-[var(--muted-strong)]">{note.content || "Empty note."}</p>
                  <p className="mt-3 text-[11px] text-[var(--muted)]">{formatRelative(note.updated_at)}</p>
                </Link>
              ))}
            </div>
          ) : (
            <Empty label="No notes in this project yet" action={{ href: `/notes?project=${id}`, label: "Write First Note" }} />
          )}
        </section>
      )}

      {tab === "files" && (
        <section className="space-y-4">
          <div className="flex justify-end">
            <Link href={`/files?project=${id}`} className="btn-primary">
              <Plus size={14} />
              <span>Upload File</span>
            </Link>
          </div>
          {files.length ? (
            <div className="panel overflow-hidden bg-white shadow-xs">
              <table className="data-table">
                <thead><tr><th>Name</th><th>Status</th><th>Uploaded</th></tr></thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.id}>
                      <td>
                        <p className="font-bold text-[var(--text)]">{file.name}</p>
                        <p className="text-[11px] text-[var(--muted)]">{file.mime_type || "Unknown type"}</p>
                      </td>
                      <td><FileProcessingStatus status={file.extraction_status} /></td>
                      <td className="text-xs text-[var(--muted)]">{formatDate(file.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty label="No files uploaded to this project" action={{ href: `/files?project=${id}`, label: "Upload File" }} />
          )}
        </section>
      )}

      {tab === "chats" && (
        <section className="space-y-4">
          <div className="flex justify-end">
            <Link href={`/chats?project=${id}`} className="btn-primary">
              <Plus size={14} />
              <span>New Thought</span>
            </Link>
          </div>
          {threads.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {threads.map((thread) => (
                <Link
                  key={thread.id}
                  href={`/chats?thread=${thread.id}&project=${id}`}
                  className="panel p-5 bg-white shadow-xs transition hover:border-[var(--border-strong)]"
                >
                  <p className="text-sm font-bold text-[var(--text)]">{thread.title}</p>
                  <p className="mt-2 text-[11px] text-[var(--muted)]">{formatRelative(thread.updated_at)}</p>
                </Link>
              ))}
            </div>
          ) : (
            <Empty label="No conversations in this project yet" action={{ href: `/chats?project=${id}`, label: "Start First Chat" }} />
          )}
        </section>
      )}

      {tab === "flashcards" && (
        <section className="space-y-4">
          <div className="flex justify-end">
            <Link href={`/flashcards?project=${id}`} className="btn-primary">
              <Plus size={14} />
              <span>New Deck</span>
            </Link>
          </div>
          {decks.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {decks.map((deck) => (
                <Link
                  key={deck.id}
                  href={`/flashcards?project=${id}`}
                  className="panel p-5 bg-white shadow-xs transition hover:border-[var(--border-strong)]"
                >
                  <p className="text-sm font-bold text-[var(--text)]">{deck.name}</p>
                  <p className="mt-2 text-[11px] text-[var(--muted)]">Updated {formatRelative(deck.updated_at)}</p>
                </Link>
              ))}
            </div>
          ) : (
            <Empty label="No decks linked to this project" action={{ href: `/flashcards?project=${id}`, label: "Create First Deck" }} />
          )}
        </section>
      )}
    </div>
  );
}

function Empty({ label, action }: { label: string; action: { href: string; label: string } }) {
  return (
    <div className="panel flex flex-col items-center justify-center p-8 text-center bg-white shadow-xs space-y-3">
      <p className="text-xs font-semibold text-[var(--muted)]">{label}</p>
      <Link href={action.href} className="btn-secondary">
        <Plus size={14} />
        <span>{action.label}</span>
      </Link>
    </div>
  );
}
