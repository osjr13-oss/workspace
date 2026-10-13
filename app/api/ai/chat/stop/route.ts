import { NextResponse } from "next/server";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { removeEmDashes } from "@/lib/text";

export const runtime = "nodejs";

/**
 * Stop: saves the words the user saw as the reply. The generating request
 * (/api/ai/chat) keeps running in the background, sees this newer message when
 * it finishes, and saves nothing on top of it. An empty reply is saved too, so
 * a reply stopped before any words still counts as stopped.
 */
export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as { threadId?: string; content?: string };
    const threadId = body.threadId?.trim();
    if (!threadId) return NextResponse.json({ error: "threadId is required" }, { status: 400 });

    const { data: thread, error: threadError } = await supabase
      .from("chat_threads")
      .select("id")
      .eq("id", threadId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (threadError) throw threadError;
    if (!thread) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    // If the full reply was already saved, there is nothing left to stop.
    const { data: newest, error: newestError } = await supabase
      .from("chat_messages")
      .select("role")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (newestError) throw newestError;
    if (!newest || newest.role === "assistant") return NextResponse.json({ saved: false });

    const content = removeEmDashes(String(body.content || "")).trim().slice(0, 20000);
    const { error: insertError } = await supabase
      .from("chat_messages")
      .insert({ user_id: user.id, thread_id: threadId, role: "assistant", content });
    if (insertError) throw insertError;
    return NextResponse.json({ saved: true });
  } catch (error) {
    const message = serializeError(error);
    console.error("[chat stop]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
