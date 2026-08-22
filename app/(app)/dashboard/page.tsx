"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Clock,
  Files,
  FolderOpen,
  MessageSquare,
  Plus,
  Sparkles,
  Zap
} from "lucide-react";
import { WorkspaceHeader } from "@/components/workspace-header";
import { FileProcessingStatus } from "@/components/file-processing-status";
import { QuickActions } from "@/components/quick-actions";
import { OnboardingGuide } from "@/components/onboarding-guide";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatRelative } from "@/lib/format";
import type { ChatThread, Project, WorkspaceFile } from "@/lib/types";

const STARTER_PROMPTS = [
  "Thinking through a tough decision",
  "Planning my week and priorities",
  "Unpacking an idea I have been circling",
  "Reflecting on a recent conversation"
];

export default function DashboardPage() {
  const router = useRouter();
  const [name, setName] = useState("there");
  const [projects, setProjects] = useState<Project[]>([]);
  const [chats, setChats] = useState<ChatThread[]>([]);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [counts, setCounts] = useState({ thoughts: 0, notes: 0, projects: 0, files: 0 });
  const [thought, setThought] = useState("");
  const [loading, setLoading] = useState(true);

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
        supabase.from("chat_threads").select("*").order("updated_at", { ascending: false }).limit(5),
        supabase.from("projects").select("*").order("updated_at", { ascending: false }).limit(4),
        supabase.from("files").select("*").order("created_at", { ascending: false }).limit(4),
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
      setLoading(false);
    }
    load();
  }, []);

  function startThinking(event: React.FormEvent) {
    event.preventDefault();
    const text = thought.trim();
    if (!text) return;
    router.push(`/chats?compose=${encodeURIComponent(text)}`);
  }

  function handleStarterPrompt(prompt: string) {
    router.push(`/chats?compose=${encodeURIComponent(prompt)}`);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-5 py-8 sm:px-8">
      {/* Workspace Header */}
      <WorkspaceHeader
        title={`Good ${getDayPart()}, ${name}.`}
        eyebrow="Overview"
      >
        <Link href="/chats" className="btn-primary">
          <Plus size={16} />
          New Thought
        </Link>
      </WorkspaceHeader>

      {/* Onboarding Guide for New & Existing Workspaces */}
      <OnboardingGuide
        hasThoughts={counts.thoughts > 0}
        hasNotes={counts.notes > 0}
        hasFiles={counts.files > 0}
      />

      {/* Hero Quick-Capture Thinking Box */}
      <form onSubmit={startThinking} className="panel p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <label htmlFor="quick-thought" className="flex items-center gap-2 text-sm font-bold text-[var(--text)]">
            <MessageSquare size={16} className="text-[var(--muted)]" />
            <span>Capture a thought or strategic question</span>
          </label>
          <span className="badge badge-brand text-[10px]">Durable Memory Active</span>
        </div>

        <textarea
          id="quick-thought"
          value={thought}
          onChange={(event) => setThought(event.target.value)}
          placeholder="A decision you keep circling, an architecture proposal, or a complex question. Selrano connects it with past sessions."
          className="textarea-enterprise mt-3 min-h-[100px] w-full text-sm leading-relaxed placeholder:text-[var(--muted)]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              startThinking(e);
            }
          }}
        />

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Starter Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-[var(--muted)]">Try:</span>
            {STARTER_PROMPTS.slice(0, 2).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleStarterPrompt(p)}
                className="rounded-lg border border-[var(--border)] bg-slate-50 px-2.5 py-1 text-xs text-[var(--muted-strong)] transition hover:border-[var(--border-strong)] hover:bg-white hover:text-[var(--text)]"
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="submit"
              className="btn-primary"
              disabled={!thought.trim()}
            >
              <span>Start session</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </form>

      {/* Metrics Row */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={<MessageSquare size={18} />} label="Thoughts" value={counts.thoughts.toString()} href="/chats" />
        <StatCard icon={<BookOpen size={18} />} label="Notes" value={counts.notes.toString()} href="/notes" />
        <StatCard icon={<FolderOpen size={18} />} label="Projects" value={counts.projects.toString()} href="/projects" />
        <StatCard icon={<Files size={18} />} label="Files" value={counts.files.toString()} href="/files" />
      </section>

      {/* Multi-Panel Knowledge Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Thinking Sessions */}
        <section className="panel p-5">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-[var(--muted)]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                Recent Thinking Sessions
              </h2>
            </div>
            <Link href="/chats" className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)]">
              View all
            </Link>
          </div>
          <div className="mt-3 space-y-1">
            {chats.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--muted)]">
                No conversations yet. Start above.
              </p>
            ) : (
              chats.map((chat) => (
                <Link
                  key={chat.id}
                  href={`/chats?thread=${chat.id}`}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition hover:bg-slate-100"
                >
                  <span className="font-medium text-[var(--text)] truncate max-w-[70%]">
                    {chat.title}
                  </span>
                  <span className="text-xs text-[var(--muted)] shrink-0">
                    {formatRelative(chat.updated_at)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* Projects Hub */}
        <section className="panel p-5">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <div className="flex items-center gap-2">
              <FolderOpen size={16} className="text-[var(--muted)]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                Active Projects
              </h2>
            </div>
            <Link href="/projects" className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)]">
              View all
            </Link>
          </div>
          <div className="mt-3 space-y-1">
            {projects.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--muted)]">
                No active projects. Group your thoughts in Projects.
              </p>
            ) : (
              projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition hover:bg-slate-100"
                >
                  <span className="font-medium text-[var(--text)] truncate max-w-[70%]">
                    {project.name}
                  </span>
                  <span className="text-xs text-[var(--muted)] shrink-0">
                    {formatRelative(project.updated_at)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* Grounded Files */}
        <section className="panel p-5">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <div className="flex items-center gap-2">
              <Files size={16} className="text-[var(--muted)]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                Workspace Materials
              </h2>
            </div>
            <Link href="/files" className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)]">
              View all
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {files.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--muted)]">
                No documents uploaded. Add PDFs or text files to ground AI.
              </p>
            ) : (
              files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm bg-slate-50/70 border border-[var(--border)]"
                >
                  <span className="font-medium text-[var(--text)] truncate max-w-[65%]">
                    {file.name}
                  </span>
                  <FileProcessingStatus status={file.extraction_status} />
                </div>
              ))
            )}
          </div>
        </section>

        {/* Quick AI Transformations */}
        <QuickActions />
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

function StatCard({
  icon,
  label,
  value,
  href
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link href={href} className="stat-card block transition hover:border-slate-400">
      <div className="flex items-center justify-between text-[var(--muted)]">
        <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-[var(--text)]">{value}</p>
    </Link>
  );
}
