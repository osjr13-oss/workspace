"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Send } from "lucide-react";
import { WorkspaceHeader } from "@/components/workspace-header";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatRelative } from "@/lib/format";
import type { ChatMessage, ChatThread, Project } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ChatsPage() {
  const searchParams = useSearchParams();
  const initialThread = searchParams.get("thread");
  const initialProject = searchParams.get("project");
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(initialThread);
  const [projectId, setProjectId] = useState(initialProject || "");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  async function loadThreads() {
    const supabase = createSupabaseBrowserClient();
    const [threadResult, projectResult] = await Promise.all([
      supabase.from("chat_threads").select("*").order("updated_at", { ascending: false }),
      supabase.from("projects").select("*").order("name")
    ]);
    setThreads((threadResult.data as ChatThread[]) || []);
    setProjects((projectResult.data as Project[]) || []);
  }

  async function loadMessages(id: string | null) {
    if (!id) {
      setMessages([]);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.from("chat_messages").select("*").eq("thread_id", id).order("created_at", { ascending: true });
    setMessages((data as ChatMessage[]) || []);
  }

  useEffect(() => {
    loadThreads();
  }, []);

  useEffect(() => {
    loadMessages(threadId);
  }, [threadId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    const prompt = text;
    setText("");
    setLoading(true);
    setMessages((current) => [
      ...current,
      { id: "pending-user", thread_id: threadId || "pending", user_id: "", role: "user", content: prompt, created_at: new Date().toISOString() }
    ]);

    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: prompt, threadId, projectId: projectId || null })
    });
    const payload = await response.json();
    if (response.ok) {
      setThreadId(payload.threadId);
      await Promise.all([loadThreads(), loadMessages(payload.threadId)]);
    } else {
      setMessages((current) => [
        ...current.filter((message) => message.id !== "pending-user"),
        { id: "error", thread_id: threadId || "pending", user_id: "", role: "assistant", content: payload.error || "Chat failed.", created_at: new Date().toISOString() }
      ]);
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto grid h-screen max-w-7xl gap-6 px-5 py-8 sm:px-6 lg:grid-cols-[320px_1fr] lg:py-10">
      <aside className="panel flex min-h-0 flex-col p-4">
        <WorkspaceHeader title="Chats" eyebrow="AI" />
        <button type="button" onClick={() => { setThreadId(null); setMessages([]); }} className="btn-primary mt-5">
          New conversation
        </button>
        <select aria-label="Chat context" className="input-premium mt-3 px-5" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          <option value="">Global chat</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
        <div className="mt-5 min-h-0 flex-1 space-y-2 overflow-y-auto">
          {threads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => { setThreadId(thread.id); setProjectId(thread.project_id || ""); }}
              className={`w-full rounded-2xl p-4 text-left ${threadId === thread.id ? "bg-[var(--surface-subtle)]" : "hover:bg-[var(--surface-subtle)]"}`}
            >
              <p className="font-extrabold">{thread.title}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{formatRelative(thread.updated_at)}</p>
            </button>
          ))}
        </div>
      </aside>

      <section className="panel flex min-h-0 flex-col overflow-hidden">
        <div className="border-b border-[var(--border)] p-5">
          <h1 className="text-base font-extrabold tracking-[-0.01em]">{threadId ? "Conversation" : "New conversation"}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{projectId ? "Project context enabled" : "Global workspace chat"}</p>
        </div>
        <div ref={listRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length ? (
            messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] rounded-[18px] border border-[var(--border)] p-4 text-sm leading-6 ${message.role === "user" ? "bg-[var(--text)] text-white" : "bg-white/72 text-[var(--muted-strong)]"}`}>
                  {message.role === "user" ? (
                    message.content
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      className="prose prose-sm max-w-none prose-p:my-1 prose-headings:font-extrabold prose-headings:tracking-tight prose-code:text-xs prose-pre:text-xs"
                    >
                      {message.content}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="grid h-full place-items-center text-center">
              <div>
                <h2 className="text-3xl font-extrabold tracking-[-0.03em]">Ask Meridian anything.</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">Use a project to include its notes, files, and flashcards.</p>
              </div>
            </div>
          )}
          {loading ? <div className="status-pill">Thinking</div> : null}
        </div>
        <form onSubmit={send} className="border-t border-[var(--border)] p-4">
          <div className="flex gap-3 rounded-full border border-[var(--border)] bg-white/80 p-2">
            <input aria-label="Chat message" className="min-h-11 flex-1 bg-transparent px-4 text-sm outline-none" value={text} onChange={(event) => setText(event.target.value)} placeholder="Ask anything, or paste text to transform..." />
            <button type="submit" className="btn-primary min-h-11 px-4" disabled={loading}>
              <Send size={18} />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
