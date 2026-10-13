"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { removeEmDashes } from "@/lib/text";
import type { ChatThread } from "@/lib/types";

type ChatThreadsValue = {
  threads: ChatThread[];
  loaded: boolean;
  refresh: () => Promise<void>;
  rename: (id: string, title: string) => Promise<string | null>;
  remove: (id: string) => Promise<string | null>;
};

const ChatThreadsContext = createContext<ChatThreadsValue | null>(null);

/** One list of conversations shared by the sidebar and the chat page, so both always agree. */
export function ChatThreadsProvider({ children }: { children: React.ReactNode }) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.from("chat_threads").select("*").order("updated_at", { ascending: false });
    setThreads((data as ChatThread[]) || []);
    setLoaded(true);
  }, []);

  const rename = useCallback(async (id: string, title: string) => {
    const next = removeEmDashes(title).trim().slice(0, 120);
    if (!next) return "A title is required.";
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("chat_threads").update({ title: next }).eq("id", id);
    if (error) return error.message || "Could not rename the conversation.";
    setThreads((current) => current.map((thread) => (thread.id === id ? { ...thread, title: next } : thread)));
    return null;
  }, []);

  const remove = useCallback(async (id: string) => {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("chat_threads").delete().eq("id", id);
    if (error) return error.message || "Could not delete the conversation.";
    setThreads((current) => current.filter((thread) => thread.id !== id));
    return null;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ threads, loaded, refresh, rename, remove }), [threads, loaded, refresh, rename, remove]);
  return <ChatThreadsContext.Provider value={value}>{children}</ChatThreadsContext.Provider>;
}

export function useChatThreads() {
  const value = useContext(ChatThreadsContext);
  if (!value) throw new Error("useChatThreads must be used inside ChatThreadsProvider");
  return value;
}

/** Groups conversations by when they were last active: Today, Yesterday, Previous 7 days, Older. */
export function groupThreads(threads: ChatThread[], now = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86_400_000;
  const groups: Array<{ label: string; threads: ChatThread[] }> = [
    { label: "Today", threads: [] },
    { label: "Yesterday", threads: [] },
    { label: "Previous 7 days", threads: [] },
    { label: "Older", threads: [] }
  ];
  for (const thread of threads) {
    const at = new Date(thread.updated_at).getTime();
    if (at >= startOfToday) groups[0].threads.push(thread);
    else if (at >= startOfToday - day) groups[1].threads.push(thread);
    else if (at >= startOfToday - 7 * day) groups[2].threads.push(thread);
    else groups[3].threads.push(thread);
  }
  return groups.filter((group) => group.threads.length);
}
