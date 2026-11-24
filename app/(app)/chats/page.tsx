"use client";

import type { ResearchMetadata } from "@/lib/types";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowDown, Check, Globe2, ListChecks, Mail, MoreHorizontal, NotebookPen, Pencil, Trash2, X } from "lucide-react";
import { ChatComposer, type ComposerAttachment } from "@/components/chat-composer";
import { ChatMessageBubble, type MessageVersions } from "@/components/chat-message";
import { useChatThreads } from "@/components/chat-threads";
import { ThinkingTrace } from "@/components/thinking-trace";
import { useConfirm } from "@/components/dialog";
import { useToast } from "@/components/toast";
import { takePendingMessage, STARTERS } from "@/lib/chat-handoff";
import { readChatStream } from "@/lib/chat-stream";
import { activePath, childrenIndex, deepestLeaf, effectiveParents, versionsOf } from "@/lib/chat-tree";
import { createStreamPacer, type StreamPacer } from "@/lib/stream-pacer";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { removeEmDashes } from "@/lib/text";
import { uploadWorkspaceFile } from "@/lib/upload-file";
import type { ChatMessage, Project, ToolStep } from "@/lib/types";
import { isResponseStyle, type ResponseStyleId } from "@/lib/response-styles";

/** A message plus a React key that survives the swap from streamed text to the saved row. */
type DisplayMessage = ChatMessage & { clientKey?: string };

type Handoff = { userKey?: string | null; assistantKey?: string | null };

const MAX_ATTACHMENTS = 8;

const STARTER_ICONS = { notes: NotebookPen, week: ListChecks, reply: Mail, news: Globe2 } as const;

const ACTION_LINKS: Partial<Record<string, { label: string; href: string }>> = {
  note: { label: "View", href: "/notes" },
  memory: { label: "View", href: "/memory" }
};

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
  const urlProject = searchParams.get("project");
  const { threads, refresh: refreshThreads, rename, remove } = useChatThreads();
  const toast = useToast();

  const [projects, setProjects] = useState<Project[]>([]);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  // Every saved message of the conversation, including other versions; `messages` is the branch on screen.
  const [tree, setTree] = useState<ChatMessage[]>([]);
  const [modelMetadata, setModelMetadata] = useState<{ provider: string; model: string; fallbackReason?: string } | null>(null);
  const [threadId, setThreadIdState] = useState<string | null>(urlThread);
  // The conversation id is also kept in a ref that is updated the instant it is known, so the next
  // message can never be sent with a stale id while React is still applying the state update.
  const threadIdRef = useRef<string | null>(urlThread);
  function setThreadId(id: string | null) {
    threadIdRef.current = id;
    setThreadIdState(id);
  }
  const [projectId, setProjectId] = useState(urlProject || "");
  // Read by the reply request, so a message handed over from Today uses its project at once.
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  const [text, setText] = useState("");
  // How Selrano answers; starts from the default in Settings and can change per chat.
  const [responseStyle, setResponseStyle] = useState<ResponseStyleId>("normal");
  const [depth, setDepth] = useState<"fast" | "deep">("fast");
  const depthRef = useRef<"fast" | "deep">("fast");
  depthRef.current = depth;
  // A temporary chat is not kept in the list, is never learned from, and is removed after a day.
  const [temporary, setTemporary] = useState(false);
  const temporaryRef = useRef(false);
  temporaryRef.current = temporary;
  const responseStyleRef = useRef<ResponseStyleId>("normal");
  responseStyleRef.current = responseStyle;
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingThread, setLoadingThread] = useState(Boolean(urlThread));
  // True once the first words of a reply are on screen, so the thinking mark never returns after them.
  const [replyStarted, setReplyStarted] = useState(false);
  // What Selrano is doing while it uses a tool, e.g. Searching the web.
  const [status, setStatus] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [firstName, setFirstName] = useState("");
  // The floating composer's height, so the end of the conversation can always scroll clear of it.
  const [composerHeight, setComposerHeight] = useState(120);
  const composerAreaRef = useRef<HTMLDivElement>(null);

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
  // The saved question this reply answers and when the turn began, for Stop.
  const answerTurnRef = useRef<{ questionId?: string; startedAt?: string } | null>(null);
  // Stop pressed before a new conversation had an id: it runs as soon as the id arrives.
  const pendingStopRef = useRef(false);

  const activeThread = threads.find((thread) => thread.id === threadId) || null;
  const lastSavedId = useRef<string | null>(null);
  lastSavedId.current = [...messages].reverse().find((item) => !["pending-user", "streaming", "error"].includes(item.id))?.id || null;
  const hasMessages = messages.length > 0;

  const loadMessages = useCallback(async (id: string | null, handoff?: Handoff) => {
    const view = viewRef.current;
    if (!id) {
      setMessages([]);
      setTree([]);
      setLoadingThread(false);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    const [{ data }, { data: thread }] = await Promise.all([
      supabase.from("chat_messages").select("*").eq("thread_id", id).order("created_at", { ascending: true }),
      supabase.from("chat_threads").select("active_leaf_id").eq("id", id).maybeSingle()
    ]);
    if (viewRef.current !== view) return;
    const rows = (data as ChatMessage[]) || [];
    setTree(rows);
    setMessages(withHandoffKeys(activePath(rows, (thread as { active_leaf_id?: string | null } | null)?.active_leaf_id), handoff));
    setLoadingThread(false);
  }, []);

  // Version arrows for each message on screen that has siblings.
  const versionInfo = (() => {
    const parents = effectiveParents(tree);
    const index = childrenIndex(tree, parents);
    const byId = new Map(tree.map((row) => [row.id, row]));
    return (message: DisplayMessage): MessageVersions | null => {
      const saved = byId.get(message.id);
      if (!saved) return null;
      const { ids, position } = versionsOf(tree, saved, parents, index);
      if (ids.length < 2) return null;
      return { position, total: ids.length, onShow: (next) => void showVersion(ids[next], index) };
    };
  })();

  /** Shows another version of a message, and the newest conversation that follows it. */
  async function showVersion(id: string, index: ReturnType<typeof childrenIndex<ChatMessage>>) {
    if (busyRef.current || !threadIdRef.current) return;
    const leaf = deepestLeaf(tree, id, index);
    setMessages(activePath(tree, leaf));
    const supabase = createSupabaseBrowserClient();
    await supabase.from("chat_threads").update({ active_leaf_id: leaf }).eq("id", threadIdRef.current);
  }

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase
      .from("projects")
      .select("*")
      .order("name")
      .then(({ data }) => setProjects((data as Project[]) || []));
    void supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      const name = String(profile?.full_name || user.user_metadata?.full_name || "").trim();
      if (isResponseStyle(profile?.response_style)) setResponseStyle(profile.response_style);
      setFirstName(name.split(/\s+/)[0] || "");
    });
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
    setTree([]);
    stickRef.current = true;
    setAtBottom(true);
    if (urlThread) {
      setLoadingThread(true);
      void loadMessages(urlThread);
    } else {
      setLoadingThread(false);
      setProjectId(urlProject || "");
      setTemporary(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlThread]);

  useEffect(() => {
    if (activeThread) setProjectId(activeThread.project_id || "");
  }, [activeThread]);

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

  const hasConversation = messages.length > 0 || loadingThread;
  useEffect(() => {
    const area = composerAreaRef.current;
    if (!area || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setComposerHeight(Math.ceil(entry.contentRect.height)));
    observer.observe(area);
    return () => observer.disconnect();
  }, [hasConversation]);

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
    options: { message?: string; editMessageId?: string; regenerateMessageId?: string; fileIds?: string[] },
    userKey: string | null = null,
    sentAttachments: ComposerAttachment[] = []
  ) {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      await runReply(options, userKey, sentAttachments);
    } finally {
      busyRef.current = false;
    }
  }

  async function runReply(
    options: { message?: string; editMessageId?: string; regenerateMessageId?: string; fileIds?: string[] },
    userKey: string | null,
    sentAttachments: ComposerAttachment[]
  ) {
    setLoading(true);
    pendingStopRef.current = false;
    answerTurnRef.current = null;
    const liveSteps: ToolStep[] = [];
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
        if (sentAttachments.length) setAttachments((existing) => (existing.length ? existing : sentAttachments));
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
          threadId: threadIdRef.current,
          projectId: projectIdRef.current || null,
          // The new message follows the last saved message on screen (the version showing).
          parentId: lastSavedId.current,
          style: responseStyleRef.current,
          depth: depthRef.current,
          temporary: !threadIdRef.current && temporaryRef.current
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
          answerTurnRef.current = { questionId: event.questionId, startedAt: event.startedAt };
          if (pendingStopRef.current) {
            pendingStopRef.current = false;
            stop();
          }
        } else if (event.type === "status") {
          setStatus(event.label);
          if (event.label && liveSteps[liveSteps.length - 1]?.label !== event.label) {
            liveSteps.push({ label: event.label });
            const trail = { steps: [...liveSteps] };
            setMessages((existing) => existing.map((item) => (item.id === "streaming" ? { ...item, tool_trace: trail } : item)));
          }
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
              { id: "streaming", research: researchMetadata, citations: researchMetadata?.sources, tool_trace: liveSteps.length ? { steps: [...liveSteps] } : null, clientKey: assistantKey, thread_id: streamThreadId || "pending", user_id: "", role: "assistant", content: "", created_at: new Date().toISOString() }
            ]);
          }
          pacer.push(event.text);
        } else if (event.type === "suggestions") {
          setMessages((existing) => existing.map((item) => (item.id === "streaming" ? { ...item, suggestions: event.suggestions } : item)));
        } else if (event.type === "model") {
          setModelMetadata(event);
        } else if (event.type === "action") {
          toast({ title: event.label, action: ACTION_LINKS[event.kind] });
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
    if (!answerTurnRef.current?.questionId) {
      // The question is not saved yet; keep listening until it is, then stop.
      pendingStopRef.current = true;
      return;
    }
    const turn = answerTurnRef.current;
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
          body: JSON.stringify({ threadId: id, content: partial, questionId: turn.questionId, startedAt: turn.startedAt })
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
    if (attachments.some((item) => item.status === "uploading" || item.status === "processing")) return;
    await sendPrompt(text, attachments.filter((item) => item.status === "ready" && item.fileId));
  }

  async function sendPrompt(raw: string, ready: ComposerAttachment[] = []) {
    const prompt = removeEmDashes(raw).trim();
    if (!prompt || busyRef.current) return;
    setText("");
    setAttachments([]);
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
        citations: ready.map((item, index) => ({
          kind: "file" as const,
          marker: `attachment-${index + 1}`,
          fileId: item.fileId!,
          fileName: item.name,
          pageNumber: null,
          charStart: null,
          charEnd: null
        })),
        created_at: new Date().toISOString()
      }
    ]);
    await requestReply({ message: prompt, fileIds: ready.map((item) => item.fileId!) }, userKey, ready);
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

  function attach(files: File[]) {
    const room = MAX_ATTACHMENTS - attachments.length;
    for (const file of files.slice(0, Math.max(room, 0))) {
      const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`;
      const patch = (update: Partial<ComposerAttachment>) =>
        setAttachments((existing) => existing.map((item) => (item.key === key ? { ...item, ...update } : item)));
      setAttachments((existing) => [...existing, { key, name: file.name, status: "uploading", progress: 0 }]);
      // Attached files are saved to the workspace (in this chat's project), so they can be found again later.
      uploadWorkspaceFile(file, {
        projectId: projectId || null,
        onProgress: (progress) => patch({ progress }),
        onProcessing: () => patch({ status: "processing" })
      })
        .then((saved) => patch({ status: "ready", fileId: saved.id }))
        .catch((error: unknown) => patch({ status: "failed", error: error instanceof Error ? error.message : "Upload failed." }));
    }
  }

  // A message started on Today (or a starter there) is sent once, as a new conversation.
  useEffect(() => {
    if (threadIdRef.current) return;
    const pending = takePendingMessage();
    if (!pending) return;
    if (pending.projectId) {
      projectIdRef.current = pending.projectId;
      setProjectId(pending.projectId);
    }
    void sendPrompt(pending.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function deleteCurrent() {
    if (!threadId) return;
    const failure = await remove(threadId);
    if (failure) {
      toast({ title: "Could not delete the chat", description: failure, tone: "error" });
    } else {
      toast({ title: "Chat deleted" });
      router.push("/chats");
    }
    return failure;
  }

  async function renameCurrent(title: string) {
    if (!threadId) return null;
    const failure = await rename(threadId, title);
    if (!failure) toast({ title: "Chat renamed" });
    return failure;
  }

  const empty = !messages.length && !loadingThread;

  const composer = (
    <form onSubmit={send} className="mx-auto w-full max-w-[46rem]">
      <ChatComposer
        value={text}
        busy={loading}
        onChange={setText}
        onStop={stop}
        attachments={attachments}
        onAttach={attach}
        onRemoveAttachment={(key) => setAttachments((existing) => existing.filter((item) => item.key !== key))}
        projects={projects}
        projectId={projectId}
        onProjectChange={setProjectId}
        projectLocked={Boolean(threadId)}
        maxAttachments={MAX_ATTACHMENTS}
        responseStyle={responseStyle}
        onResponseStyleChange={setResponseStyle}
        depth={depth}
        onDepthChange={setDepth}
      />
    </form>
  );

  return (
    <section className="chat-page relative" aria-busy={loading} data-ai-provider={modelMetadata?.provider} data-ai-model={modelMetadata?.model} data-ai-fallback={modelMetadata?.fallbackReason}>
      {/* The conversation fills the whole height and scrolls under the floating title bar and composer. */}
      <div className="chat-overlay-top">
        <ChatHeader
          title={threadId ? removeEmDashes(activeThread?.title || "") || "Conversation" : "New chat"}
          canManage={Boolean(threadId && activeThread)}
          temporary={threadId ? Boolean(activeThread?.temporary) || temporary : temporary}
          onTemporaryChange={threadId ? undefined : setTemporary}
          onRename={renameCurrent}
          onDelete={deleteCurrent}
        />
      </div>

      <div ref={listRef} onScroll={onListScroll} className="chat-scroll min-h-0 flex-1 overflow-y-auto">
        {empty ? (
          <div className="mx-auto flex h-full w-full max-w-[46rem] flex-col justify-center px-4 pb-16 pt-10 sm:px-6">
            <motion.h1
              className="title-display text-center text-[34px] sm:text-[42px]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
            >
              {greeting(firstName)}
            </motion.h1>
            <motion.div className="mt-8" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.06, ease: [0.2, 0.7, 0.2, 1] }}>
              {composer}
            </motion.div>
            <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
              {STARTERS.map((starter, index) => {
                const Icon = STARTER_ICONS[starter.id];
                return (
                  <motion.button
                    key={starter.title}
                    type="button"
                    className="starter-card"
                    title={starter.prompt}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.12 + index * 0.04 }}
                    onClick={() => void sendPrompt(starter.prompt)}
                  >
                    <Icon size={15} className="shrink-0 text-[var(--accent)]" aria-hidden="true" />
                    {starter.title}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ) : (
          <div ref={contentRef} className="mx-auto w-full max-w-[46rem] space-y-6 px-4 pt-16 sm:px-6" style={{ paddingBottom: composerHeight + 32 }}>
            {messages.map((message, index) => (
              <motion.div
                key={message.clientKey ?? message.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, ease: [0.2, 0.7, 0.2, 1] }}
              >
                <ChatMessageBubble message={message} busy={loading} onEdit={editAndResend} onRegenerate={regenerate} versions={versionInfo(message)} onSuggestion={index === messages.length - 1 ? (suggestion) => void sendPrompt(suggestion) : undefined} />
              </motion.div>
            ))}
            {loading && !replyStarted ? <ThinkingTrace label={status} /> : null}
          </div>
        )}
      </div>

      {empty ? null : (
        <div ref={composerAreaRef} className="chat-overlay-bottom px-3 pb-3 sm:px-6 sm:pb-5">
          {!atBottom ? (
            <button type="button" onClick={jumpToLatest} className="jump-button" aria-label="Jump to latest">
              <ArrowDown size={17} />
            </button>
          ) : null}
          {composer}
        </div>
      )}
    </section>
  );
}

function greeting(name: string) {
  const hour = new Date().getHours();
  const part = hour < 5 ? "Still up" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name}.` : `${part}.`;
}

function ChatHeader({
  title,
  canManage,
  onRename,
  onDelete,
  temporary,
  onTemporaryChange
}: {
  title: string;
  canManage: boolean;
  temporary: boolean;
  /** Only a new chat can be made temporary. */
  onTemporaryChange?: (temporary: boolean) => void;
  onRename: (title: string) => Promise<string | null>;
  onDelete: () => Promise<string | null | undefined>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const confirm = useConfirm();
  const [draft, setDraft] = useState(title);
  const [error, setError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
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
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold">
          {title}
          {temporary ? <span className="ml-2 text-[13px] font-normal text-[var(--muted)]">Temporary, not saved to your chats</span> : null}
        </h2>
      )}
      {onTemporaryChange ? (
        <button
          type="button"
          className={`chip-button text-[13px] ${temporary ? "text-[var(--accent)]" : "text-[var(--muted-strong)]"}`}
          aria-pressed={temporary}
          onClick={() => onTemporaryChange(!temporary)}
          title="A temporary chat is not kept in your list, is never used to learn about you, and is removed after a day"
        >
          Temporary chat
        </button>
      ) : null}
      {error ? <p className="text-xs font-semibold text-[var(--critical)]">{error}</p> : null}
      {canManage && !renaming ? (
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            className="icon-button"
            aria-label="Conversation options"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
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
              <button
                type="button"
                role="menuitem"
                className="menu-item text-[var(--critical)]"
                onClick={async () => {
                  setMenuOpen(false);
                  const ok = await confirm({
                    title: "Delete this chat?",
                    description: `"${title}" and its messages will be removed. This cannot be undone.`,
                    confirmLabel: "Delete",
                    destructive: true
                  });
                  if (ok) await onDelete();
                }}
              >
                <Trash2 size={15} />
                Delete
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
