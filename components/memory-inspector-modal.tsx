"use client";

import { useEffect, useState } from "react";
import { Brain, Check, RefreshCw, Search, Trash2, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatRelative } from "@/lib/format";
import { removeEmDashes } from "@/lib/text";

type ContentMemory = {
  id: string;
  fact: string;
  source: string;
  confidence: number;
  created_at: string;
  updated_at: string;
};

export function MemoryInspectorModal({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [memories, setMemories] = useState<ContentMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadMemories() {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("content_memories")
      .select("*")
      .order("updated_at", { ascending: false });
    setMemories((data as ContentMemory[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    if (open) {
      loadMemories();
    }
  }, [open]);

  async function deleteMemory(id: string) {
    setDeletingId(id);
    const supabase = createSupabaseBrowserClient();
    await supabase.from("content_memories").delete().eq("id", id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
    setDeletingId(null);
  }

  if (!open) return null;

  const filtered = memories.filter((m) =>
    m.fact.toLowerCase().includes(search.toLowerCase())
  );

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
              <h2 className="text-base font-bold text-[var(--text)]">Durable Memory Bank</h2>
              <p className="text-xs text-[var(--muted)]">
                Facts and context Selrano retains across conversations
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

        {/* Search & Actions Bar */}
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-slate-50/60 px-6 py-3">
          <div className="flex flex-1 items-center gap-2">
            <Search size={16} className="text-[var(--muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search remembered facts..."
              className="w-full bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
            />
          </div>
          <button
            type="button"
            onClick={loadMemories}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-[var(--muted)] hover:bg-slate-200/60 hover:text-[var(--text)]"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
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
              <h3 className="mt-3 text-sm font-bold text-[var(--text)]">No memories found</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {search ? "Try a different search keyword." : "As you think out loud in chats, Selrano automatically captures lasting facts."}
              </p>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="group flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-slate-50/40 p-4 transition hover:border-[var(--border-strong)] hover:bg-white"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-6 text-[var(--text)]">
                    {removeEmDashes(item.fact)}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                    <span>Captured {formatRelative(item.created_at)}</span>
                    <span>•</span>
                    <span>Confidence: {Math.round(item.confidence * 100)}%</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => deleteMemory(item.id)}
                  disabled={deletingId === item.id}
                  aria-label="Delete memory"
                  className="rounded-lg p-1.5 text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-[var(--border)] bg-slate-50 px-6 py-3 text-xs text-[var(--muted)]">
          <span>{memories.length} total facts retained</span>
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
