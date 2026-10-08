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

/** A message plus a React key that survives the swap from streamed text to the saved row. */
type DisplayMessage = ChatMessage & { clientKey?: string };

type Handoff = { userKey?: string | null; assistantKey?: string | null };

function withHandoffKeys(rows: ChatMessage[], handoff?: Handoff): DisplayMessage[] {
  const out: DisplayMessage[] = rows.map((row) => ({ ...row }));
  if (!handoff) return out;
  let assistantIndex = -1;
  for (let i = out.length - 1; i >= 0; i -= 1) {
    if (out[i].role === "assistant") {
      assistantIndex = i;
      break;
    }
  }
  if (assistantIndex >= 0 && handoff.assistantKey) out[assistantIndex].clientKey = handoff.assistantKey;
  if (handoff.userKey) {
    for (let i = (assistantIndex >= 0 ? assistantIndex : out.length) - 1; i >= 0; i -= 1) {
      if (out[i].role === "user") {
        out[i].clientKey = handoff.userKey;
        break;
      }
    }
  }
  return out;
}

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
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [threadId, setThreadIdState] = useState<string | null>(initialThread);
  // The conversation id is also kept in a ref that is updated the instant it is known, so the next
  // message can never be sent with a stale id while React is still applying the state update.
  const threadIdRef = useRef<string | null>(initialThread);
  function setThreadId(id: string | null) {
    threadIdRef.current = id;
    setThreadIdState(id);
  }
  const [projectId, setProjectId] = useState(initialProject || "");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  // True once the first words of a reply are on screen, so the thinking mark never returns after them.
  const [replyStarted, setReplyStarted] = useState(false);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const turnRef = useRef(0);
  // Only one reply can be in flight. Enter in the text box submits even while busy, so this is checked synchronously.
  const busyRef = useRef(false);
  const loadingRef = useRef(false);
  const skipLoadRef = useRef<string | null>(null);
  loadingRef.current = loading;

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

  async function loadMessages(id: string | null, handoff?: Handoff) {
    if (!id) {
      setMessages([]);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.from("chat_messages").select("*").eq("thread_id", id).order("created_at", { ascending: true });
    setMessages(withHandoffKeys((data as ChatMessage[]) || [], handoff));
  }

  useEffect(() => {
    loadThreads();
  }, []);

  useEffect(() => {
    // A thread created by our own reply is loaded once, by the reply itself.
    if (skipLoadRef.current && skipLoadRef.current === threadId) {
      skipLoadRef.current = null;
      return;
    }
    loadMessages(threadId);
  }, [threadId]);

  useEffect(() => {
    const activeThread = threads.find((thread) => thread.id === threadId);
    if (activeThread) setProjectId(activeThread.project_id || "");
  }, [threadId, threads]);

  useEffect(() => {
    // Jump while a reply is streaming; a smooth scroll restarted on every update falls behind.
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: loadingRef.current ? "auto" : "smooth" });
  }, [messages]);

  async function requestReply(
    options: { message?: string; editMessageId?: string; regenerateMessageId?: string },
    userKey: string | null = null
  ) {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      await runReply(options, userKey);
    } finally {
      busyRef.current = false;
    }
  }

  async function runReply(
    options: { message?: string; editMessageId?: string; regenerateMessageId?: string },
    userKey: string | null
  ) {
    setLoading(true);
    setReplyStarted(false);
    turnRef.current += 1;
    const assistantKey = `streaming-${turnRef.current}`;
    const canRestoreText = !options.editMessageId && !options.regenerateMessageId;
    let streamStarted = false;
    const startingThreadId = threadIdRef.current;
    let streamThreadId: string | null = startingThreadId;

    // A reply that could not be produced leaves nothing behind on the server, so
    // the user's own message is taken off the screen and put back in the box.
    const fail = (text: string) => {
      setMessages((current) => [
        ...current.filter((message) => message.id !== "pending-user" && message.id !== "streaming"),
        { id: "error", thread_id: threadId || "pending", user_id: "", role: "assistant", content: text, created_at: new Date().toISOString() }
      ]);
      if (canRestoreText && options.message) setText((current) => current || options.message || "");
      setReplyStarted(false);
      setLoading(false);
    };

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...options,
          threadId: threadIdRef.current,
          projectId: projectId || null
        })
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        fail(payload.error || "Chat failed.");
        return;
      }

      // Tool-action replies currently arrive as JSON; normal chat replies stream.
      const isStreaming = (response.headers.get("content-type") || "").includes("text/plain");
      if (!isStreaming) {
        const payload = await response.json();
        if (payload.threadId && payload.threadId !== startingThreadId) skipLoadRef.current = payload.threadId;
        setThreadId(payload.threadId);
        await loadMessages(payload.threadId, { userKey, assistantKey });
        setReplyStarted(false);
        setLoading(false);
        void loadThreads();
        return;
      }

      const newThreadId = response.headers.get("X-Thread-Id") || startingThreadId;
      streamStarted = true;
      streamThreadId = newThreadId;

      // Reply fills into an assistant bubble as tokens arrive.
      setMessages((current) => [
        ...current,
        { id: "streaming", clientKey: assistantKey, thread_id: newThreadId || "pending", user_id: "", role: "assistant", content: "", created_at: new Date().toISOString() }
      ]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      let frame = 0;
      // At most one redraw per frame, however fast the words arrive.
      const flush = () => {
        frame = 0;
        const text = acc;
        if (text.trim()) setReplyStarted(true);
        setMessages((current) => current.map((message) => (message.id === "streaming" ? { ...message, content: text } : message)));
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        if (!frame) frame = requestAnimationFrame(flush);
      }
      if (frame) cancelAnimationFrame(frame);
      flush();

      if (newThreadId && newThreadId !== startingThreadId) {
        skipLoadRef.current = newThreadId;
        setThreadId(newThreadId);
      }
      // The saved rows take over the same on-screen elements, so nothing flickers.
      await loadMessages(newThreadId, { userKey, assistantKey });
      setReplyStarted(false);
      setLoading(false);
      void loadThreads();
    } catch (error) {
      console.error("[chat] request failed", error);
      if (streamStarted) {
        // The connection dropped mid-reply. The server finishes and saves the answer,
        // so keep what has arrived and then show the saved copy.
        setReplyStarted(false);
        setLoading(false);
        window.setTimeout(() => void loadMessages(streamThreadId, { userKey, assistantKey }), 2500);
        return;
      }
      fail("Network error. Please try again.");
    }
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const prompt = removeEmDashes(text).trim();
    if (!prompt || busyRef.current) return;
    setText("");
    const userKey = `pending-user-${turnRef.current + 1}`;
    setMessages((current) => [
      ...current.filter((message) => message.id !== "error"),
      {
        id: "pending-user",
        clientKey: userKey,
        thread_id: threadId || "pending",
        user_id: "",
        role: "user",
        content: prompt,
        created_at: new Date().toISOString()
      }
    ]);
    await requestReply({ message: prompt }, userKey);
  }

  async function editAndResend(messageId: string, content: string) {
    if (busyRef.current) return;
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
    if (busyRef.current) return;
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

      <section className="panel flex min-h-0 flex-col overflow-hidden" aria-busy={loading}>
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
                key={message.clientKey ?? message.id}
                message={message}
                busy={loading}
                onEdit={editAndResend}
                onRegenerate={regenerate}
              />
            ))
          ) : (
            <div className="grid h-full place-items-center text-center">
              <div>
                <h2 className="text-3xl font-extrabold tracking-[-0.03em]">Talk to Selrano.</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">Start anywhere, or add a project when your own material should guide the answer.</p>
              </div>
            </div>
          )}
          {loading && !replyStarted ? <ThinkingTrace /> : null}
        </div>
        <form onSubmit={send} className="border-t border-[var(--border)] p-4">
          <div className="flex gap-3 rounded-full border border-[var(--border)] bg-white/80 p-2">
            <ChatComposer value={text} disabled={loading} onChange={setText} />
          </div>
        </form>
      </section>
    </div>
  );
}
