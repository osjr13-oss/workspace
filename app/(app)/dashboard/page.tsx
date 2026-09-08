"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, Brain, Files, FolderOpen, MessageSquare, Plus } from "lucide-react";
import { WorkspaceHeader } from "@/components/workspace-header";
import { FileProcessingStatus } from "@/components/file-processing-status";
import { QuickActions } from "@/components/quick-actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatRelative } from "@/lib/format";
import type { ChatThread, Project, WorkspaceFile } from "@/lib/types";

export default function DashboardPage() {
  const [name, setName] = useState("there");
  const [projects, setProjects] = useState<Project[]>([]);
  const [chats, setChats] = useState<ChatThread[]>([]);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [counts, setCounts] = useState({ projects: 0, notes: 0, files: 0, flashcards: 0 });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      let displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
        if (profile?.full_name) displayName = profile.full_name;
      }
      setName(displayName.split(" ")[0] || "there");
      // flashcards also has a public-read policy (for the /d/[slug] share
      // page), so its count needs an explicit user_id filter. Otherwise
      // every public deck's cards from every user get counted here too.
      const [projectsResult, chatsResult, filesResult, projectCountResult, notesResult, fileCountResult, cardsResult] = await Promise.all([
        supabase.from("projects").select("*").order("updated_at", { ascending: false }).limit(3),
        supabase.from("chat_threads").select("*").order("updated_at", { ascending: false }).limit(3),
        supabase.from("files").select("*").order("created_at", { ascending: false }).limit(3),
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("notes").select("id", { count: "exact", head: true }),
        supabase.from("files").select("id", { count: "exact", head: true }),
        user ? supabase.from("flashcards").select("id", { count: "exact", head: true }).eq("user_id", user.id) : Promise.resolve({ count: 0 })
      ]);
      setProjects((projectsResult.data as Project[]) || []);
      setChats((chatsResult.data as ChatThread[]) || []);
      setFiles((filesResult.data as WorkspaceFile[]) || []);
      setCounts({
        projects: projectCountResult.count || 0,
        notes: notesResult.count || 0,
        files: fileCountResult.count || 0,
        flashcards: cardsResult.count || 0
      });
    }
    load();
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-7 px-5 py-8 sm:px-6 lg:py-10">
      <WorkspaceHeader title={`Good ${getDayPart()}, ${name}.`} eyebrow="Workspace">
        <Link href="/chats" className="btn-primary">
          <Plus size={18} />
          New thought
        </Link>
      </WorkspaceHeader>

      <div className="rounded-2xl sm:rounded-3xl border border-amber-500/25 bg-gradient-to-r from-white/95 via-amber-500/[0.05] to-white/95 p-6 sm:p-7 shadow-xs transition-all duration-200 hover:border-amber-500/40 hover:shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-500/10 text-amber-700">
              <MessageSquare size={22} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-[-0.01em] text-[var(--text)]">Work through a thought with Lumen 1</h2>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--muted)]">Explore an early idea, weigh options, or organize project materials.</p>
            </div>
          </div>
          <Link href="/chats" className="btn-primary shrink-0 self-start sm:self-auto">
            <Plus size={18} />
            Start thinking
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-4">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mr-1">Thought starters:</span>
          {[
            "I have an idea, but I don't know where to start.",
            "Help me choose between two different directions.",
            "I am stuck on this problem. Can we break it down?"
          ].map((prompt) => (
            <Link
              key={prompt}
              href="/chats"
              className="rounded-full border border-[var(--border)] bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-[var(--muted-strong)] transition hover:border-amber-500/40 hover:bg-white hover:text-[var(--text)]"
            >
              {prompt}
            </Link>
          ))}
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <Stat icon={<FolderOpen size={20} />} label="Projects" value={counts.projects.toString()} />
        <Stat icon={<BookOpen size={20} />} label="Notes" value={counts.notes.toString()} />
        <Stat icon={<Files size={20} />} label="Files" value={counts.files.toString()} />
        <Stat icon={<Brain size={20} />} label="Flashcards" value={counts.flashcards.toString()} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <PanelList title="Recent thoughts" href="/chats" empty="No thoughts yet">
          {chats.map((chat) => (
            <Link key={chat.id} href={`/chats?thread=${chat.id}`} className="flex items-center justify-between rounded-2xl px-3 py-3 hover:bg-[var(--surface-subtle)]">
              <span className="font-bold">{chat.title}</span>
              <span className="text-sm text-[var(--muted)]">{formatRelative(chat.updated_at)}</span>
            </Link>
          ))}
        </PanelList>
        <PanelList title="Projects" href="/projects" empty="No projects yet">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`} className="flex items-center justify-between rounded-2xl px-3 py-3 hover:bg-[var(--surface-subtle)]">
              <span className="font-bold">{project.name}</span>
              <span className="text-sm text-[var(--muted)]">{formatRelative(project.updated_at)}</span>
            </Link>
          ))}
        </PanelList>
        <PanelList title="Recent files" href="/files" empty="No files uploaded">
          {files.map((file) => (
            <div key={file.id} className="flex items-center justify-between rounded-2xl px-3 py-3">
              <span className="font-bold">{file.name}</span>
              <FileProcessingStatus status={file.extraction_status} />
            </div>
          ))}
        </PanelList>
        <QuickActions />
      </section>
    </div>
  );
}

function getDayPart() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between text-[var(--muted)]">
        {icon}
        <span className="text-xs font-extrabold uppercase tracking-[0.1em]">{label}</span>
      </div>
      <p className="mt-4 text-3xl font-extrabold tracking-[-0.03em]">{value}</p>
    </div>
  );
}

function PanelList({ title, href, empty, children }: { title: string; href: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">{title}</h2>
        <Link href={href} className="text-sm font-bold text-[var(--muted)] hover:text-[var(--text)]">
          View all
        </Link>
      </div>
      {hasChildren ? <div className="space-y-1">{children}</div> : <p className="py-10 text-center text-sm text-[var(--muted)]">{empty}</p>}
    </section>
  );
}
