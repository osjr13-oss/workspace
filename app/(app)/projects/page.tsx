"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, FolderOpen, Plus, Search, Trash2 } from "lucide-react";
import { WorkspaceHeader } from "@/components/workspace-header";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatDate } from "@/lib/format";
import { removeEmDashes } from "@/lib/text";
import type { Project } from "@/lib/types";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("projects")
      .select("*")
      .order("updated_at", { ascending: false });
    setProjects((data as Project[]) || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function createProject(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: removeEmDashes(name),
          description: description ? removeEmDashes(description) : null
        })
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
    if (
      !confirm(
        "Delete this project? Associated notes and files will be unlinked but retained."
      )
    )
      return;
    setDeletingId(id);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: deleteError } = await supabase.from("projects").delete().eq("id", id);
      if (deleteError) throw deleteError;
      await load();
    } catch (deleteErr) {
      setError(deleteErr instanceof Error ? deleteErr.message : "Could not delete project.");
    } finally {
      setDeletingId(null);
    }
  }

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="mx-auto max-w-6xl space-y-7 px-5 py-8 sm:px-8">
      <WorkspaceHeader title="Projects" eyebrow="Workspace Spaces" />

      {/* Create Project Panel */}
      <form onSubmit={createProject} className="panel p-6 bg-white space-y-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
            <FolderOpen size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--text)]">Create Project Boundary</h2>
            <p className="text-xs text-[var(--muted)]">
              Group thoughts, notes, and reference files around a unified initiative
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]">
          <input
            aria-label="Project name"
            className="input-enterprise"
            placeholder="Project name (e.g. Q3 Architecture)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            aria-label="Project description"
            className="input-enterprise"
            placeholder="Brief scope or objectives (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={loading}>
            <Plus size={15} />
            <span>{loading ? "Creating..." : "Create Project"}</span>
          </button>
        </div>

        {error && (
          <p className="text-xs font-semibold text-[var(--critical)]">
            {error}{" "}
            <Link href="/pricing" className="underline font-bold">
              View plan limits
            </Link>
          </p>
        )}
      </form>

      {/* Projects Grid Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
              Active Projects
            </span>
            <span className="badge badge-subtle text-[10px]">{projects.length}</span>
          </div>

          <div className="flex items-center rounded-lg border border-[var(--border)] bg-white px-2.5 py-1 text-xs text-[var(--muted)] shadow-xs">
            <Search size={13} className="mr-2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="w-36 bg-transparent text-[var(--text)] outline-none placeholder:text-[var(--muted)] sm:w-48"
            />
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="panel p-12 text-center bg-white">
            <FolderOpen size={32} className="mx-auto text-slate-300" />
            <h3 className="mt-3 text-sm font-bold text-[var(--text)]">No projects found</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {search
                ? "No projects match your filter."
                : "Create your first project above to group your thinking."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group relative flex flex-col justify-between rounded-xl border border-[var(--border)] bg-white p-5 shadow-xs transition hover:border-[var(--border-strong)] hover:shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-bold text-[var(--text)] group-hover:text-slate-900">
                      {project.name}
                    </h3>
                    <button
                      type="button"
                      onClick={(e) => deleteProject(e, project.id)}
                      disabled={deletingId === project.id}
                      title="Delete project"
                      className="rounded-md p-1 text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--muted-strong)] line-clamp-2">
                    {project.description || "No description provided."}
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-[var(--border)] pt-3 text-[11px] text-[var(--muted)]">
                  <span>Updated {formatDate(project.updated_at)}</span>
                  <span className="flex items-center gap-1 font-semibold text-[var(--text)]">
                    <span>Open</span>
                    <ArrowRight size={12} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
