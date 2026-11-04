"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUp, BookOpen, Files, FileUp, FolderOpen, Layers, MessageSquare, Plus } from "lucide-react";
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

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-5 py-8 sm:px-8 lg:py-12">
      <WorkspaceHeader title={`Good ${getDayPart()}, ${name}.`} eyebrow={today}>
        <Link href="/files" className="btn-secondary">
          <FileUp size={17} />
          Upload
        </Link>
        <Link href="/chats" className="btn-primary">
          <Plus size={17} />
          New chat
        </Link>
      </WorkspaceHeader>

      <Link href="/chats" className="composer group flex items-center gap-3 px-5 py-4 transition-[border-color,box-shadow] hover:border-[var(--accent-ring)]">
        <MessageSquare size={19} className="shrink-0 text-[var(--accent)]" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium">Ask your workspace a question</span>
          <span className="block truncate text-[13px] text-[var(--muted)]">Pick a project to include its notes, files, and flashcards as context.</span>
        </span>
        <span className="send-button shrink-0">
          <ArrowUp size={16} />
        </span>
      </Link>

      <section aria-label="Workspace totals" className="grid grid-cols-2 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] md:grid-cols-4">
        <Stat href="/projects" icon={<FolderOpen size={16} />} label="Projects" value={counts.projects} />
        <Stat href="/notes" icon={<BookOpen size={16} />} label="Notes" value={counts.notes} />
        <Stat href="/files" icon={<Files size={16} />} label="Files" value={counts.files} />
        <Stat href="/flashcards" icon={<Layers size={16} />} label="Flashcards" value={counts.flashcards} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <PanelList
            title="Pick up where you left off"
            href="/chats"
            empty={{ text: "Your recent chats will show up here.", action: "Start a chat", href: "/chats" }}
          >
            {chats.map((chat) => (
              <Row key={chat.id} href={`/chats?thread=${chat.id}`} icon={<MessageSquare size={15} />} title={chat.title} meta={formatRelative(chat.updated_at)} />
            ))}
          </PanelList>
          <PanelList
            title="Recent files"
            href="/files"
            empty={{ text: "Upload a PDF, document, or photo to ask about it.", action: "Upload a file", href: "/files" }}
          >
            {files.map((file) => (
              <div key={file.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                <Files size={15} className="shrink-0 text-[var(--muted)]" />
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{file.name}</span>
                <FileProcessingStatus status={file.extraction_status} />
              </div>
            ))}
          </PanelList>
        </div>
        <div className="space-y-6">
          <PanelList
            title="Projects"
            href="/projects"
            empty={{ text: "Group a class or thesis into one project.", action: "Create a project", href: "/projects" }}
          >
            {projects.map((project) => (
              <Row key={project.id} href={`/projects/${project.id}`} icon={<FolderOpen size={15} />} title={project.name} meta={formatRelative(project.updated_at)} />
            ))}
          </PanelList>
          <QuickActions />
        </div>
      </div>
    </div>
  );
}

function getDayPart() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function Stat({ href, icon, label, value }: { href: string; icon: React.ReactNode; label: string; value: number }) {
  return (
    <Link
      href={href}
      className="group border-[var(--border)] px-5 py-4 transition-colors hover:bg-[var(--background-elevated)] [&:not(:first-child)]:border-l max-md:[&:nth-child(3)]:border-l-0 max-md:[&:nth-child(n+3)]:border-t"
    >
      <span className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
        <span className="text-[var(--accent)]">{icon}</span>
        {label}
      </span>
      <span className="mt-1.5 block font-display text-[30px] font-medium leading-none tracking-[-0.02em]">{value}</span>
    </Link>
  );
}

function Row({ href, icon, title, meta }: { href: string; icon: React.ReactNode; title: string; meta: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--surface-subtle)]">
      <span className="shrink-0 text-[var(--muted)] group-hover:text-[var(--accent)]">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{title}</span>
      <span className="shrink-0 text-[13px] text-[var(--muted)]">{meta}</span>
    </Link>
  );
}

function PanelList({
  title,
  href,
  empty,
  children
}: {
  title: string;
  href: string;
  empty: { text: string; action: string; href: string };
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="panel p-4 sm:p-5">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
        <Link href={href} className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--muted)] hover:text-[var(--accent)]">
          View all <ArrowRight size={13} />
        </Link>
      </div>
      {hasChildren ? (
        <div className="space-y-0.5">{children}</div>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-xl bg-[var(--background-elevated)] px-4 py-5">
          <p className="text-sm text-[var(--muted-strong)]">{empty.text}</p>
          <Link href={empty.href} className="btn-secondary btn-sm">
            {empty.action}
          </Link>
        </div>
      )}
    </section>
  );
}
