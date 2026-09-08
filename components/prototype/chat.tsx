"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  ArrowUp,
  Plus,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  Compass,
  X,
} from "lucide-react";
import {
  RELEASE,
  MAX_MESSAGE_CHARS,
  type Conversation,
  type Message,
} from "@/lib/prototype/release";
import { loadConversations, saveConversations } from "@/lib/prototype/storage";
import { removeEmDashes } from "@/lib/text";
import "./prototype.css";

const examples = [
  "I have an idea, but I don’t know where to start.",
  "Help me choose between a few directions.",
  "I’m stuck. Can we think it through?",
];
export function PrototypeChat() {
  const [chats, setChats] = useState<Conversation[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const [info, setInfo] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const request = useRef<AbortController | null>(null);
  const chat = chats.find((c) => c.id === active);
  const messages = chat?.messages || [];
  const last = messages.at(-1);
  const canRetry =
    !busy &&
    Boolean(last && (last.role === "user" || last.status === "interrupted"));

  useEffect(() => {
    if (window.matchMedia("(max-width: 600px)").matches) setSidebar(false);
    try {
      const saved = loadConversations(localStorage);
      setChats(saved);
      setActive(saved[0]?.id || null);
    } catch {
      setStorageBlocked(true);
      setStorageError(
        "Saved chats could not be read. They have not been overwritten. You can still chat here, but this session will not be saved.",
      );
    }
    setReady(true);
    return () => request.current?.abort();
  }, []);
  useEffect(() => {
    if (!ready || storageBlocked) return;
    try {
      saveConversations(localStorage, chats);
      setStorageError("");
    } catch {
      setStorageError(
        "Browser storage is unavailable or full. Recent changes may not survive a reload. Copy anything you want to keep.",
      );
    }
  }, [chats, ready, storageBlocked]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, busy]);

  useEffect(() => {
    if (!info && !deleting) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const controls = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input, textarea, [tabindex="0"]',
        ) || [],
      );
    controls()[0]?.focus();
    function trap(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setInfo(false);
        setDeleting(null);
      }
      if (event.key !== "Tab") return;
      const items = controls();
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [info, deleting]);

  function update(id: string, next: Message[]) {
    setChats((current) =>
      current.map((c) =>
        c.id === id
          ? { ...c, messages: next, updatedAt: new Date().toISOString() }
          : c,
      ),
    );
  }
  async function send(text: string, retry = false) {
    if (busy || !ready || (!text.trim() && !retry)) return;
    let base = messages;
    if (retry && base.at(-1)?.role === "assistant") base = base.slice(0, -1);
    if (!retry && canRetry) {
      setError("Retry the unfinished response, or start a new conversation.");
      return;
    }
    if (!retry)
      base = [
        ...base,
        {
          id: crypto.randomUUID(),
          role: "user",
          content: removeEmDashes(text.trim()),
        },
      ];
    const id = active || crypto.randomUUID();
    if (!active) {
      setChats((current) => [
        {
          id,
          title: base[0].content.slice(0, 64),
          messages: base,
          updatedAt: new Date().toISOString(),
        },
        ...current,
      ]);
      setActive(id);
    } else update(id, base);
    setDraft("");
    setError("");
    setBusy(true);
    const abort = new AbortController();
    request.current = abort;
    const assistant: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      release: RELEASE.id,
      status: "interrupted",
    };
    let completed = false;
    try {
      const response = await fetch("/api/prototype/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: base.map(({ role, content }) => ({ role, content })),
        }),
        signal: abort.signal,
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || "The response could not start.");
      }
      if (!response.body)
        throw new Error("Streaming is unavailable. Please retry.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      update(id, [...base, { ...assistant }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const event of events) {
          if (!event.startsWith("data: ")) continue;
          const item = JSON.parse(event.slice(6));
          if (item.type === "release") assistant.release = item.release;
          if (item.type === "token") {
            assistant.content += removeEmDashes(item.text);
            update(id, [...base, { ...assistant }]);
          }
          if (item.type === "error") throw new Error(item.error);
          if (item.type === "done") completed = true;
        }
      }
      if (!completed)
        throw new Error(
          "The connection ended before the response finished. Please retry.",
        );
      assistant.status = "complete";
      update(id, [...base, { ...assistant }]);
    } catch (cause) {
      update(id, assistant.content ? [...base, { ...assistant }] : base);
      setError(
        abort.signal.aborted
          ? "Response stopped. You can retry your question."
          : cause instanceof Error
            ? cause.message
            : "Connection failed. Please retry.",
      );
    } finally {
      request.current = null;
      setBusy(false);
    }
  }
  function newChat() {
    setActive(null);
    setDraft("");
    setError("");
    input.current?.focus();
  }
  return (
    <div className={`prototype-shell ${sidebar ? "" : "sidebar-closed"}`}>
      {sidebar && (
        <aside className="prototype-sidebar" aria-label="Conversation history">
          <div className="prototype-brand">
            <span className="brand-symbol">s</span> Selrano{" "}
            <span className="private-label">PRIVATE</span>
          </div>
          <button className="prototype-new" onClick={newChat} disabled={busy}>
            <Plus size={16} /> New conversation
          </button>
          <p className="history-label">YOUR CONVERSATIONS</p>
          <div className="prototype-history">
            {!chats.length && (
              <p className="history-empty">
                A little room for your thoughts.
                <br />
                Your conversations will live here.
              </p>
            )}
            {chats.map((c) => (
              <div
                className={`history-row ${c.id === active ? "selected" : ""}`}
                key={c.id}
              >
                <button
                  disabled={busy}
                  className="history-title"
                  onClick={() => {
                    setActive(c.id);
                    setDraft("");
                    setError("");
                  }}
                >
                  {c.title}
                </button>
                <button
                  disabled={busy}
                  className="delete-chat"
                  aria-label={`Delete ${c.title}`}
                  onClick={() => setDeleting(c.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="sidebar-bottom">
            <span className="local-dot" /> Stored in this browser only
            <button onClick={() => setInfo(true)}>About this prototype</button>
          </div>
        </aside>
      )}
      <main className="prototype-main">
        <header className="prototype-header">
          <button
            className="icon-button"
            onClick={() => setSidebar(!sidebar)}
            aria-label={sidebar ? "Hide history" : "Show history"}
          >
            {sidebar ? (
              <PanelLeftClose size={19} />
            ) : (
              <PanelLeftOpen size={19} />
            )}
          </button>
          <button className="release-badge" onClick={() => setInfo(true)}>
            Selrano 1 <span>Preview</span>
          </button>
          <span className="header-note">A little space to think.</span>
        </header>
        {storageError && (
          <div className="prototype-notice" role="alert">
            {storageError}
          </div>
        )}
        <div
          className={`prototype-scroll ${messages.length ? "" : "is-empty"}`}
        >
          {!messages.length ? (
            <section className="prototype-welcome">
              <div className="welcome-mark">
                <Compass size={27} strokeWidth={1} />
              </div>
              <p className="eyebrow">THOUGHTS DON’T HAVE TO ARRIVE FINISHED</p>
              <h1>What’s on your mind?</h1>
              <p className="welcome-copy">
                An idea, a decision, a feeling of being stuck.
                <br />
                We can start wherever you are.
              </p>
              <div className="prototype-examples">
                {examples.map((example) => (
                  <button
                    key={example}
                    disabled={!ready || busy}
                    onClick={() => {
                      setDraft(example);
                      input.current?.focus();
                    }}
                  >
                    {example}
                    <span>↗</span>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <div className="prototype-messages" aria-label="Messages">
              {messages.map((m) => (
                <article key={m.id} className={`prototype-message ${m.role}`}>
                  <div className="message-label">
                    {m.role === "user" ? "You" : "Selrano"}
                    {m.role === "assistant" && (
                      <span>
                        {m.release || "Unversioned"}
                        {m.status === "interrupted" && !busy
                          ? " · Incomplete"
                          : ""}
                      </span>
                    )}
                  </div>
                  <div className="message-content">
                    <ReactMarkdown
                      components={{
                        img: () => <span>[Image not loaded]</span>,
                        a: ({ children }) => <span>{children}</span>,
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                    {busy && m === last && !m.content && (
                      <span className="thinking-pulse">Thinking with you…</span>
                    )}
                  </div>
                </article>
              ))}
              <div ref={end} />
            </div>
          )}
        </div>
        <div className="prototype-compose-wrap">
          {error && (
            <div className="prototype-error" role="alert">
              {error}
            </div>
          )}
          {canRetry && (
            <button className="retry-button" onClick={() => send("", true)}>
              Retry last response
            </button>
          )}
          <form
            className="prototype-compose"
            onSubmit={(e) => {
              e.preventDefault();
              void send(draft);
            }}
          >
            <label className="sr-only" htmlFor="thought">
              Message Selrano
            </label>
            <textarea
              id="thought"
              ref={input}
              value={draft}
              maxLength={MAX_MESSAGE_CHARS}
              disabled={!ready || busy || canRetry}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Start with a thought. It doesn’t have to be clear yet."
              rows={2}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void send(draft);
                }
              }}
            />
            <div className="composer-actions">
              <button
                type="button"
                className="recap-button"
                disabled={!messages.length || busy || canRetry}
                onClick={() =>
                  send(
                    "Where we are: summarize our current direction, what I have decided, what remains uncertain, and one possible next step.",
                  )
                }
              >
                <Compass size={15} /> Where we are
              </button>
              <span className="character-count">
                {draft.length ? `${draft.length.toLocaleString()} / 8,000` : ""}
              </span>
              {busy ? (
                <button
                  type="button"
                  className="send-button"
                  aria-label="Stop response"
                  onClick={() => request.current?.abort()}
                >
                  <span className="stop-square" />
                </button>
              ) : (
                <button
                  className="send-button"
                  type="submit"
                  disabled={!ready || !draft.trim() || canRetry}
                  aria-label="Send message"
                >
                  <ArrowUp size={19} />
                </button>
              )}
            </div>
          </form>
          <p className="prototype-privacy">
            Only this chat is sent to Groq to respond. No cross-chat memory or
            training collection by Selrano.{" "}
            <button onClick={() => setInfo(true)}>Details</button>
          </p>
        </div>
      </main>
      {info && (
        <div className="prototype-overlay">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="release-title"
            className="prototype-dialog"
          >
            <button
              autoFocus
              className="dialog-close icon-button"
              aria-label="Close details"
              onClick={() => setInfo(false)}
            >
              <X size={18} />
            </button>
            <p className="eyebrow">THE FIRST RELEASE</p>
            <h2 id="release-title">Selrano 1</h2>
            <p>
              A thinking partner for exploring ideas and choosing a direction.
              An AI system powered by {RELEASE.model} through Groq, not a model
              trained from scratch.
            </p>
            <ul>
              {RELEASE.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <h3>Your conversations</h3>
            <p>
              Chat text is stored in this browser’s local storage, not in a
              Selrano database. Anyone with access to this browser profile may
              be able to read it. Clearing browser data removes it. Deleting a
              chat removes this local copy.
            </p>
            <p>
              When you send a message or request a recap, the active
              conversation is sent to Groq. Groq processes it under its own
              service policies. Selrano does not collect chats for training.
              There are no connected accounts, analytics, or background actions.
            </p>
            <small>System release: {RELEASE.id}</small>
          </section>
        </div>
      )}
      {deleting && (
        <div className="prototype-overlay">
          <section
            className="prototype-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <h2 id="delete-title">Delete this conversation?</h2>
            <p>
              This removes its saved copy from this browser. You cannot undo it.
            </p>
            <div className="delete-actions">
              <button autoFocus onClick={() => setDeleting(null)}>
                Keep conversation
              </button>
              <button
                onClick={() => {
                  setChats((current) =>
                    current.filter((c) => c.id !== deleting),
                  );
                  if (active === deleting) newChat();
                  setDeleting(null);
                }}
              >
                Delete conversation
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
