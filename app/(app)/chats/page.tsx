"use client";

import type { ResearchMetadata } from "@/lib/types";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, Check, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import { ChatComposer } from "@/components/chat-composer";
import { ChatMessageBubble } from "@/components/chat-message";
import { useChatThreads } from "@/components/chat-threads";
import { ThinkingTrace } from "@/components/thinking-trace";
import { readChatStream } from "@/lib/chat-stream";
import { createStreamPacer, type StreamPacer } from "@/lib/stream-pacer";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { removeEmDashes } from "@/lib/text";
import type { ChatMessage } from "@/lib/types";

/** A message plus a React key that survives the swap from streamed text to the saved row. */
type DisplayMessage = ChatMessage & { clientKey?: string };

type Handoff = { userKey?: string | null; assistantKey?: string | null };

const STARTERS = [
  { title: "Plan my day of eating", prompt: "Help me plan simple meals for today that keep me full and support losing weight." },
  { title: "High-protein ideas", prompt: "Give me a few quick high-protein breakfast and lunch ideas." },
  { title: "Eating out", prompt: "I'm eating out tonight. How do I choose something that fits my goals without overthinking it?" },
  { title: "Beat evening snacking", prompt: "I keep snacking at night. What can I try this week?" }
];

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlThread = searchParams.get("thread");
  const { threads, refresh: refreshThreads, rename, remove } = useChatThreads();

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [modelMetadata, setModelMetadata] = useState<{ provider: string; model: string; fallbackReason?: string } | null>(null);
  const [threadId, setThreadIdState] = useState<string | null>(urlThread);
  // The conversation id is also kept in a ref that is updated the instant it is known, so the next
  // message can never be sent with a stale id while React is still applying the state update.
  const threadIdRef = useRef<string | null>(urlThread);
  function setThreadId(id: string | null) {
    threadIdRef.current = id;
    setThreadIdState(id);
  }
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingThread, setLoadingThread] = useState(Boolean(urlThread));
  // True once the first words of a reply are on screen, so the thinking mark never returns after them.
  const [replyStarted, setReplyStarted] = useState(false);
  // What Selrano is doing while it uses a tool, e.g. Searching the web.
  const [status, setStatus] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);

  const listRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const turnRef = useRef(0);
  // Bumped whenever another conversation is opened, so a reply still arriving for the old one is ignored.
  const viewRef = useRef(0);
  // Only one reply can be in flight. Enter in the text box submits even while busy, so this is checked synchronously.
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  // Paces the reply on screen; it also knows exactly which words the reader has seen (for Stop).
  const pacerRef = useRef<StreamPacer | null>(null);
  const turnKeysRef = useRef<Handoff>({});
  const stopRef = useRef<Promise<void> | null>(null);

  const activeThread = threads.find((thread) => thread.id === threadId) || null;
  const hasMessages = messages.length > 0;

  const loadMessages = useCallback(async (id: string | null, handoff?: Handoff) => {
    const view = viewRef.current;
    if (!id) {
      setMessages([]);
      setLoadingThread(false);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.from("chat_messages").select("*").eq("thread_id", id).order("created_at", { ascending: true });
    if (viewRef.current !== view) return;
    setMessages(withHandoffKeys((data as ChatMessage[]) || [], handoff));
    setLoadingThread(false);
  }, []);

  useEffect(() => {
    if (threadIdRef.current) void loadMessages(threadIdRef.current);
  }, [loadMessages]);

  // The address changed from outside this page: a sidebar link, New chat, or the back button.
  useEffect(() => {
    if (urlThread === threadIdRef.current) return;
    viewRef.current += 1;
    // A reply still arriving for the conversation being left keeps running on the
    // server and is saved there; this page just stops listening to it.
    abortRef.current?.abort();
    abortRef.current = null;
    pacerRef.current?.cancel();
    pacerRef.current = null;
    busyRef.current = false;
    setLoading(false);
    setReplyStarted(false);
    setStatus(null);
    setThreadId(urlThread);
    setMessages([]);
    stickRef.current = true;
    setAtBottom(true);
    if (urlThread) {
      setLoadingThread(true);
      void loadMessages(urlThread);
    } else {
      setLoadingThread(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlThread]);

  // Follow the newest words only while the reader is already at the bottom. The jump is
  // instant: a smooth scroll reports in-between positions, which would read as the reader
  // scrolling away.
  useEffect(() => {
    const list = listRef.current;
    if (list && stickRef.current) list.scrollTop = list.scrollHeight;
  }, [messages, status, loading]);

  // Content can also grow after it renders (code highlighting, wrapped tables).
  useEffect(() => {
    const list = listRef.current;
    const content = contentRef.current;
    if (!list || !content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (stickRef.current) list.scrollTop = list.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [hasMessages]);

  function onListScroll() {
    const list = listRef.current;
    if (!list) return;
    const bottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    stickRef.current = bottom;
    setAtBottom(bottom);
  }

  function jumpToLatest() {
    stickRef.current = true;
    setAtBottom(true);
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }

  function showThread(id: string | null) {
    const url = id ? `/chats?thread=${id}` : "/chats";
    // Updates the address without a navigation, so the page keeps its state.
    window.history.replaceState(null, "", url);
  }

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
    setModelMetadata(null);
    setReplyStarted(false);
    setStatus(null);
    stickRef.current = true;
    setAtBottom(true);
    turnRef.current += 1;
    const assistantKey = `streaming-${turnRef.current}`;
    turnKeysRef.current = { userKey, assistantKey };
    const view = viewRef.current;
    const current = () => viewRef.current === view;
    // Words are revealed at a steady pace instead of in the bursts they arrive in.
    const pacer = createStreamPacer((visible) => {
      if (!current()) return;
      if (visible.trim()) setReplyStarted(true);
      setMessages((existing) => existing.map((item) => (item.id === "streaming" ? { ...item, content: visible } : item)));
    });
    pacerRef.current = pacer;
    const controller = new AbortController();
    abortRef.current = controller;
    const canRestoreText = !options.editMessageId && !options.regenerateMessageId;
    const startingThreadId = threadIdRef.current;
    let streamThreadId: string | null = startingThreadId;
    let researchMetadata: ResearchMetadata | null = null;
    let bubbleAdded = false;
    let failed = false;

    // A reply that could not be produced leaves nothing behind on the server, so
    // the user's own message is taken off the screen and put back in the box.
    const fail = (message: string, restore: boolean) => {
      failed = true;
      pacer.cancel();
      setMessages((existing) => [
        ...existing.filter((item) => item.id !== "pending-user" && item.id !== "streaming"),
        { id: "error", thread_id: threadIdRef.current || "pending", user_id: "", role: "assistant", content: message, created_at: new Date().toISOString() }
      ]);
      if (restore && canRestoreText && options.message) {
        setText((existing) => existing || options.message || "");
      }
      setReplyStarted(false);
      setStatus(null);
      setLoading(false);
    };

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          ...options,
          threadId: threadIdRef.current
        })
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        if (current()) fail(payload.error || "Chat failed.", true);
        return;
      }

      await readChatStream(response.body, (event) => {
        if (!current()) return;
        if (event.type === "start") {
          streamThreadId = event.threadId;
          if (event.threadId !== threadIdRef.current) {
            setThreadId(event.threadId);
            showThread(event.threadId);
            void refreshThreads();
          }
        } else if (event.type === "status") {
          setStatus(event.label);
        } else if (event.type === "research") {
          researchMetadata = event.research;
          setMessages((existing) => existing.map((item) => item.id === "streaming" ? { ...item, research: researchMetadata, citations: researchMetadata?.sources } : item));
        } else if (event.type === "text") {
          if (!bubbleAdded) {
            bubbleAdded = true;
            setStatus(null);
            // Reply fills into an assistant bubble as words arrive.
            setMessages((existing) => [
              ...existing,
              { id: "streaming", research: researchMetadata, citations: researchMetadata?.sources, clientKey: assistantKey, thread_id: streamThreadId || "pending", user_id: "", role: "assistant", content: "", created_at: new Date().toISOString() }
            ]);
          }
          pacer.push(event.text);
        } else if (event.type === "model") {
          setModelMetadata(event);
        } else if (event.type === "error") {
          fail(event.error, event.restore);
        }
      });
      if (!current()) return;

      if (failed) {
        // The server removed a conversation that this turn had just created.
        if (streamThreadId && streamThreadId !== startingThreadId) {
          setThreadId(startingThreadId);
          showThread(startingThreadId);
          void refreshThreads();
        }
        return;
      }

      // Let the last words finish appearing, then the saved rows take over the same
      // on-screen elements, so nothing flickers.
      await pacer.finish();
      if (!current() || stopRef.current) return;
      await loadMessages(streamThreadId, { userKey, assistantKey });
      setReplyStarted(false);
      setStatus(null);
      setLoading(false);
      void refreshThreads();
    } catch (error) {
      pacer.cancel();
      // Stop finishes the turn itself; wait for it so the next message cannot overtake it.
      if (stopRef.current) {
        await stopRef.current;
        return;
      }
      // Another conversation was opened; this reply is saved on the server.
      if (controller.signal.aborted || !current()) return;
      console.error("[chat] request failed", error);
      if (bubbleAdded) {
        // The connection dropped mid-reply. The server finishes and saves the answer,
        // so keep what has arrived and then show the saved copy.
        setReplyStarted(false);
        setStatus(null);
        setLoading(false);
        window.setTimeout(() => void loadMessages(streamThreadId, { userKey, assistantKey }), 2500);
        return;
      }
      fail("Network error. Please try again.", true);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (pacerRef.current === pacer) pacerRef.current = null;
    }
  }

  /** Stop: keep the words already on screen as the reply, and save exactly those. */
  function stop() {
    const controller = abortRef.current;
    if (!controller || stopRef.current) return;
    // Exactly the words the reader has seen, not what had arrived but was not shown yet.
    const partial = pacerRef.current?.shown() ?? "";
    pacerRef.current?.cancel();
    const id = threadIdRef.current;
    const keys = turnKeysRef.current;
    const finish = async () => {
      setStatus(null);
      setMessages((existing) =>
        existing.some((item) => item.id === "streaming")
          ? existing.map((item) => (item.id === "streaming" ? { ...item, content: partial } : item))
          : existing
      );
      if (id) {
        await fetch("/api/ai/chat/stop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId: id, content: partial })
        }).catch(() => undefined);
        await loadMessages(id, keys);
        void refreshThreads();
      }
      setReplyStarted(false);
      setLoading(false);
    };
    stopRef.current = finish().finally(() => {
      stopRef.current = null;
    });
    controller.abort();
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const prompt = removeEmDashes(text).trim();
    if (!prompt || busyRef.current) return;
    setText("");
    const userKey = `pending-user-${turnRef.current + 1}`;
    setMessages((existing) => [
      ...existing.filter((item) => item.id !== "error"),
      {
        id: "pending-user",
        clientKey: userKey,
        thread_id: threadIdRef.current || "pending",
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
    setMessages((existing) => {
      const index = existing.findIndex((item) => item.id === messageId);
      if (index === -1) return existing;
      return existing
        .slice(0, index + 1)
        .map((item) => (item.id === messageId ? { ...item, content: removeEmDashes(content) } : item));
    });
    await requestReply({ message: removeEmDashes(content), editMessageId: messageId });
  }

  async function regenerate(messageId: string) {
    if (busyRef.current) return;
    setMessages((existing) => {
      const index = existing.findIndex((item) => item.id === messageId);
      return index === -1 ? existing : existing.slice(0, index);
    });
    await requestReply({ regenerateMessageId: messageId });
  }

  async function deleteCurrent() {
    if (!threadId) return;
    const failure = await remove(threadId);
    if (!failure) router.push("/chats");
    return failure;
  }

  const empty = !messages.length && !loadingThread;

  return (
    <section className="chat-page" aria-busy={loading} data-ai-provider={modelMetadata?.provider} data-ai-model={modelMetadata?.model} data-ai-fallback={modelMetadata?.fallbackReason}>
      <ChatHeader
        title={threadId ? removeEmDashes(activeThread?.title || "") || "Conversation" : "New chat"}
        canManage={Boolean(threadId && activeThread)}
        onRename={(title) => (threadId ? rename(threadId, title) : Promise.resolve(null))}
        onDelete={deleteCurrent}
      />

      <div ref={listRef} onScroll={onListScroll} className="min-h-0 flex-1 overflow-y-auto">
        {empty ? (
          <div className="mx-auto flex h-full w-full max-w-[46rem] flex-col justify-center px-4 py-10 sm:px-6">
            <h1 className="text-[28px] font-extrabold tracking-[-0.03em] sm:text-[32px]">What&apos;s on your plate?</h1>
            <p className="mt-2 max-w-md text-[15px] leading-6 text-[var(--muted-strong)]">
              Ask about meals, cravings, workouts, or how the week is going. Your coach keeps the context.
            </p>
            <div className="mt-7 grid gap-2 sm:grid-cols-2">
              {STARTERS.map((starter) => (
                <button
                  key={starter.title}
                  type="button"
                  className="starter-card"
                  onClick={() => {
                    setText(starter.prompt);
                    requestAnimationFrame(() => (document.querySelector('[aria-label="Chat message"]') as HTMLTextAreaElement | null)?.focus());
                  }}
                >
                  <span className="text-sm font-bold">{starter.title}</span>
                  <span className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-[var(--muted)]">{starter.prompt}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div ref={contentRef} className="mx-auto w-full max-w-[46rem] space-y-6 px-4 pb-10 pt-6 sm:px-6">
            {messages.map((message) => (
              <ChatMessageBubble
                key={message.clientKey ?? message.id}
                message={message}
                busy={loading}
                onEdit={editAndResend}
                onRegenerate={regenerate}
              />
            ))}
            {loading && !replyStarted ? (
              status ? (
                <div className="tool-status" role="status" aria-live="polite">
                  <span className="tool-status-dot" aria-hidden="true" />
                  {status}
                </div>
              ) : (
                <ThinkingTrace />
              )
            ) : null}
          </div>
        )}
      </div>

      <div className="relative px-3 pb-3 sm:px-6 sm:pb-5">
        {!atBottom && !empty ? (
          <button type="button" onClick={jumpToLatest} className="jump-button" aria-label="Jump to latest">
            <ArrowDown size={17} />
          </button>
        ) : null}
        <form onSubmit={send} className="mx-auto w-full max-w-[46rem]">
          <ChatComposer
            value={text}
            busy={loading}
            onChange={setText}
            onStop={stop}
          />
        </form>
      </div>
    </section>
  );
}

function ChatHeader({
  title,
  canManage,
  onRename,
  onDelete
}: {
  title: string;
  canManage: boolean;
  onRename: (title: string) => Promise<string | null>;
  onDelete: () => Promise<string | null | undefined>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(title);
  const [error, setError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
        setConfirmingDelete(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setConfirmingDelete(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function saveTitle() {
    const failure = await onRename(draft);
    if (failure) {
      setError(failure);
      return;
    }
    setError("");
    setRenaming(false);
  }

  return (
    <header className="chat-header">
      {renaming ? (
        <form
          className="flex min-w-0 flex-1 items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            void saveTitle();
          }}
        >
          <input
            aria-label="Conversation title"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setRenaming(false);
            }}
            className="min-h-9 min-w-0 flex-1 rounded-xl border border-[var(--border-strong)] bg-[var(--background-elevated)] px-3 text-sm font-semibold outline-none"
            autoFocus
          />
          <button type="submit" className="icon-button" aria-label="Save title">
            <Check size={17} />
          </button>
          <button type="button" className="icon-button" aria-label="Cancel renaming" onClick={() => setRenaming(false)}>
            <X size={17} />
          </button>
        </form>
      ) : (
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-bold">{title}</h2>
      )}
      {error ? <p className="text-xs font-bold text-[var(--critical)]">{error}</p> : null}
      {canManage && !renaming ? (
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            className="icon-button"
            aria-label="Conversation options"
            aria-expanded={menuOpen}
            onClick={() => {
              setMenuOpen((open) => !open);
              setConfirmingDelete(false);
            }}
          >
            <MoreHorizontal size={18} />
          </button>
          {menuOpen ? (
            <div className="menu-popover" role="menu">
              <button
                type="button"
                role="menuitem"
                className="menu-item"
                onClick={() => {
                  setDraft(title);
                  setRenaming(true);
                  setMenuOpen(false);
                }}
              >
                <Pencil size={15} />
                Rename
              </button>
              {confirmingDelete ? (
                <button
                  type="button"
                  role="menuitem"
                  className="menu-item text-[var(--critical)]"
                  onClick={async () => {
                    const failure = await onDelete();
                    if (failure) setError(failure);
                    setMenuOpen(false);
                    setConfirmingDelete(false);
                  }}
                >
                  <Trash2 size={15} />
                  Confirm delete
                </button>
              ) : (
                <button type="button" role="menuitem" className="menu-item text-[var(--critical)]" onClick={() => setConfirmingDelete(true)}>
                  <Trash2 size={15} />
                  Delete
                </button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
