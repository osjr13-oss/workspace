"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ChatComposer } from "@/components/chat-composer";
import { ChatMessageBubble } from "@/components/chat-message";
import { ThinkingTrace } from "@/components/thinking-trace";
import { WorkspaceHeader } from "@/components/workspace-header";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatRelative } from "@/lib/format";
import { removeEmDashes } from "@/lib/text";
import type { ChatMessage, ChatThread, Project } from "@/lib/types";

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
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(initialThread);
  const [projectId, setProjectId] = useState(initialProject || "");
  const [text, setText] = useState("");
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
    const activeThread = threads.find((thread) => thread.id === threadId);
    if (activeThread) setProjectId(activeThread.project_id || "");
  }, [threadId, threads]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

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
          { id: "error", thread_id: threadId || "pending", user_id: "", role: "assistant", content: payload.error || "Chat failed.", created_at: new Date().toISOString() }
        ]);
        setLoading(false);
        return;
      }

      // Tool-action replies currently arrive as JSON; normal chat replies stream.
      const isStreaming = (response.headers.get("content-type") || "").includes("text/plain");
      if (!isStreaming) {
        const payload = await response.json();
        setThreadId(payload.threadId);
        await Promise.all([loadThreads(), loadMessages(payload.threadId)]);
        setLoading(false);
        return;
      }

      const newThreadId = response.headers.get("X-Thread-Id") || threadId;

      // Streaming ON: reply fills into an assistant bubble as tokens arrive.
      setMessages((current) => [
        ...current,
        { id: "streaming", thread_id: newThreadId || "pending", user_id: "", role: "assistant", content: "", created_at: new Date().toISOString() }
      ]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((current) => current.map((message) => (message.id === "streaming" ? { ...message, content: acc } : message)));
      }

      if (newThreadId) setThreadId(newThreadId);
      await Promise.all([loadThreads(), loadMessages(newThreadId)]);
      setLoading(false);
    } catch {
      setMessages((current) => [
        ...current.filter((message) => message.id !== "pending-user" && message.id !== "streaming"),
        { id: "error", thread_id: threadId || "pending", user_id: "", role: "assistant", content: "Network error. Please try again.", created_at: new Date().toISOString() }
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

  return (
    <div className="mx-auto grid h-screen max-w-7xl gap-6 px-5 py-8 sm:px-6 lg:grid-cols-[320px_1fr] lg:py-10">
      <aside className="panel flex min-h-0 flex-col p-4">
        <WorkspaceHeader title="Chats" eyebrow="AI" />
        <button type="button" onClick={() => { setThreadId(null); setMessages([]); }} className="btn-primary mt-5">
          New conversation
        </button>
        <select aria-label="Chat context" className="input-premium mt-3 px-5" value={projectId} onChange={(event) => setProjectId(event.target.value)} disabled={Boolean(threadId)}>
          <option value="">Global chat</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
        {threadId ? <p className="mt-2 px-2 text-xs text-[var(--muted)]">Start a new conversation to change project context.</p> : null}
        <div className="mt-5 min-h-0 flex-1 space-y-2 overflow-y-auto">
          {threads.map((thread) => (
            <div key={thread.id} className="group/thread relative">
              <button
                type="button"
                onClick={() => { setThreadId(thread.id); setProjectId(thread.project_id || ""); }}
                className={`w-full rounded-2xl p-4 pr-12 text-left ${threadId === thread.id ? "bg-[var(--surface-subtle)]" : "hover:bg-[var(--surface-subtle)]"}`}
              >
                <p className="truncate font-extrabold">{removeEmDashes(thread.title)}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{formatRelative(thread.updated_at)}</p>
              </button>
              <button
                type="button"
                onClick={() => deleteThread(thread.id)}
                disabled={deletingThreadId === thread.id}
                className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-[var(--muted)] opacity-100 transition hover:bg-white hover:text-[var(--critical)] focus:opacity-100 sm:opacity-0 sm:group-hover/thread:opacity-100 ${
                  threadId === thread.id ? "sm:opacity-100" : ""
                }`}
                aria-label={`Delete ${removeEmDashes(thread.title)}`}
                title="Delete conversation"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <section className="panel flex min-h-0 flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] p-5">
          <div>
            <h1 className="text-base font-extrabold tracking-[-0.01em]">{threadId ? "Conversation" : "New conversation"}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">{projectId ? "Project context enabled" : "Global workspace chat"}</p>
          </div>
          {threadId ? (
            <button
              type="button"
              onClick={() => deleteThread(threadId)}
              disabled={deletingThreadId === threadId}
              title="Delete conversation"
              className="btn-secondary shrink-0 text-[var(--critical)]"
            >
              <Trash2 size={16} />
            </button>
          ) : null}
        </div>
        <div ref={listRef} className="min-h-0 flex-1 space-y-8 overflow-y-auto px-5 py-7 sm:px-8 lg:px-10">
          {messages.length ? (
            messages.map((message) => (
              <ChatMessageBubble
                key={message.id}
                message={message}
                busy={loading}
                onEdit={editAndResend}
                onRegenerate={regenerate}
              />
            ))
          ) : (
            <div className="grid h-full place-items-center text-center">
              <div className="max-w-md px-4">
                <h2 className="text-3xl font-extrabold tracking-[-0.03em]">{"What's on your mind?"}</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">Start with an idea, a decision, or a feeling of being stuck. We can start wherever you are.</p>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
                  {[
                    "I have an idea, but I don't know where to start.",
                    "Help me choose between a few directions.",
                    "I'm stuck. Can we think it through?"
                  ].map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => {
                        setText(example);
                      }}
                      className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-xs font-semibold text-[var(--text)] hover:border-[var(--border-strong)] transition"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {loading && !messages.some((message) => message.id === "streaming" && message.content.trim()) ? <ThinkingTrace /> : null}
        </div>
        <form onSubmit={send} className="border-t border-[var(--border)] p-4">
          <div className="flex gap-3 rounded-full border border-[var(--border)] bg-white/80 p-2">
            <ChatComposer
              value={text}
              disabled={loading}
              onChange={setText}
              hasMessages={messages.length > 0}
              onRecap={() =>
                requestReply({
                  message:
                    "Where we are: summarize our current direction, what I have decided, what remains uncertain, and one possible next step."
                })
              }
            />
          </div>
        </form>
      </section>
    </div>
  );
}
