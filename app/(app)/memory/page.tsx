"use client";

import { useEffect, useMemo, useState } from "react";
import { Brain, Check, Pencil, Pin, PinOff, Plus, Trash2, X } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { WorkspaceHeader } from "@/components/workspace-header";
import { formatRelative } from "@/lib/format";

type Memory = {
  id: string;
  content: string;
  pinned?: boolean | null;
  source?: "chat" | "manual" | "history" | null;
  created_at: string;
  updated_at?: string | null;
};

function sourceLabel(memory: Memory) {
  const when = formatRelative(memory.updated_at || memory.created_at);
  if (memory.source === "manual") return `Added by you, ${when}`;
  if (memory.source === "history") return `Learned from earlier chats, ${when}`;
  return `Learned from a chat, ${when}`;
}

export default function MemoryPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    setFocusId(window.location.hash.slice(1) || null);
    fetch("/api/memories")
      .then((response) => response.json())
      .then((payload: { memories?: Memory[]; error?: string }) => {
        if (payload.error) setMessage(payload.error);
        setMemories(payload.memories || []);
      })
      .catch(() => setMessage("Could not load your memories."))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded || !focusId) return;
    document.getElementById(focusId)?.scrollIntoView({ block: "center" });
  }, [loaded, focusId]);

  const visible = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const list = query ? memories.filter((memory) => memory.content.toLowerCase().includes(query)) : memories;
    return { pinned: list.filter((memory) => memory.pinned), other: list.filter((memory) => !memory.pinned) };
  }, [memories, filter]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    setAdding(true);
    setMessage("");
    try {
      const response = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft })
      });
      const payload = (await response.json()) as { memory?: Memory; error?: string };
      if (!response.ok || !payload.memory) throw new Error(payload.error || "Could not save that memory.");
      setMemories((list) => [payload.memory!, ...list]);
      setDraft("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save that memory.");
    } finally {
      setAdding(false);
    }
  }

  async function patch(id: string, body: { content?: string; pinned?: boolean }) {
    setBusyId(id);
    setMessage("");
    try {
      const response = await fetch(`/api/memories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = (await response.json()) as { memory?: Memory; error?: string };
      if (!response.ok || !payload.memory) throw new Error(payload.error || "Could not update that memory.");
      setMemories((list) => list.map((memory) => (memory.id === id ? payload.memory! : memory)));
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update that memory.");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function saveEdit(id: string) {
    if (await patch(id, { content: editText })) setEditingId(null);
  }

  async function remove(id: string) {
    setBusyId(id);
    setMessage("");
    try {
      const response = await fetch(`/api/memories/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete that memory.");
      setMemories((list) => list.filter((memory) => memory.id !== id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete that memory.");
    } finally {
      setBusyId(null);
    }
  }

  function renderMemory(memory: Memory) {
    const editing = editingId === memory.id;
    const busy = busyId === memory.id;
    return (
      <li
        key={memory.id}
        id={memory.id}
        className={`group flex items-start gap-3 px-5 py-4 ${focusId === memory.id ? "bg-[var(--accent-soft)]" : ""}`}
      >
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                saveEdit(memory.id);
              }}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <input
                aria-label="Edit memory"
                className="input-premium min-w-0 flex-1 px-3"
                value={editText}
                autoFocus
                maxLength={400}
                onChange={(event) => setEditText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setEditingId(null);
                }}
              />
              <div className="flex gap-2">
                <button type="submit" className="btn-primary btn-sm" disabled={busy}>
                  <Check size={15} /> Save
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                  <X size={15} /> Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="text-[15px] leading-6 text-[var(--text)]">{memory.content}</p>
              <p className="mt-1 text-[12.5px] text-[var(--muted)]">{sourceLabel(memory)}</p>
            </>
          )}
        </div>
        {editing ? null : (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="icon-button"
              aria-label={memory.pinned ? "Unpin memory" : "Pin memory"}
              title={memory.pinned ? "Unpin" : "Pin: always keep this in mind"}
              disabled={busy}
              onClick={() => patch(memory.id, { pinned: !memory.pinned })}
            >
              {memory.pinned ? <PinOff size={16} /> : <Pin size={16} />}
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Edit memory"
              title="Edit"
              disabled={busy}
              onClick={() => {
                setEditingId(memory.id);
                setEditText(memory.content);
              }}
            >
              <Pencil size={16} />
            </button>
            <button type="button" className="icon-button" aria-label="Delete memory" title="Delete" disabled={busy} onClick={() => remove(memory.id)}>
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </li>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-7 px-5 py-8 sm:px-6 lg:py-10">
      <WorkspaceHeader
        title="Memory"
        eyebrow="Workspace"
        description="What Selrano remembers about you. It brings these into chats when they matter, and marks the answers that used them. Pinned memories are always in mind."
      />

      <form onSubmit={add} className="panel flex flex-col gap-3 p-5 sm:flex-row">
        <input
          aria-label="Something to remember"
          className="input-premium min-w-0 flex-1 px-4"
          placeholder="Something to remember, like: I'm vegetarian"
          value={draft}
          maxLength={400}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="btn-primary shrink-0" disabled={adding || !draft.trim()}>
          <Plus size={17} />
          {adding ? "Saving" : "Remember"}
        </button>
      </form>

      {message ? (
        <p role="alert" className="text-sm font-medium text-[var(--critical)]">
          {message}
        </p>
      ) : null}

      {memories.length > 8 ? (
        <input
          aria-label="Search memories"
          className="input-premium w-full px-4"
          placeholder="Search memories"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      ) : null}

      {!loaded ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : memories.length === 0 ? (
        <EmptyState
          icon={<Brain size={20} />}
          title="Nothing remembered yet"
          description="Tell Selrano about yourself in a chat, or add something above. It keeps lasting facts like your preferences, people, plans and goals."
        />
      ) : (
        <div className="space-y-6">
          {visible.pinned.length ? (
            <section aria-label="Pinned memories">
              <h2 className="mb-2 text-[13px] font-medium text-[var(--muted)]">Pinned</h2>
              <ul className="panel divide-y divide-[var(--border)] overflow-hidden p-0">{visible.pinned.map(renderMemory)}</ul>
            </section>
          ) : null}
          {visible.other.length ? (
            <section aria-label="Memories">
              {visible.pinned.length ? <h2 className="mb-2 text-[13px] font-medium text-[var(--muted)]">Everything else</h2> : null}
              <ul className="panel divide-y divide-[var(--border)] overflow-hidden p-0">{visible.other.map(renderMemory)}</ul>
            </section>
          ) : null}
          {!visible.pinned.length && !visible.other.length ? <p className="text-sm text-[var(--muted)]">No memories match that search.</p> : null}
        </div>
      )}
    </div>
  );
}
