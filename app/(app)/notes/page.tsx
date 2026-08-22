"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, FolderOpen, Plus, Save, Search, Trash2, Wand2 } from "lucide-react";
import { MarkdownEditor } from "@/components/markdown-editor";
import { WorkspaceHeader } from "@/components/workspace-header";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatRelative } from "@/lib/format";
import { removeEmDashes } from "@/lib/text";
import type { Note, Project } from "@/lib/types";

export default function NotesPage() {
  return (
    <Suspense>
      <NotesContent />
    </Suspense>
  );
}

function NotesContent() {
  const searchParams = useSearchParams();
  const projectFilter = searchParams.get("project");
  const [notes, setNotes] = useState<Note[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("Untitled note");
  const [content, setContent] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const selected = useMemo(() => notes.find((note) => note.id === selectedId) || null, [notes, selectedId]);

  async function load() {
    const supabase = createSupabaseBrowserClient();
    let query = supabase.from("notes").select("*").order("updated_at", { ascending: false });
    if (projectFilter) query = query.eq("project_id", projectFilter);
    const [notesResult, projectsResult] = await Promise.all([
      query,
      supabase.from("projects").select("*").order("name")
    ]);
    const loadedNotes = (notesResult.data as Note[]) || [];
    setNotes(loadedNotes);
    setProjects((projectsResult.data as Project[]) || []);
    if (!selectedId && loadedNotes[0]) selectNote(loadedNotes[0]);
    if (projectFilter) setProjectId(projectFilter);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFilter]);

  function selectNote(note: Note) {
    setSelectedId(note.id);
    setTitle(removeEmDashes(note.title));
    setContent(removeEmDashes(note.content || ""));
    setProjectId(note.project_id || "");
  }

  function newNote() {
    setSelectedId(null);
    setTitle("Untitled note");
    setContent("");
    setProjectId(projectFilter || "");
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Your session has expired. Please sign in again.");
      const payload = {
        title: removeEmDashes(title),
        content: removeEmDashes(content),
        project_id: projectId || null,
        user_id: user.id,
        updated_at: new Date().toISOString()
      };
      if (selectedId) {
        const { error } = await supabase.from("notes").update(payload).eq("id", selectedId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("notes").insert(payload).select("*").single();
        if (error) throw error;
        if (data) setSelectedId(data.id);
      }
      await load();
      setMessage("Saved.");
      setTimeout(() => setMessage(""), 2500);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the note.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!selectedId) return;
    if (!confirm("Delete this note? This cannot be undone.")) return;
    setMessage("");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("notes").delete().eq("id", selectedId);
    if (error) {
      setMessage(error.message || "Could not delete the note.");
      return;
    }
    newNote();
    await load();
    setMessage("Note deleted.");
    setTimeout(() => setMessage(""), 2500);
  }

  async function transform(action: string) {
    if (!content.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/ai/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text: removeEmDashes(content) })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "AI transform action failed.");
      setContent(removeEmDashes(payload.result));
      setMessage("Transformed. Click Save to keep changes.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI action failed.");
    } finally {
      setSaving(false);
    }
  }

  const filteredNotes = notes.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-6xl space-y-7 px-5 py-8 sm:px-8">
      <WorkspaceHeader title="Notes" eyebrow="Knowledge Hub">
        <button type="button" onClick={newNote} className="btn-secondary">
          <Plus size={16} />
          New Note
        </button>
        <button type="button" onClick={save} className="btn-primary" disabled={saving}>
          <Save size={16} />
          {saving ? "Saving..." : "Save Note"}
        </button>
      </WorkspaceHeader>

      {message && (
        <div className="rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs">
          {message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Notes Navigation Rail */}
        <aside className="panel flex flex-col p-4 bg-white">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
              All Notes
            </span>
            <span className="badge badge-subtle text-[10px]">{notes.length}</span>
          </div>

          <div className="mt-3 flex items-center rounded-lg border border-[var(--border)] bg-slate-50 px-2.5 py-1.5 text-xs text-[var(--muted)]">
            <Search size={13} className="mr-2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes..."
              className="w-full bg-transparent text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
            />
          </div>

          <div className="mt-3 flex-1 space-y-1 overflow-y-auto max-h-[600px]">
            {filteredNotes.length === 0 ? (
              <p className="py-8 text-center text-xs text-[var(--muted)]">
                {search ? "No matching notes." : "No notes created yet."}
              </p>
            ) : (
              filteredNotes.map((note) => {
                const active = selectedId === note.id;
                return (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => selectNote(note)}
                    className={`flex w-full flex-col rounded-lg p-2.5 text-left transition ${
                      active
                        ? "bg-slate-100 font-semibold text-[var(--text)]"
                        : "text-[var(--muted-strong)] hover:bg-slate-50 hover:text-[var(--text)]"
                    }`}
                  >
                    <span className="truncate text-xs font-medium">
                      {removeEmDashes(note.title)}
                    </span>
                    <span className="mt-0.5 text-[10px] text-[var(--muted)]">
                      {formatRelative(note.updated_at)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Note Editor Area */}
        <section className="space-y-4">
          <div className="panel grid gap-3 p-4 sm:grid-cols-[1fr_200px_auto] bg-white">
            <input
              aria-label="Note title"
              className="input-enterprise w-full"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Note title..."
            />
            <select
              aria-label="Project association"
              className="input-enterprise"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
            >
              <option value="">No Project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={remove}
              className="btn-secondary text-rose-600 hover:bg-rose-50 hover:border-rose-300"
              disabled={!selected}
            >
              <Trash2 size={16} />
              Delete
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
              AI Tools:
            </span>
            {["Executive summary", "Rewrite clearly", "Turn into outline", "Action items"].map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => transform(action)}
                className="btn-secondary min-h-[30px] px-2.5 text-xs"
              >
                <Wand2 size={12} />
                {action}
              </button>
            ))}
          </div>

          <MarkdownEditor value={content} onChange={setContent} />
        </section>
      </div>
    </div>
  );
}
