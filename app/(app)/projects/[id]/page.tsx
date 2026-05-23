"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { BookOpen, Brain, Files, MessageSquare } from "lucide-react";
import { WorkspaceHeader } from "@/components/workspace-header";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Project } from "@/lib/types";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [counts, setCounts] = useState({ notes: 0, files: 0, chats: 0, flashcards: 0 });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    async function load() {
      const [projectResult, notes, files, chats, cards] = await Promise.all([
        supabase.from("projects").select("*").eq("id", id).single(),
        supabase.from("notes").select("id", { count: "exact", head: true }).eq("project_id", id),
        supabase.from("files").select("id", { count: "exact", head: true }).eq("project_id", id),
        supabase.from("chat_threads").select("id", { count: "exact", head: true }).eq("project_id", id),
        supabase.from("flashcards").select("id", { count: "exact", head: true }).eq("project_id", id)
      ]);
      setProject(projectResult.data as Project);
      setCounts({ notes: notes.count || 0, files: files.count || 0, chats: chats.count || 0, flashcards: cards.count || 0 });
    }
    load();
  }, [id]);

  if (!project) {
    return <div className="mx-auto max-w-7xl px-5 py-10 sm:px-6"><div className="status-pill">Loading project</div></div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7 px-5 py-8 sm:px-6 lg:py-10">
      <WorkspaceHeader title={project.name} eyebrow="Project">
        <Link className="btn-secondary" href={`/chats?project=${project.id}`}>Open chat</Link>
        <Link className="btn-primary" href={`/notes?project=${project.id}`}>New note</Link>
      </WorkspaceHeader>
      <p className="max-w-2xl text-sm leading-6 text-[var(--muted-strong)]">{project.description || "No description yet."}</p>
      <section className="grid gap-4 md:grid-cols-4">
        <Tile icon={<BookOpen size={20} />} label="Notes" value={counts.notes} href={`/notes?project=${project.id}`} />
        <Tile icon={<Files size={20} />} label="Files" value={counts.files} href={`/files?project=${project.id}`} />
        <Tile icon={<MessageSquare size={20} />} label="Chats" value={counts.chats} href={`/chats?project=${project.id}`} />
        <Tile icon={<Brain size={20} />} label="Flashcards" value={counts.flashcards} href={`/flashcards?project=${project.id}`} />
      </section>
      <section className="panel p-6">
        <h2 className="text-base font-extrabold tracking-[-0.01em]">Project workflow</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
          Upload source material, write notes, generate flashcards, then use project chat to ask questions grounded in this project.
        </p>
      </section>
    </div>
  );
}

function Tile({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: number; href: string }) {
  return (
    <Link href={href} className="stat-card block hover:border-[var(--border-strong)]">
      <div className="flex items-center justify-between text-[var(--muted)]">
        {icon}
        <span className="text-xs font-extrabold uppercase tracking-[0.1em]">{label}</span>
      </div>
      <p className="mt-4 text-3xl font-extrabold tracking-[-0.03em]">{value}</p>
    </Link>
  );
}
