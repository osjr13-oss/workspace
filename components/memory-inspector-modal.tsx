"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brain, Crown, Plus, RefreshCw, Search, Sparkles, Trash2, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatRelative } from "@/lib/format";
import { removeEmDashes } from "@/lib/text";

type ContentMemory = {
  id: string;
  content: string;
  importance: number;
  created_at: string;
  last_accessed: string;
};

const FREE_MAX_MEMORIES = 5;

export function MemoryInspectorModal({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [memories, setMemories] = useState<ContentMemory[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [newMemoryText, setNewMemoryText] = useState("");
  const [addingMemory, setAddingMemory] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadData() {
    setLoading(true);
    setErrorMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (user) {
        const [memoriesRes, limitsRes] = await Promise.all([
          supabase
            .from("content_memories")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase
            .from("user_limits")
            .select("tier, subscription_status")
            .eq("user_id", user.id)
            .maybeSingle()
        ]);

        if (memoriesRes.data) {
          setMemories(memoriesRes.data as ContentMemory[]);
        }

        const tier = limitsRes.data?.tier;
        const status = limitsRes.data?.subscription_status;
        setIsPro(tier === "pro" && ["active", "trialing"].includes(status || ""));
      }
    } catch (err) {
      console.error("[memory-modal] Load failed", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  async function handleAddMemory(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage("");
    const cleanText = removeEmDashes(newMemoryText).trim();
    if (!cleanText) return;

    if (!isPro && memories.length >= FREE_MAX_MEMORIES) {
      setErrorMessage(
        `You have reached the Free plan limit of ${FREE_MAX_MEMORIES} memories. Upgrade to Pro for an unlimited memory bank.`
      );
      return;
    }

    setAddingMemory(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("content_memories")
        .insert({
          user_id: user.id,
          content: cleanText,
          importance: 0.8
        })
        .select("*")
        .single();

      if (error) {
        setErrorMessage(error.message || "Could not save memory.");
      } else if (data) {
        setMemories((prev) => [data as ContentMemory, ...prev]);
        setNewMemoryText("");
      }
    } catch (err) {
      console.error("[memory-modal] Add failed", err);
      setErrorMessage("Could not save memory.");
    } finally {
      setAddingMemory(false);
    }
  }

  async function deleteMemory(id: string) {
    setDeletingId(id);
    setErrorMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.from("content_memories").delete().eq("id", id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error("[memory-modal] Delete failed", err);
    } finally {
      setDeletingId(null);
    }
  }

  if (!open) return null;

  const filtered = memories.filter((m) =>
    (m.content || "").toLowerCase().includes(search.toLowerCase())
  );

  const atFreeLimit = !isPro && memories.length >= FREE_MAX_MEMORIES;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Brain size={17} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[var(--text)]">Memory Bank</h2>
                {isPro ? (
                  <span className="badge badge-brand text-[10px]">
                    <Crown size={10} className="mr-1" /> Pro Unlimited
                  </span>
                ) : (
                  <span className="badge badge-subtle text-[10px]">
                    Free ({memories.length}/{FREE_MAX_MEMORIES} used)
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--muted)]">
                Everything Selrano remembers so you never have to repeat yourself
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-slate-100 hover:text-[var(--text)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Pro Upsell Callout for Free Users near or at capacity */}
        {!isPro && (
          <div className="flex items-center justify-between border-b border-amber-200 bg-amber-50/70 px-6 py-2.5 text-xs text-amber-900">
            <div className="flex items-center gap-1.5 font-medium">
              <Sparkles size={14} className="text-amber-600 shrink-0" />
              <span>
                Free plan includes <strong>5 durable memories</strong>. Pro unlocks unlimited memories and deep cross-conversation recall.
              </span>
            </div>
            <Link
              href="/pricing"
              onClick={onClose}
              className="ml-3 shrink-0 rounded-md bg-amber-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-black transition"
            >
              Upgrade
            </Link>
          </div>
        )}

        {/* Add Memory Directly Form */}
        <form
          onSubmit={handleAddMemory}
          className="flex items-center gap-2 border-b border-[var(--border)] bg-slate-50/70 px-6 py-3"
        >
          <input
            type="text"
            value={newMemoryText}
            onChange={(e) => setNewMemoryText(e.target.value)}
            disabled={atFreeLimit}
            placeholder={
              atFreeLimit
                ? "Free plan limit reached (5/5). Delete a memory or upgrade to Pro to add more."
                : "Add a fact to remember (e.g. 'I prefer concise answers', 'My goal this month is...')"
            }
            className="flex-1 bg-white rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text)] outline-none placeholder:text-[var(--muted)] disabled:bg-slate-100 disabled:text-slate-400"
          />
          <button
            type="submit"
            disabled={!newMemoryText.trim() || addingMemory || atFreeLimit}
            className="btn-primary min-h-[32px] px-3 text-xs shrink-0 disabled:opacity-50"
          >
            <Plus size={13} />
            <span>{addingMemory ? "Saving..." : "Add"}</span>
          </button>
        </form>

        {errorMessage && (
          <div className="bg-rose-50 px-6 py-2 border-b border-rose-200 text-xs font-semibold text-rose-700">
            {errorMessage}
          </div>
        )}

        {/* Search & Refresh Bar */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-2.5 bg-white">
          <div className="flex flex-1 items-center gap-2">
            <Search size={15} className="text-[var(--muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search remembered facts..."
              className="w-full bg-transparent text-xs text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
            />
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-[var(--muted)] hover:bg-slate-100 hover:text-[var(--text)]"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Memory List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Brain size={32} className="mx-auto text-slate-300" />
              <h3 className="mt-3 text-sm font-bold text-[var(--text)]">No memories yet</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {search
                  ? "No memories match your search."
                  : "Tell Selrano to remember something in chat, or add one using the input above."}
              </p>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="group flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-slate-50/40 p-4 transition hover:border-[var(--border-strong)] hover:bg-white"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-relaxed text-[var(--text)]">
                    {removeEmDashes(item.content || "")}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
                    <span>Added {formatRelative(item.created_at)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => deleteMemory(item.id)}
                  disabled={deletingId === item.id}
                  aria-label="Delete memory"
                  title="Forget this memory"
                  className="rounded-lg p-1.5 text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-[var(--border)] bg-slate-50 px-6 py-3 text-xs text-[var(--muted)]">
          <span>
            {memories.length} {isPro ? "facts stored" : `of ${FREE_MAX_MEMORIES} free memories stored`}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn-primary min-h-[32px] px-3 text-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
