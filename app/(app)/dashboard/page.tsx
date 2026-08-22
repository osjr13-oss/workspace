"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Files, FolderOpen, MessageSquare } from "lucide-react";
import { WorkspaceHeader } from "@/components/workspace-header";
import { FileProcessingStatus } from "@/components/file-processing-status";
import { QuickActions } from "@/components/quick-actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatRelative } from "@/lib/format";
import type { ChatThread, Project, WorkspaceFile } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [name, setName] = useState("there");
  const [projects, setProjects] = useState<Project[]>([]);
  const [chats, setChats] = useState<ChatThread[]>([]);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [counts, setCounts] = useState({ thoughts: 0, notes: 0, projects: 0, files: 0 });
  const [thought, setThought] = useState("");

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
      const [chatsResult, projectsResult, filesResult, thoughtCountResult, notesCountResult, projectCountResult, fileCountResult] = await Promise.all([
        supabase.from("chat_threads").select("*").order("updated_at", { ascending: false }).limit(4),
        supabase.from("projects").select("*").order("updated_at", { ascending: false }).limit(3),
        supabase.from("files").select("*").order("created_at", { ascending: false }).limit(3),
        supabase.from("chat_threads").select("id", { count: "exact", head: true }),
        supabase.from("notes").select("id", { count: "exact", head: true }),
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("files").select("id", { count: "exact", head: true })
      ]);
      setChats((chatsResult.data as ChatThread[]) || []);
      setProjects((projectsResult.data as Project[]) || []);
      setFiles((filesResult.data as WorkspaceFile[]) || []);
      setCounts({
        thoughts: thoughtCountResult.count || 0,
        notes: notesCountResult.count || 0,
        projects: projectCountResult.count || 0,
        files: fileCountResult.count || 0
      });
    }
    load();
  }, []);

  function startThinking(event: React.FormEvent) {
    event.preventDefault();
    const text = thought.trim();
    if (!text) return;
    router.push(`/chats?compose=${encodeURIComponent(text)}`);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7 px-5 py-8 sm:px-6 lg:py-10">
      <WorkspaceHeader title={`Good ${getDayPart()}, ${name}.`} eyebrow="Home">
        <Link href="/chats" className="btn-primary">
          <MessageSquare size={18} />
          New thought
        </Link>
      </WorkspaceHeader>

      <form onSubmit={startThinking} className="panel p-6">
        <label htmlFor="quick-thought" className="text-sm font-extrabold tracking-[-0.01em]">
          What is on your mind?
        </label>
        <textarea
          id="quick-thought"
          value={thought}
          onChange={(event) => setThought(event.target.value)}
          placeholder="A decision you keep circling, a goal, a half-formed idea. Selrano will remember the thread."
          className="mt-4 min-h-28 w-full rounded-[18px] border border-[var(--border)] bg-white/70 p-4 text-sm leading-6 outline-none focus:border-[var(--border-strong)]"
        />
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="hidden text-xs font-bold text-[var(--muted)] sm:block">
            Private to your account. Everything here stays yours.
          </p>
          <button type="submit" className="btn-primary shrink-0" disabled={!thought.trim()}>
            Start thinking
            <ArrowRight size={18} />
          </button>
        </div>
      </form>

      <section className="grid gap-4 md:grid-cols-4">
        <Stat icon={<MessageSquare size={20} />} label="Thoughts" value={counts.thoughts.toString()} />
        <Stat icon={<BookOpen size={20} />} label="Notes" value={counts.notes.toString()} />
        <Stat icon={<FolderOpen size={20} />} label="Projects" value={counts.projects.toString()} />
        <Stat icon={<Files size={20} />} label="Files" value={counts.files.toString()} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <PanelList title="Recent thinking" href="/chats" empty="Nothing yet. Start above.">
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
