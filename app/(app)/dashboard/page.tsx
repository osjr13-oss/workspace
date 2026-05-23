"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, Brain, Files, FolderOpen, MessageSquare, Plus } from "lucide-react";
import { WorkspaceHeader } from "@/components/workspace-header";
import { QuickActions } from "@/components/quick-actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatRelative } from "@/lib/format";
import type { ChatThread, Project, WorkspaceFile } from "@/lib/types";

export default function DashboardPage() {
  const [name, setName] = useState("there");
  const [projects, setProjects] = useState<Project[]>([]);
  const [chats, setChats] = useState<ChatThread[]>([]);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [counts, setCounts] = useState({ notes: 0, flashcards: 0 });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      setName(user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there");
      const [projectsResult, chatsResult, filesResult, notesResult, cardsResult] = await Promise.all([
        supabase.from("projects").select("*").order("updated_at", { ascending: false }).limit(3),
        supabase.from("chat_threads").select("*").order("updated_at", { ascending: false }).limit(3),
        supabase.from("files").select("*").order("created_at", { ascending: false }).limit(3),
        supabase.from("notes").select("id", { count: "exact", head: true }),
        supabase.from("flashcards").select("id", { count: "exact", head: true })
      ]);
      setProjects((projectsResult.data as Project[]) || []);
      setChats((chatsResult.data as ChatThread[]) || []);
      setFiles((filesResult.data as WorkspaceFile[]) || []);
      setCounts({ notes: notesResult.count || 0, flashcards: cardsResult.count || 0 });
    }
    load();
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-7 px-5 py-8 sm:px-6 lg:py-10">
      <WorkspaceHeader title={`Good ${getDayPart()}, ${name}.`} eyebrow="Home">
        <Link href="/chats" className="btn-primary">
          <Plus size={18} />
          New chat
        </Link>
      </WorkspaceHeader>

      <Link href="/chats" className="panel flex items-center justify-between p-6 hover:border-[var(--border-strong)]">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--surface-subtle)]">
            <MessageSquare size={21} />
          </span>
          <div>
            <h2 className="text-base font-extrabold tracking-[-0.01em]">Start a new conversation</h2>
            <p className="text-sm text-[var(--muted)]">Ask anything, draft something, think it through.</p>
          </div>
        </div>
        <Plus size={20} />
      </Link>

      <section className="grid gap-4 md:grid-cols-4">
        <Stat icon={<FolderOpen size={20} />} label="Projects" value={projects.length.toString()} />
        <Stat icon={<BookOpen size={20} />} label="Notes" value={counts.notes.toString()} />
        <Stat icon={<Files size={20} />} label="Files" value={files.length.toString()} />
        <Stat icon={<Brain size={20} />} label="Flashcards" value={counts.flashcards.toString()} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <PanelList title="Recent chats" href="/chats" empty="No chats yet">
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
              <span className="status-pill">{file.extraction_status}</span>
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
