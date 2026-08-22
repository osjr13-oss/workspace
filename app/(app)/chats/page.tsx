"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Brain,
  FolderOpen,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Trash2
} from "lucide-react";
import { ChatComposer } from "@/components/chat-composer";
import { ChatMessageBubble } from "@/components/chat-message";
import { ThinkingTrace } from "@/components/thinking-trace";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatRelative } from "@/lib/format";
import { removeEmDashes } from "@/lib/text";
import type { ChatMessage, ChatThread, Project } from "@/lib/types";

const SUGGESTIONS = [
  {
    title: "Strategic Trade-offs",
    prompt: "Help me analyze the trade-offs between speed-to-market and architectural purity for our next milestone."
  },
  {
    title: "Technical RFC Review",
    prompt: "Review this system proposal and identify edge cases, scaling bottlenecks, and failure modes."
  },
  {
    title: "Decision Breakdown",
    prompt: "I need to make a tough decision regarding resource allocation. Help me structure my thinking."
  }
];

export default function ChatsPage() {
  return (
    <Suspense>
      <ChatsContent />
    </Suspense>
  );
}

function ChatsContent() {
  const searchParams = useSearchParams();
  const initialThread = searchParams.get("thread");
  const initialProject = searchParams.get("project");
  const initialCompose = searchParams.get("compose");
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(initialThread);
  const [projectId, setProjectId] = useState(initialProject || "");
  const [text, setText] = useState(initialCompose ? removeEmDashes(initialCompose).slice(0, 2000) : "");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  async function loadThreads() {
    const supabase = createSupabaseBrowserClient();
    const [threadResult, projectResult] = await Promise.all([
      supabase.from("chat_threads").select("*").order("updated_at", { ascending: false }),
      supabase.from("projects").select("*").order("name")
    ]);
    const loadedThreads = (threadResult.data as ChatThread[]) || [];
    setThreads(loadedThreads);
    setProjects((projectResult.data as Project[]) || []);
  }

  async function loadMessages(id: string | null) {
    if (!id) {
      setMessages([]);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("thread_id", id)
      .order("created_at", { ascending: true });
    setMessages((data as ChatMessage[]) || []);
  }

  useEffect(() => {
    loadThreads();
  }, []);

  useEffect(() => {
    loadMessages(threadId);
  }, [threadId]);

  useEffect(() => {
    const activeThread = threads.find((thread) => thread.id === threadId);
    if (activeThread) setProjectId(activeThread.project_id || "");
  }, [threadId, threads]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function requestReply(options: {
    message?: string;
    editMessageId?: string;
    regenerateMessageId?: string;
  }) {
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...options,
          threadId,
          projectId: projectId || null
        })
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        setMessages((current) => [
          ...current.filter((message) => message.id !== "pending-user"),
          {
            id: "error",
            thread_id: threadId || "pending",
            user_id: "",
            role: "assistant",
            content: payload.error || "Chat request failed. Please check connection.",
            created_at: new Date().toISOString()
          }
        ]);
        setLoading(false);
        return;
      }

      const isStreaming = (response.headers.get("content-type") || "").includes("text/plain");
      if (!isStreaming) {
        const payload = await response.json();
        setThreadId(payload.threadId);
        await Promise.all([loadThreads(), loadMessages(payload.threadId)]);
        setLoading(false);
        return;
      }

      const newThreadId = response.headers.get("X-Thread-Id") || threadId;

      setMessages((current) => [
        ...current,
        {
          id: "streaming",
          thread_id: newThreadId || "pending",
          user_id: "",
          role: "assistant",
          content: "",
          created_at: new Date().toISOString()
        }
      ]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((current) =>
          current.map((message) =>
            message.id === "streaming" ? { ...message, content: acc } : message
          )
        );
      }

      if (newThreadId) setThreadId(newThreadId);
      await Promise.all([loadThreads(), loadMessages(newThreadId)]);
      setLoading(false);
    } catch {
      setMessages((current) => [
        ...current.filter(
          (message) => message.id !== "pending-user" && message.id !== "streaming"
        ),
        {
          id: "error",
          thread_id: threadId || "pending",
          user_id: "",
          role: "assistant",
          content: "Network error occurred. Please try again.",
          created_at: new Date().toISOString()
        }
      ]);
      setLoading(false);
    }
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const prompt = removeEmDashes(text).trim();
    if (!prompt) return;
    setText("");
    setMessages((current) => [
      ...current,
      {
        id: "pending-user",
        thread_id: threadId || "pending",
        user_id: "",
        role: "user",
        content: prompt,
        created_at: new Date().toISOString()
      }
    ]);
    await requestReply({ message: prompt });
  }

  async function editAndResend(messageId: string, content: string) {
    setMessages((current) => {
      const index = current.findIndex((message) => message.id === messageId);
      if (index === -1) return current;
      return current
        .slice(0, index + 1)
        .map((message) =>
          message.id === messageId
            ? { ...message, content: removeEmDashes(content) }
            : message
        );
    });
    await requestReply({ message: removeEmDashes(content), editMessageId: messageId });
  }

  async function regenerate(messageId: string) {
    setMessages((current) => {
      const index = current.findIndex((message) => message.id === messageId);
      return index === -1 ? current : current.slice(0, index);
    });
    await requestReply({ regenerateMessageId: messageId });
  }

  async function deleteThread(targetThreadId: string) {
    if (!confirm("Delete this conversation? All messages will be permanently removed.")) return;
    setDeletingThreadId(targetThreadId);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("chat_threads").delete().eq("id", targetThreadId);
    if (!error) {
      setThreads((current) => current.filter((thread) => thread.id !== targetThreadId));
      if (threadId === targetThreadId) {
        setThreadId(null);
        setMessages([]);
      }
    }
    setDeletingThreadId(null);
  }

  const filteredThreads = threads.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh)] overflow-hidden bg-[var(--background)]">
      {/* Thread Rail */}
      <aside className="hidden w-72 flex-col border-r border-[var(--border)] bg-white lg:flex">
        {/* Rail Header */}
        <div className="border-b border-[var(--border)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
              Thinking Sessions
            </h2>
            <button
              type="button"
              onClick={() => {
                setThreadId(null);
                setMessages([]);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white transition hover:bg-slate-800"
              title="New thought"
            >
              <Plus size={15} />
            </button>
          </div>

          {/* Thread Search */}
          <div className="flex items-center rounded-lg border border-[var(--border)] bg-slate-50 px-2.5 py-1.5 text-xs text-[var(--muted)]">
            <Search size={13} className="mr-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full bg-transparent outline-none placeholder:text-[var(--muted)] text-[var(--text)]"
            />
          </div>
        </div>

        {/* Thread List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredThreads.length === 0 ? (
            <p className="py-8 text-center text-xs text-[var(--muted)]">
              {searchQuery ? "No matching conversations." : "No saved sessions."}
            </p>
          ) : (
            filteredThreads.map((thread) => {
              const active = threadId === thread.id;
              return (
                <div key={thread.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => {
                      setThreadId(thread.id);
                      setProjectId(thread.project_id || "");
                    }}
                    className={`flex w-full flex-col rounded-lg p-2.5 pr-8 text-left transition ${
                      active
                        ? "bg-slate-100 font-semibold text-[var(--text)]"
                        : "text-[var(--muted-strong)] hover:bg-slate-50 hover:text-[var(--text)]"
                    }`}
                  >
                    <span className="truncate text-xs font-medium">
                      {removeEmDashes(thread.title)}
                    </span>
                    <span className="mt-0.5 text-[10px] text-[var(--muted)]">
                      {formatRelative(thread.updated_at)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteThread(thread.id)}
                    disabled={deletingThreadId === thread.id}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                    title="Delete session"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Thinking Canvas */}
      <section className="flex flex-1 flex-col overflow-hidden bg-white">
        {/* Top Studio Bar */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-3 bg-white">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setThreadId(null);
                setMessages([]);
              }}
              className="lg:hidden flex h-7 items-center gap-1 rounded-lg border border-[var(--border)] px-2 text-xs font-semibold text-[var(--text)]"
            >
              <Plus size={13} />
              <span>New</span>
            </button>
            <div>
              <h1 className="text-sm font-bold text-[var(--text)]">
                {threadId ? "Thinking Canvas" : "New Thought Session"}
              </h1>
              <p className="text-xs text-[var(--muted)]">
                Durable memory and grounded web tools enabled
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Project Context Picker */}
            <div className="flex items-center gap-1.5 text-xs text-[var(--muted-strong)]">
              <FolderOpen size={14} className="text-[var(--muted)]" />
              <select
                aria-label="Project context"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                disabled={Boolean(threadId)}
                className="rounded-lg border border-[var(--border)] bg-slate-50 px-2 py-1 text-xs font-medium text-[var(--text)] outline-none disabled:opacity-60"
              >
                <option value="">No Project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            {threadId && (
              <button
                type="button"
                onClick={() => deleteThread(threadId)}
                disabled={deletingThreadId === threadId}
                title="Delete conversation"
                className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-600 transition hover:bg-rose-100"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Message Stream View */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-5 py-6 sm:px-10 lg:px-16 space-y-6"
        >
          {messages.length === 0 ? (
            <div className="mx-auto max-w-xl py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md">
                <Brain size={22} />
              </div>
              <h2 className="mt-4 text-xl font-bold tracking-tight text-[var(--text)]">
                What is on your mind?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted-strong)]">
                Talk through decisions, draft proposals, or unpack complex problems. Selrano remembers context across all your sessions.
              </p>

              {/* Starter Suggestion Cards */}
              <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">
                {SUGGESTIONS.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => setText(item.prompt)}
                    className="flex flex-col justify-between rounded-xl border border-[var(--border)] bg-slate-50/70 p-4 transition hover:border-[var(--border-strong)] hover:bg-white hover:shadow-xs"
                  >
                    <span className="text-xs font-bold text-[var(--text)]">{item.title}</span>
                    <span className="mt-2 text-[11px] leading-5 text-[var(--muted)]">
                      {item.prompt}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <ChatMessageBubble
                key={message.id}
                message={message}
                busy={loading}
                onEdit={editAndResend}
                onRegenerate={regenerate}
              />
            ))
          )}

          {loading &&
            !messages.some((message) => message.id === "streaming" && message.content.trim()) && (
              <ThinkingTrace />
            )}
        </div>

        {/* Floating Composer Container */}
        <div className="border-t border-[var(--border)] bg-white p-4 sm:px-10 lg:px-16">
          <form
            onSubmit={send}
            className="mx-auto max-w-3xl rounded-2xl border border-[var(--border-strong)] bg-white p-2 shadow-sm focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/10"
          >
            <ChatComposer value={text} disabled={loading} onChange={setText} />
          </form>
          <p className="mt-2 text-center text-[11px] text-[var(--muted)]">
            Selrano grounds answers with live web citations and workspace files. Press Enter to send, Shift + Enter for new line.
          </p>
        </div>
      </section>
    </div>
  );
}
