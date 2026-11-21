import { NextResponse } from "next/server";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { removeEmDashes } from "@/lib/text";

export const runtime = "nodejs";

/**
 * Stop: saves the words the user saw as the answer to `questionId`. The
 * generating request (/api/ai/chat) notices this answer, cancels its model
 * call, and saves nothing on top of it. An empty reply is saved too, so a
 * reply stopped before any words still counts as stopped.
 */
export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as { threadId?: string; content?: string; questionId?: string; startedAt?: string };
    const threadId = body.threadId?.trim();
    const questionId = body.questionId?.trim();
    if (!threadId || !questionId) return NextResponse.json({ error: "threadId and questionId are required" }, { status: 400 });

    const { data: question, error: questionError } = await supabase
      .from("chat_messages")
      .select("id, role, created_at")
      .eq("id", questionId)
      .eq("thread_id", threadId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (questionError) throw questionError;
    if (!question || question.role !== "user") return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    // If this turn's answer was already saved, there is nothing left to stop.
    const startedAt = body.startedAt ? Date.parse(body.startedAt) : NaN;
    const since = Number.isFinite(startedAt) && startedAt > Date.parse(question.created_at) ? new Date(startedAt).toISOString() : question.created_at;
    const { data: answered, error: answeredError } = await supabase
      .from("chat_messages")
      .select("id")
      .eq("thread_id", threadId)
      .eq("parent_id", questionId)
      .eq("role", "assistant")
      .gt("created_at", since)
      .limit(1)
      .maybeSingle();
    if (answeredError) throw answeredError;
    if (answered) return NextResponse.json({ saved: false });

    const content = removeEmDashes(String(body.content || "")).trim().slice(0, 20000);
    const { data: saved, error: insertError } = await supabase
      .from("chat_messages")
      .insert({ user_id: user.id, thread_id: threadId, parent_id: questionId, role: "assistant", content })
      .select("id")
      .single();
    if (insertError) throw insertError;
    await supabase.from("chat_threads").update({ active_leaf_id: saved.id }).eq("id", threadId).eq("user_id", user.id);
    return NextResponse.json({ saved: true });
  } catch (error) {
    const message = serializeError(error);
    console.error("[chat stop]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
