"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowUp, MessageSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { CopilotMessage } from "@/lib/security/types";

export function SecurityCopilot({
  scanId,
  initialMessages = [],
  sample = false,
}: {
  scanId: string;
  initialMessages?: CopilotMessage[];
  sample?: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  async function ask(text: string) {
    if (!text.trim() || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setQuestion("");
    const replyId = crypto.randomUUID();
    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), role: "user", content: text },
    ]);
    try {
      const response = await fetch(`/api/scans/${scanId}/copilot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || "Copilot is unavailable.");
      }
      if (!response.body)
        throw new Error("The response stream is unavailable.");
      setMessages((m) => [
        ...m,
        { id: replyId, role: "assistant", content: "" },
      ]);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completed = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const event of events) {
          if (!event.startsWith("data: ")) continue;
          const data = JSON.parse(event.slice(6));
          if (data.type === "token")
            setMessages((m) =>
              m.map((message) =>
                message.id === replyId
                  ? { ...message, content: message.content + data.text }
                  : message,
              ),
            );
          if (data.type === "error") {
            completed = true;
            setError(data.error);
          }
          if (data.type === "done") completed = true;
        }
      }
      if (!completed)
        throw new Error(
          "The connection ended early. Reload to recover any saved response.",
        );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not connect to Copilot.",
      );
      setQuestion(text);
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }
  return (
    <section id="copilot" className="panel scroll-mt-24 p-6">
      <div className="flex items-center gap-3">
        <MessageSquare size={19} />
        <h2 className="font-extrabold">Your security copilot</h2>
        <span className="status-pill ml-auto">AI</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        A second pair of eyes, with this report as context.
      </p>
      {sample ? (
        <div className="mt-6 rounded-2xl bg-[var(--surface-subtle)] p-5">
          <p className="text-sm leading-6 text-[var(--muted-strong)]">
            Scan your own website to ask about its findings and get help with a
            fix.
          </p>
          <Link href="/signup" className="btn-primary mt-4">
            Get started free
          </Link>
        </div>
      ) : (
        <>
          <div
            className="mt-5 max-h-[520px] space-y-6 overflow-y-auto"
            aria-live="polite"
            aria-busy={busy}
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === "user"
                    ? "rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4"
                    : "px-1"
                }
              >
                <p className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-[var(--muted)]">
                  {message.role === "user" ? "You" : "Selrano"}
                </p>
                <div className="prose prose-sm max-w-none break-words prose-pre:overflow-x-auto prose-a:text-[var(--text)]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content || "Reading your scan..."}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
          {!messages.length && (
            <div className="mt-6 space-y-2">
              {[
                "What should I fix first?",
                "Explain this scan in plain English.",
                "Help me verify my fixes after deploying.",
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => ask(prompt)}
                  disabled={busy}
                  className="block w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-left text-xs font-semibold transition-colors hover:bg-[var(--surface-subtle)]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(question);
            }}
            className="mt-6"
          >
            <label htmlFor="copilot-question" className="sr-only">
              Ask about this scan
            </label>
            <textarea
              id="copilot-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={4000}
              rows={3}
              required
              placeholder="Ask about a finding or how to fix it..."
              className="input-premium w-full !rounded-2xl px-4 py-3 text-sm"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-[11px] text-[var(--muted)]">
                Review suggested changes before deploying.
              </span>
              <button
                disabled={busy || !question.trim()}
                className="btn-primary min-h-10 px-4 text-xs disabled:opacity-40"
                aria-label="Send question"
              >
                {busy ? "Thinking..." : "Ask"}
                <ArrowUp size={15} />
              </button>
            </div>
          </form>
          {error && (
            <p
              role="alert"
              className="mt-3 text-xs leading-5 text-[var(--critical)]"
            >
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
