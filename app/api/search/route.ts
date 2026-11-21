import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { removeEmDashes } from "@/lib/text";

export const runtime = "nodejs";

export type SearchResult = {
  kind: "chat" | "note" | "file";
  id: string;
  title: string;
  snippet: string;
  href: string;
  at: string;
};

/**
 * Search everything (Cmd+K): what was said in chats, chat titles, notes and
 * file names. Signed-in owner only; row-level security keeps it to their rows.
 * Temporary chats are left out.
 */
export async function GET(request: Request) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const query = removeEmDashes(new URL(request.url).searchParams.get("q") || "").trim().slice(0, 120);
  if (query.length < 2) return NextResponse.json({ results: [] });
  const like = `%${query.replace(/[%_\\,()]/g, " ")}%`;

  const [titles, messages, notes, files] = await Promise.all([
    supabase.from("chat_threads").select("id, title, updated_at").neq("temporary", true).ilike("title", like).order("updated_at", { ascending: false }).limit(6),
    supabase
      .from("chat_messages")
      .select("id, thread_id, content, created_at, chat_threads!inner(title, temporary)")
      .textSearch("content_tsv", query, { type: "websearch", config: "english" })
      .order("created_at", { ascending: false })
      .limit(12),
    supabase.from("notes").select("id, title, content, updated_at").or(`title.ilike.${like},content.ilike.${like}`).order("updated_at", { ascending: false }).limit(6),
    supabase.from("files").select("id, name, created_at").ilike("name", like).order("created_at", { ascending: false }).limit(5)
  ]);

  const results: SearchResult[] = [];
  const seenThreads = new Set<string>();
  for (const row of (titles.data || []) as Array<{ id: string; title: string; updated_at: string }>) {
    seenThreads.add(row.id);
    results.push({ kind: "chat", id: row.id, title: removeEmDashes(row.title), snippet: "", href: `/chats?thread=${row.id}`, at: row.updated_at });
  }
  type MessageRow = { id: string; thread_id: string; content: string; created_at: string; chat_threads: { title: string; temporary?: boolean | null } | null };
  for (const row of (messages.data || []) as unknown as MessageRow[]) {
    if (seenThreads.has(row.thread_id) || row.chat_threads?.temporary) continue;
    seenThreads.add(row.thread_id);
    results.push({ kind: "chat", id: row.thread_id, title: removeEmDashes(row.chat_threads?.title || "Conversation"), snippet: snippet(row.content, query), href: `/chats?thread=${row.thread_id}`, at: row.created_at });
  }
  for (const row of (notes.data || []) as Array<{ id: string; title: string; content: string; updated_at: string }>) {
    results.push({ kind: "note", id: row.id, title: removeEmDashes(row.title || "Untitled note"), snippet: snippet(row.content || "", query), href: `/notes?note=${row.id}`, at: row.updated_at });
  }
  for (const row of (files.data || []) as Array<{ id: string; name: string; created_at: string }>) {
    results.push({ kind: "file", id: row.id, title: removeEmDashes(row.name), snippet: "", href: `/files/${row.id}`, at: row.created_at });
  }
  return NextResponse.json({ results });
}

/** A short piece of text around the first word that matched. */
function snippet(text: string, query: string) {
  const clean = removeEmDashes(text).replace(/\s+/g, " ").trim();
  const words = query.toLowerCase().split(/\s+/).filter((word) => word.length > 1);
  const lower = clean.toLowerCase();
  const at = words.map((word) => lower.indexOf(word)).filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, at - 50);
  return `${start ? "..." : ""}${clean.slice(start, start + 160)}${start + 160 < clean.length ? "..." : ""}`;
}
