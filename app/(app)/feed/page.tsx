"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Brain, Check, FileText, Loader2, Pencil, Play, X } from "lucide-react";
import { WorkspaceHeader } from "@/components/workspace-header";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type FeedItemRow = {
  id: string;
  job_id: string | null;
  action_type: "generate_flashcards" | "write_study_brief";
  title: string;
  reason: string;
  payload: { cards?: Array<{ front: string; back: string }>; body?: string };
  status: "pending" | "approved" | "dismissed";
  created_at: string;
};

type RunJob = {
  id: string;
  created_at: string;
  status: string;
  result: { actions_planned?: number; items_created?: number; no_action_reason?: string | null } | null;
};

type RunSummary = {
  status: "succeeded" | "skipped" | "failed";
  itemsCreated: number;
  discarded: number;
  message: string;
};

function formatRunDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export default function FeedPage() {
  const [items, setItems] = useState<FeedItemRow[]>([]);
  const [runs, setRuns] = useState<RunJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const [itemsResult, runsResult] = await Promise.all([
      supabase.from("feed_items").select("*").order("created_at", { ascending: false }).limit(100),
      supabase
        .from("background_jobs")
        .select("id, created_at, status, result")
        .eq("job_type", "worker_run")
        .order("created_at", { ascending: false })
        .limit(30)
    ]);

    if (itemsResult.error) setError(itemsResult.error.message);
    setItems((itemsResult.data as FeedItemRow[]) || []);
    setRuns((runsResult.data as RunJob[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runNow() {
    setRunning(true);
    setRunMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/worker/run", { method: "POST" });
      const data = (await response.json()) as RunSummary & { error?: string };
      if (!response.ok) {
        setError(data.error || "The run did not finish.");
      } else {
        setRunMessage(data.message);
        await load();
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setRunning(false);
    }
  }

  async function decide(item: FeedItemRow, action: "approve" | "dismiss", editedPayload?: FeedItemRow["payload"]) {
    setBusyId(item.id);
    setError(null);
    try {
      const response = await fetch(`/api/feed/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload: editedPayload })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Could not update this item.");
      } else {
        setEditingId(null);
        await load();
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  // Group pending/decided items by the calendar day their run happened, newest
  // first, so the feed reads as "what happened each day" rather than one flat list.
  const groups = useMemo(() => {
    const byRun = new Map<string, { runAt: string; noActionReason: string | null; items: FeedItemRow[] }>();

    for (const run of runs) {
      const day = run.created_at.slice(0, 10);
      byRun.set(run.id, { runAt: run.created_at, noActionReason: run.result?.no_action_reason ?? null, items: [] });
      void day;
    }

    for (const item of items) {
      const key = item.job_id;
      if (key && byRun.has(key)) {
        byRun.get(key)!.items.push(item);
      }
    }

    return Array.from(byRun.values())
      .filter((group) => group.items.length > 0 || group.noActionReason !== null)
      .sort((a, b) => b.runAt.localeCompare(a.runAt));
  }, [items, runs]);

  return (
    <div className="mx-auto max-w-4xl space-y-7 px-5 py-8 sm:px-6 lg:py-10">
      <WorkspaceHeader title="Feed" eyebrow="Review">
        <button type="button" onClick={runNow} className="btn-primary" disabled={running}>
          {running ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
          {running ? "Running" : "Run now"}
        </button>
      </WorkspaceHeader>

      {runMessage ? <p className="panel px-5 py-4 text-sm font-bold">{runMessage}</p> : null}
      {error ? <p className="panel px-5 py-4 text-sm font-bold text-[var(--high)]">{error}</p> : null}

      {loading ? (
        <p className="py-16 text-center text-sm text-[var(--muted)]">Loading your feed</p>
      ) : groups.length === 0 ? (
        <div className="panel p-10 text-center">
          <p className="text-lg font-extrabold">Nothing here yet.</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Add a goal, upload something, or press Run now to see what Selrano finds worth making.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.runAt}>
              <h2 className="mb-3 text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">
                {formatRunDate(group.runAt)}
              </h2>

              {group.items.length === 0 ? (
                <div className="panel p-6">
                  <p className="text-sm font-bold">Nothing new needed today.</p>
                  {group.noActionReason ? <p className="mt-1 text-sm text-[var(--muted)]">{group.noActionReason}</p> : null}
                </div>
              ) : (
                <div className="space-y-3">
                  {group.items.map((item) => (
                    <FeedCard
                      key={item.id}
                      item={item}
                      editing={editingId === item.id}
                      busy={busyId === item.id}
                      onStartEdit={() => setEditingId(item.id)}
                      onCancelEdit={() => setEditingId(null)}
                      onApprove={(payload) => decide(item, "approve", payload)}
                      onDismiss={() => decide(item, "dismiss")}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function FeedCard({
  item,
  editing,
  busy,
  onStartEdit,
  onCancelEdit,
  onApprove,
  onDismiss
}: {
  item: FeedItemRow;
  editing: boolean;
  busy: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onApprove: (payload?: FeedItemRow["payload"]) => void;
  onDismiss: () => void;
}) {
  const [draftBody, setDraftBody] = useState(item.payload.body ?? "");
  const [draftCards, setDraftCards] = useState(item.payload.cards ?? []);
  const isFlashcards = item.action_type === "generate_flashcards";
  const decided = item.status !== "pending";

  return (
    <div className="panel p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--surface-subtle)]">
          {isFlashcards ? <Brain size={18} /> : <FileText size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-extrabold">{item.title}</p>
            {decided ? <span className="status-pill">{item.status}</span> : null}
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">{item.reason}</p>

          {editing ? (
            isFlashcards ? (
              <div className="mt-4 space-y-2">
                {draftCards.map((card, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-2">
                    <input
                      className="input-premium px-4 text-sm"
                      value={card.front}
                      onChange={(event) =>
                        setDraftCards((cards) =>
                          cards.map((entry, i) => (i === index ? { ...entry, front: event.target.value } : entry))
                        )
                      }
                      aria-label={`Card ${index + 1} front`}
                    />
                    <input
                      className="input-premium px-4 text-sm"
                      value={card.back}
                      onChange={(event) =>
                        setDraftCards((cards) =>
                          cards.map((entry, i) => (i === index ? { ...entry, back: event.target.value } : entry))
                        )
                      }
                      aria-label={`Card ${index + 1} back`}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <textarea
                className="input-premium mt-4 min-h-[220px] w-full px-4 py-3 text-sm leading-6"
                value={draftBody}
                onChange={(event) => setDraftBody(event.target.value)}
                aria-label="Brief content"
              />
            )
          ) : isFlashcards ? (
            <p className="mt-3 text-sm text-[var(--muted-strong)]">{item.payload.cards?.length ?? 0} cards</p>
          ) : (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--muted-strong)]">
              {(item.payload.body ?? "").slice(0, 260)}
              {(item.payload.body ?? "").length > 260 ? "…" : ""}
            </p>
          )}

          {!decided ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {editing ? (
                <>
                  <button
                    type="button"
                    className="btn-primary min-h-9 px-4 text-sm"
                    disabled={busy}
                    onClick={() => onApprove(isFlashcards ? { ...item.payload, cards: draftCards } : { ...item.payload, body: draftBody })}
                  >
                    <Check size={15} />
                    Save and approve
                  </button>
                  <button type="button" className="btn-secondary min-h-9 px-4 text-sm" disabled={busy} onClick={onCancelEdit}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn-primary min-h-9 px-4 text-sm" disabled={busy} onClick={() => onApprove()}>
                    <Check size={15} />
                    Approve
                  </button>
                  <button type="button" className="btn-secondary min-h-9 px-4 text-sm" disabled={busy} onClick={onStartEdit}>
                    <Pencil size={15} />
                    Edit
                  </button>
                  <button type="button" className="btn-secondary min-h-9 px-4 text-sm" disabled={busy} onClick={onDismiss}>
                    <X size={15} />
                    Dismiss
                  </button>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
