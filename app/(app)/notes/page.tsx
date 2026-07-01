"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Save, Trash2, Wand2 } from "lucide-react";
import { MarkdownEditor } from "@/components/markdown-editor";
import { WorkspaceHeader } from "@/components/workspace-header";
import { EmptyState } from "@/components/empty-state";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatRelative } from "@/lib/format";
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
  const selected = useMemo(() => notes.find((note) => note.id === selectedId) || null, [notes, selectedId]);

  async function load() {
    const supabase = createSupabaseBrowserClient();
    let query = supabase.from("notes").select("*").order("updated_at", { ascending: false });
    if (projectFilter) query = query.eq("project_id", projectFilter);
    const [notesResult, projectsResult] = await Promise.all([query, supabase.from("projects").select("*").order("name")]);
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
    setTitle(note.title);
    setContent(note.content || "");
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
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;
    const payload = { title, content, project_id: projectId || null, user_id: user.id, updated_at: new Date().toISOString() };
    if (selectedId) {
      await supabase.from("notes").update(payload).eq("id", selectedId);
    } else {
      const { data } = await supabase.from("notes").insert(payload).select("*").single();
      if (data) setSelectedId(data.id);
    }
    await load();
    setSaving(false);
  }

  async function remove() {
    if (!selectedId) return;
    const supabase = createSupabaseBrowserClient();
    await supabase.from("notes").delete().eq("id", selectedId);
    newNote();
    await load();
  }

  async function transform(action: string) {
    if (!content.trim()) return;
    setSaving(true);
    const response = await fetch("/api/ai/transform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, text: content })
    });
    const payload = await response.json();
    if (response.ok) setContent(payload.result);
    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7 px-5 py-8 sm:px-6 lg:py-10">
      <WorkspaceHeader title="Notes" eyebrow="Workspace">
        <button type="button" onClick={newNote} className="btn-secondary">
          <Plus size={18} />
          New note
        </button>
        <button type="button" onClick={save} className="btn-primary" disabled={saving}>
          <Save size={18} />
          {saving ? "Saving" : "Save"}
        </button>
      </WorkspaceHeader>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <aside className="panel p-4">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">Library</p>
            <span className="status-pill">{notes.length} notes</span>
          </div>
          {notes.length ? (
            <div className="space-y-2">
              {notes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => selectNote(note)}
                  className={`w-full rounded-2xl p-4 text-left ${selectedId === note.id ? "bg-[var(--surface-subtle)]" : "hover:bg-[var(--surface-subtle)]"}`}
                >
                  <p className="font-extrabold">{note.title}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{formatRelative(note.updated_at)}</p>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="No notes yet" description="Create your first markdown note." />
          )}
        </aside>
        <section className="space-y-4">
          <div className="panel grid gap-3 p-4 lg:grid-cols-[1fr_220px_auto]">
            <input aria-label="Note title" className="input-premium px-5" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Note title" />
            <select aria-label="Project" className="input-premium px-5" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
            <button type="button" onClick={remove} className="btn-secondary" disabled={!selected}>
              <Trash2 size={18} />
              Delete
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {["Summarize", "Rewrite", "Turn into outline", "Turn into study notes"].map((action) => (
              <button key={action} type="button" onClick={() => transform(action)} className="btn-secondary min-h-10 text-sm">
                <Wand2 size={16} />
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
