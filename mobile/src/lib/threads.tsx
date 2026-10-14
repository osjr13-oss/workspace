import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { removeEmDashes } from "@shared/text";
import type { ChatThread, Project } from "@shared/types";
import { useAuth } from "@/auth";
import { supabase } from "@/lib/supabase";

type ThreadsValue = {
  threads: ChatThread[];
  projects: Project[];
  loaded: boolean;
  refresh: () => Promise<void>;
  rename: (id: string, title: string) => Promise<string | null>;
  remove: (id: string) => Promise<string | null>;
};

const ThreadsContext = createContext<ThreadsValue | null>(null);

/** The conversation and project lists, shared by every screen so they always agree. */
export function ThreadsProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const [threadResult, projectResult] = await Promise.all([
      supabase.from("chat_threads").select("*").order("updated_at", { ascending: false }),
      supabase.from("projects").select("*").order("name")
    ]);
    if (!threadResult.error) setThreads((threadResult.data as ChatThread[]) || []);
    if (!projectResult.error) setProjects((projectResult.data as Project[]) || []);
    setLoaded(true);
  }, []);

  const rename = useCallback(async (id: string, title: string) => {
    const next = removeEmDashes(title).trim().slice(0, 120);
    if (!next) return "A title is required.";
    const { error } = await supabase.from("chat_threads").update({ title: next }).eq("id", id);
    if (error) return error.message || "Could not rename the conversation.";
    setThreads((current) => current.map((thread) => (thread.id === id ? { ...thread, title: next } : thread)));
    return null;
  }, []);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from("chat_threads").delete().eq("id", id);
    if (error) return error.message || "Could not delete the conversation.";
    setThreads((current) => current.filter((thread) => thread.id !== id));
    return null;
  }, []);

  useEffect(() => {
    if (session) void refresh();
    else {
      setThreads([]);
      setProjects([]);
      setLoaded(false);
    }
  }, [session, refresh]);

  const value = useMemo(() => ({ threads, projects, loaded, refresh, rename, remove }), [threads, projects, loaded, refresh, rename, remove]);
  return <ThreadsContext.Provider value={value}>{children}</ThreadsContext.Provider>;
}

export function useThreads() {
  const value = useContext(ThreadsContext);
  if (!value) throw new Error("useThreads must be used inside ThreadsProvider");
  return value;
}

/** Today, Yesterday, Previous 7 days, Older. */
export function groupThreads(threads: ChatThread[], now = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86_400_000;
  const groups: Array<{ title: string; data: ChatThread[] }> = [
    { title: "Today", data: [] },
    { title: "Yesterday", data: [] },
    { title: "Previous 7 days", data: [] },
    { title: "Older", data: [] }
  ];
  for (const thread of threads) {
    const at = new Date(thread.updated_at).getTime();
    if (at >= startOfToday) groups[0].data.push(thread);
    else if (at >= startOfToday - day) groups[1].data.push(thread);
    else if (at >= startOfToday - 7 * day) groups[2].data.push(thread);
    else groups[3].data.push(thread);
  }
  return groups.filter((group) => group.data.length);
}
