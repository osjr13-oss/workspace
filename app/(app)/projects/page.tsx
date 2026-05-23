"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
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

  async function load() {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });
    setProjects((data as Project[]) || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function createProject(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("projects").insert({ name, description: description || null, user_id: user.id });
      setName("");
      setDescription("");
      await load();
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7 px-5 py-8 sm:px-6 lg:py-10">
      <WorkspaceHeader title="Projects" eyebrow="Workspace" />

      <form onSubmit={createProject} className="panel grid gap-3 p-5 lg:grid-cols-[1fr_1.5fr_auto]">
        <input aria-label="Project name" className="input-premium px-5" placeholder="Project name" value={name} onChange={(event) => setName(event.target.value)} required />
        <input aria-label="Project description" className="input-premium px-5" placeholder="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
        <button type="submit" className="btn-primary" disabled={loading}>
          <Plus size={18} />
          {loading ? "Creating" : "Create project"}
        </button>
      </form>

      {projects.length ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`} className="glass-card p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-extrabold tracking-[-0.01em]">{project.name}</h2>
                <span className="status-pill">{formatDate(project.updated_at)}</span>
              </div>
              <p className="mt-4 min-h-12 text-sm leading-6 text-[var(--muted-strong)]">{project.description || "No description yet."}</p>
            </Link>
          ))}
        </section>
      ) : (
        <EmptyState title="No projects yet" description="Create a project to group notes, files, chats, and flashcards around one class or thesis." />
      )}
    </div>
  );
}
