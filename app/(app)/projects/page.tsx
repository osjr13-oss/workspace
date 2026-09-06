"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { WorkspaceHeader } from "@/components/workspace-header";
import { EmptyState } from "@/components/empty-state";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatDate } from "@/lib/format";
import type { Project } from "@/lib/types";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });
    setProjects((data as Project[]) || []);
  }

  useEffect(() => { load(); }, []);

  async function createProject(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || null })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Could not create project.");
      setName("");
      setDescription("");
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create project.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteProject(event: React.MouseEvent, id: string) {
    event.preventDefault();
    if (!confirm("Delete this project? Notes, files, and flashcards linked to it will be unlinked but not deleted.")) return;
    setDeletingId(id);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: deleteError } = await supabase.from("projects").delete().eq("id", id);
      if (deleteError) throw deleteError;
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete project.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7 px-5 py-8 sm:px-6 lg:py-10">
      <WorkspaceHeader title="Projects" eyebrow="Workspace" />

      <form onSubmit={createProject} className="panel flex flex-wrap items-center gap-3 p-5">
        <input aria-label="Project name" className="input-premium min-w-0 flex-1 px-5" placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input aria-label="Project description" className="input-premium min-w-[200px] flex-[2] px-5" placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <button type="submit" className="btn-primary shrink-0" disabled={loading}>
          <Plus size={18} />
          {loading ? "Creating…" : "Create project"}
        </button>
        {error ? (
          <p className="w-full text-sm font-bold text-[var(--critical)]">
            {error}{" "}
            <Link href="/pricing" className="text-[var(--text)] underline">
              View plans
            </Link>
          </p>
        ) : null}
      </form>

      {projects.length ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`} className="glass-card group relative p-6">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-extrabold tracking-[-0.01em]">{project.name}</h2>
                <button
                  type="button"
                  onClick={(e) => deleteProject(e, project.id)}
                  disabled={deletingId === project.id}
                  title="Delete project"
                  className="shrink-0 text-[var(--muted)] opacity-0 transition-opacity hover:text-[var(--critical)] group-hover:opacity-100"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <p className="mt-3 min-h-10 text-sm leading-6 text-[var(--muted-strong)]">{project.description || "No description yet."}</p>
              <p className="mt-4 text-xs text-[var(--muted)]">{formatDate(project.updated_at)}</p>
            </Link>
          ))}
        </section>
      ) : (
        <EmptyState title="No projects yet" description="Create a project to group notes, files, chats, and flashcards around one class or thesis." />
      )}
    </div>
  );
}
