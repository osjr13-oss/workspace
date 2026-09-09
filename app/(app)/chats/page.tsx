"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ChatComposer, type AttachedFileItem } from "@/components/chat-composer";
import { ChatMessageBubble } from "@/components/chat-message";
import { ThinkingTrace } from "@/components/thinking-trace";
import { WorkspaceHeader } from "@/components/workspace-header";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ModelSelector } from "@/components/model-selector";
import { formatRelative } from "@/lib/format";
import { removeEmDashes } from "@/lib/text";
import { uploadWorkspaceFile } from "@/lib/file-upload";
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
  const [attachedFiles, setAttachedFiles] = useState<AttachedFileItem[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [fileUploadError, setFileUploadError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  async function attachFile(file: File) {
    setUploadingFile(true);
    setFileUploadError("");
    try {
      const uploaded = await uploadWorkspaceFile(file, { projectId: projectId || null });
      setAttachedFiles((current) => [...current, uploaded]);
    } catch (err) {
      setFileUploadError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploadingFile(false);
    }
  }

  function removeAttachedFile(fileId: string) {
    setAttachedFiles((current) => current.filter((f) => f.id !== fileId));
  }

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
  }, [messages]);

  async function requestReply(options: {
    message?: string;
    editMessageId?: string;
    regenerateMessageId?: string;
    fileIds?: string[];
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
    if (!prompt && attachedFiles.length === 0) return;

    const filesToSend = [...attachedFiles];
    const fileIds = filesToSend.map((f) => f.id);
    const fileNames = filesToSend.map((f) => f.name).join(", ");
    const fullUserPrompt = filesToSend.length > 0
      ? (prompt ? `[Attached: ${fileNames}]\n\n${prompt}` : `[Attached: ${fileNames}]\nPlease review and analyze the attached document.`)
      : prompt;

    setText("");
    setAttachedFiles([]);
    setMessages((current) => [
      ...current,
      {
        id: "pending-user",
        thread_id: threadId || "pending",
        user_id: "",
        role: "user",
        content: fullUserPrompt,
        created_at: new Date().toISOString()
      }
    ]);
    await requestReply({ message: fullUserPrompt, fileIds });
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
        <WorkspaceHeader title="Chats" eyebrow="Thinking space" />
        <button type="button" onClick={() => { setThreadId(null); setMessages([]); }} className="btn-primary mt-5">
          New thought
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
                className={`w-full rounded-2xl p-4 pr-12 text-left transition ${
                  threadId === thread.id
                    ? "bg-white border border-[var(--border)] shadow-xs"
                    : "hover:bg-[var(--surface-subtle)]"
                }`}
              >
                <p className="truncate font-bold text-sm text-[var(--text)]">{removeEmDashes(thread.title)}</p>
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
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-6 py-3.5 bg-white">
          <div className="flex items-center gap-3">
            <ModelSelector />
            {projectId ? (
              <span className="hidden sm:inline text-xs text-neutral-400">
                Project context connected
              </span>
            ) : null}
          </div>
          {threadId ? (
            <button
              type="button"
              onClick={() => deleteThread(threadId)}
              disabled={deletingThreadId === threadId}
              title="Delete conversation"
              className="text-neutral-400 hover:text-red-600 transition p-1.5 rounded-lg"
            >
              <Trash2 size={15} />
            </button>
          ) : null}
        </div>
        <div ref={listRef} className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-8 lg:px-10 bg-white">
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
            <div className="grid h-full place-items-center">
              <div className="w-full max-w-2xl px-4 py-8">
                <div className="text-center mb-7">
                  <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-neutral-900">
                    {"What's on your mind today?"}
                  </h1>
                </div>

                <ChatComposer
                  value={text}
                  disabled={loading}
                  onChange={setText}
                  onSubmit={send}
                  hasMessages={false}
                  modelSelector={<ModelSelector />}
                  projects={projects}
                  projectId={projectId}
                  onSelectProject={setProjectId}
                  placeholder="Ask anything or start with an unformed thought..."
                  attachedFiles={attachedFiles}
                  onAttachFile={attachFile}
                  onRemoveAttachedFile={removeAttachedFile}
                  isUploadingFile={uploadingFile}
                />
                {fileUploadError ? (
                  <p className="mt-2 text-center text-xs font-semibold text-red-600">
                    {fileUploadError}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {[
                    "Explore an idea",
                    "Weigh trade-offs",
                    "Unblock a problem",
                    "Pressure-test a plan"
                  ].map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        const promptMap: Record<string, string> = {
                          "Explore an idea": "I have an idea, but I don't know where to start.",
                          "Weigh trade-offs": "Help me choose between two different directions.",
                          "Unblock a problem": "I am stuck on this problem. Can we break it down?",
                          "Pressure-test a plan": "I have a plan, but I need to poke holes in its assumptions."
                        };
                        setText(promptMap[label] || label);
                      }}
                      className="rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-xs font-medium text-neutral-600 hover:border-neutral-400 hover:text-neutral-900 transition shadow-2xs"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {loading && !messages.some((message) => message.id === "streaming" && message.content.trim()) ? <ThinkingTrace /> : null}
        </div>
        {messages.length > 0 ? (
          <div className="border-t border-neutral-200 p-4 bg-white">
            <div className="mx-auto max-w-3xl">
              <ChatComposer
                value={text}
                disabled={loading}
                onChange={setText}
                onSubmit={send}
                hasMessages={true}
                modelSelector={<ModelSelector />}
                projects={projects}
                projectId={projectId}
                onSelectProject={setProjectId}
                attachedFiles={attachedFiles}
                onAttachFile={attachFile}
                onRemoveAttachedFile={removeAttachedFile}
                isUploadingFile={uploadingFile}
                onRecap={() =>
                  requestReply({
                    message:
                      "Where we are: summarize our current direction, what I have decided, what remains uncertain, and one possible next step."
                  })
                }
              />
              {fileUploadError ? (
                <p className="mt-2 text-xs font-semibold text-red-600">
                  {fileUploadError}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
