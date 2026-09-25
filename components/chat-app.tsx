"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AccountMenu } from "@/components/account-menu";
import { ChatComposer, type AttachedFile } from "@/components/chat-composer";
import { ChatMessageBubble } from "@/components/chat-message";
import { ModelSelector } from "@/components/model-selector";
import { ThreadJumper } from "@/components/thread-jumper";
import { formatRelative } from "@/lib/format";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { supabaseConfigured } from "@/lib/supabase/config";
import { removeEmDashes } from "@/lib/text";
import type { ChatMessage, ChatThread } from "@/lib/types";

const starters = [
  "What is worth knowing before I decide?",
  "Search the web for this.",
  "Turn the last answer into flashcards."
];

export function ChatApp({ models, defaultModel }: { models: string[]; defaultModel: string }) {
  const searchParams = useSearchParams();
  const configured = supabaseConfigured();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(searchParams.get("thread"));
  const [model, setModel] = useState(defaultModel);
  const [text, setText] = useState("");
  const [attached, setAttached] = useState<AttachedFile[]>([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [jumperOpen, setJumperOpen] = useState(false);
  const [threadsOpen, setThreadsOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  function openThread(id: string | null) {
    setThreadId(id);
    const url = id ? `/chats?thread=${encodeURIComponent(id)}` : "/chats";
    window.history.replaceState(null, "", url);
  }

  async function refresh(id: string | null) {
    if (!configured) return;
    const supabase = createSupabaseBrowserClient();
    const threadResult = await supabase.from("chat_threads").select("*").order("updated_at", { ascending: false });
    if (threadResult.error) setNotice(threadResult.error.message);
    else setThreads((threadResult.data as ChatThread[]) || []);
    if (!id) {
      setMessages([]);
      return;
    }
    const messageResult = await supabase.from("chat_messages").select("*").eq("thread_id", id).order("created_at", { ascending: true });
    if (messageResult.error) setNotice(messageResult.error.message);
    else setMessages((messageResult.data as ChatMessage[]) || []);
  }

  useEffect(() => {
    const billing = searchParams.get("billing");
    if (billing === "success") setNotice("Checkout finished. Pro shows here after Stripe confirms it.");
    if (billing === "canceled") setNotice("Checkout was canceled.");
  }, [searchParams]);

  useEffect(() => {
    if (!configured) return;
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    void refresh(threadId);
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured]);

  useEffect(() => {
    if (!threadId) return;
    const thread = threads.find((item) => item.id === threadId);
    if (!thread?.model || !models.includes(thread.model)) return;
    setModel(thread.model);
  }, [threadId, threads, models]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, notice]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setJumperOpen((open) => !open);
        return;
      }
      if (event.key === "Escape") {
        if (abortRef.current) {
          abortRef.current.abort();
          return;
        }
        setJumperOpen(false);
        setAccountOpen(false);
        setThreadsOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!accountOpen) return;
    function onPointer(event: MouseEvent) {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [accountOpen]);

  async function chooseModel(next: string) {
    setModel(next);
    if (!threadId || !configured) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("chat_threads").update({ model: next }).eq("id", threadId);
    if (error) setNotice(error.message);
    setThreads((current) => current.map((thread) => (thread.id === threadId ? { ...thread, model: next } : thread)));
  }

  async function requestReply(options: { message?: string; editMessageId?: string; regenerateMessageId?: string; fileIds?: string[] }) {
    const controller = new AbortController();
    abortRef.current = controller;
    setSending(true);
    setNotice(null);
    const activeThread = threadId;
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...options, threadId: activeThread, model }),
        signal: controller.signal
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string; threadId?: string };
        setNotice(payload.error || "The model did not reply.");
        const saved = payload.threadId || activeThread;
        if (saved) openThread(saved);
        await refresh(saved);
        return;
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/plain")) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setNotice(payload.error || "The model did not reply.");
        await refresh(activeThread);
        return;
      }

      const savedThread = response.headers.get("X-Thread-Id") || activeThread;
      let acc = "";
      setMessages((current) => [
        ...current,
        {
          id: "streaming",
          thread_id: savedThread || "pending",
          user_id: "",
          role: "assistant",
          content: "",
          citations: [],
          artifacts: [],
          created_at: new Date().toISOString()
        }
      ]);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const snapshot = acc;
        setMessages((current) => current.map((item) => (item.id === "streaming" ? { ...item, content: snapshot } : item)));
      }
      if (!acc.trim()) setNotice(controller.signal.aborted ? "Stopped." : "The model returned an empty reply.");
      if (savedThread) openThread(savedThread);
      await refresh(savedThread);
    } catch (error) {
      if (controller.signal.aborted) {
        setNotice("Stopped.");
        await refresh(activeThread);
      } else {
        setNotice(error instanceof Error ? error.message : "Network error.");
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setSending(false);
    }
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (sending || uploading) return;
    const prompt = removeEmDashes(text).trim();
    if (!prompt && attached.length === 0) return;
    const files = [...attached];
    const full = files.length
      ? `${files.map((file) => `[Attached: ${file.name}]`).join(" ")}${prompt ? `\n\n${prompt}` : "\n\nPlease read the attached file."}`
      : prompt;
    setText("");
    setAttached([]);
    setMessages((current) => [
      ...current,
      {
        id: "pending-user",
        thread_id: threadId || "pending",
        user_id: "",
        role: "user",
        content: full,
        citations: [],
        artifacts: [],
        created_at: new Date().toISOString()
      }
    ]);
    await requestReply({ message: full, fileIds: files.map((file) => file.id) });
  }

  async function attachFile(file: File) {
    if (!configured) {
      setNotice("Sign in is not configured, so files cannot be saved.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/files/upload", { method: "POST", body: form });
      const payload = (await response.json().catch(() => ({}))) as { id?: string; name?: string; notice?: string | null; error?: string };
      if (!response.ok || !payload.id || !payload.name) {
        setNotice(payload.error || "Could not attach that file.");
        return;
      }
      setAttached((current) => [...current, { id: payload.id!, name: payload.name!, notice: payload.notice || null }]);
      if (payload.notice) setNotice(payload.notice);
    } finally {
      setUploading(false);
    }
  }

  async function removeThread(id: string) {
    if (!configured || sending) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("chat_threads").delete().eq("id", id);
    if (error) {
      setNotice(error.message);
      return;
    }
    setThreads((current) => current.filter((thread) => thread.id !== id));
    if (threadId === id) {
      setMessages([]);
      openThread(null);
    }
  }

  async function signOut() {
    if (!configured) return;
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-4">
        <p className="font-serif text-lg">Selrano</p>
        <button type="button" className="text-sm" onClick={() => { if (sending) return; setMessages([]); setText(""); setAttached([]); setNotice(null); setModel(defaultModel); openThread(null); setThreadsOpen(false); }}>
          New chat
        </button>
      </div>
      <div className="flex-1 overflow-auto px-2 pb-4">
        {configured ? (
          threads.length ? (
            <ul className="space-y-1">
              {threads.map((thread) => (
                <li key={thread.id} className={`group flex items-center rounded-lg ${thread.id === threadId ? "bg-white" : "hover:bg-black/5"}`}>
                  <button type="button" className="min-w-0 flex-1 px-3 py-2 text-left" onClick={() => { if (sending) return; openThread(thread.id); setThreadsOpen(false); void refresh(thread.id); }}>
                    <span className="block truncate text-sm">{thread.title}</span>
                    <span className="text-xs text-[var(--muted)]">{formatRelative(thread.updated_at)}</span>
                  </button>
                  <button type="button" className="px-2 text-xs text-[var(--muted)] opacity-0 group-hover:opacity-100" onClick={() => void removeThread(thread.id)} aria-label={`Delete ${thread.title}`}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 text-sm text-[var(--muted)]">No conversations yet.</p>
          )
        ) : (
          <p className="px-3 text-sm leading-6 text-[var(--muted)]">Sign in is not configured, so saved threads cannot load.</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh bg-[var(--bg)] text-[var(--ink)]">
      <aside className="hidden w-72 shrink-0 border-r border-[var(--line)] bg-[var(--sidebar)] md:block">{sidebar}</aside>
      {threadsOpen ? (
        <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setThreadsOpen(false)}>
          <aside className="h-full w-72 bg-[var(--sidebar)]" onClick={(event) => event.stopPropagation()}>
            {sidebar}
          </aside>
        </div>
      ) : null}

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-[var(--line)] px-3 py-2">
          <button type="button" className="rounded-lg px-2 py-1 text-sm md:hidden" onClick={() => setThreadsOpen(true)}>
            Threads
          </button>
          <ModelSelector models={models} value={model} onChange={(next) => void chooseModel(next)} />
          <div className="relative ml-auto" ref={accountRef}>
            <button type="button" className="max-w-[42vw] truncate rounded-lg px-2 py-1 text-sm md:max-w-[220px]" aria-expanded={accountOpen} onClick={() => setAccountOpen((open) => !open)}>
              {email ? email : "Account"}
            </button>
            <AccountMenu open={accountOpen} email={email} configured={configured} onClose={() => setAccountOpen(false)} onSignOut={() => void signOut()} />
          </div>
        </header>

        <div ref={listRef} className="flex-1 overflow-auto">
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-8">
            {messages.length ? (
              <div className="space-y-6">
                {messages.map((message) => (
                  <ChatMessageBubble
                    key={message.id}
                    message={message}
                    busy={sending}
                    onEdit={(id, content) => {
                      setMessages((current) => {
                        const index = current.findIndex((item) => item.id === id);
                        if (index < 0) return current;
                        const next = current.slice(0, index + 1);
                        next[index] = { ...next[index], content };
                        return next;
                      });
                      void requestReply({ message: content, editMessageId: id });
                    }}
                    onRegenerate={(id) => {
                      setMessages((current) => {
                        const index = current.findIndex((item) => item.id === id);
                        return index < 0 ? current : current.slice(0, index);
                      });
                      void requestReply({ regenerateMessageId: id });
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="my-auto">
                <h1 className="font-serif text-4xl tracking-tight">What are you thinking through?</h1>
                <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--muted)]">
                  The model in the header is a Groq model id. Enter sends. Shift+Enter breaks a line. Esc stops. Cmd or Ctrl+K jumps threads.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {starters.map((starter) => (
                    <button key={starter} type="button" className="rounded-full border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-sm" onClick={() => setText(starter)}>
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {notice ? <p className="mt-6 text-sm">{notice}</p> : null}
          </div>
        </div>

        <div className="mx-auto w-full max-w-3xl px-4 pb-4">
          <ChatComposer
            value={text}
            sending={sending}
            uploading={uploading}
            attached={attached}
            onChange={setText}
            onSubmit={(event) => void send(event)}
            onStop={() => abortRef.current?.abort()}
            onAttach={(file) => void attachFile(file)}
            onRemove={(id) => setAttached((current) => current.filter((file) => file.id !== id))}
          />
          <p className="px-1 pt-2 text-xs text-[var(--muted)]">Enter to send. Shift+Enter for a new line.</p>
        </div>
      </section>

      <ThreadJumper
        open={jumperOpen}
        threads={threads}
        onClose={() => setJumperOpen(false)}
        onSelect={(id) => {
          if (sending) return;
          openThread(id);
          setThreadsOpen(false);
          void refresh(id);
        }}
      />
    </div>
  );
}
