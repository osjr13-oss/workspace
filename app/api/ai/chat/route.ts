import { NextResponse } from "next/server";
import { reserveAiRequest } from "@/lib/ai-usage";
import { features } from "@/lib/features";
import { callGroq, streamGroq } from "@/lib/groq";
import { searchProjectChunks } from "@/lib/retrieve-context";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as { message?: string; threadId?: string | null; projectId?: string | null };
    if (!body.message?.trim()) return NextResponse.json({ error: "Message is required" }, { status: 400 });

    const limitError = await reserveAiRequest(supabase, user.id, "chat", {
      model: process.env.GROQ_MODEL || "groq",
      input_chars: body.message.length
    });
    if (limitError) return NextResponse.json({ error: limitError }, { status: 429 });

    let threadId = body.threadId || null;
    if (!threadId) {
      const title = body.message.slice(0, 72);
      const { data, error } = await supabase
        .from("chat_threads")
        .insert({ user_id: user.id, project_id: body.projectId || null, title })
        .select("*")
        .single();
      if (error) throw error;
      threadId = data.id;
    }

    const { error: userMessageError } = await supabase.from("chat_messages").insert({
      user_id: user.id,
      thread_id: threadId,
      role: "user",
      content: body.message
    });
    if (userMessageError) throw userMessageError;

    const [historyResult, context] = await Promise.all([
      supabase.from("chat_messages").select("role, content").eq("thread_id", threadId).order("created_at", { ascending: true }).limit(16),
      loadProjectContext(supabase, body.projectId || null, body.message)
    ]);

    const messages = [
      {
        role: "system" as const,
        content:
          "You are Selrano, an AI built into an academic workspace. Be direct and conversational — answer the question immediately without preamble, intros, or sign-offs. Never start with 'I can help with...' or list your own capabilities. Never use bullet points or numbered lists unless the user explicitly asks for them or the content is genuinely list-like. Write in plain prose. Keep responses tight — say what needs to be said, nothing more. If the user's project context is relevant, use it naturally without announcing that you're doing so. If you don't know something, say so plainly."
      },
      ...(context
        ? [
            {
              role: "system" as const,
              content: `Project context:\n${context}`
            }
          ]
        : []),
      ...((historyResult.data || []) as Array<{ role: "user" | "assistant"; content: string }>).map((message) => ({
        role: message.role,
        content: message.content
      }))
    ];

    if (!threadId) return NextResponse.json({ error: "Could not resolve conversation" }, { status: 500 });
    const finalThreadId = threadId;

    // Feature-flagged: when streaming is OFF, keep the original behavior —
    // generate the full answer, save it, and return it as JSON in one response.
    if (!features.streamingChat) {
      const answer = await callGroq(messages, { temperature: 0.6 });

      const { error: assistantMessageError } = await supabase.from("chat_messages").insert({
        user_id: user.id,
        thread_id: finalThreadId,
        role: "assistant",
        content: answer
      });
      if (assistantMessageError) throw assistantMessageError;

      await supabase.from("chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", finalThreadId);

      return NextResponse.json({ threadId: finalThreadId, answer });
    }

    const encoder = new TextEncoder();

    // Stream the model's answer to the browser token-by-token. Once the stream
    // finishes we persist the complete assistant message and bump the thread.
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let answer = "";
        try {
          answer = await streamGroq(messages, {
            temperature: 0.6,
            onToken: (token) => controller.enqueue(encoder.encode(token))
          });

          // Persist the full answer BEFORE closing the stream, so the browser's
          // post-stream reload is guaranteed to see the saved assistant message.
          if (answer) {
            const { error: assistantMessageError } = await supabase.from("chat_messages").insert({
              user_id: user.id,
              thread_id: finalThreadId,
              role: "assistant",
              content: answer
            });
            if (assistantMessageError) {
              console.error("[chat] persist assistant message failed", assistantMessageError);
            }
            await supabase.from("chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", finalThreadId);
          }
        } catch (error) {
          console.error("[chat] stream failed", serializeError(error), error);
          if (!answer) {
            controller.enqueue(encoder.encode("Sorry — something went wrong generating that response. Please try again."));
          }
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Thread-Id": finalThreadId
      }
    });
  } catch (error) {
    const message = serializeError(error);
    console.error("[chat]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function loadProjectContext(
  supabase: Awaited<ReturnType<typeof getAuthenticatedUser>>["supabase"],
  projectId: string | null,
  query?: string
) {
  if (!projectId) return "";

  const semanticChunks = query?.trim() ? await searchProjectChunks(supabase, projectId, query, 6) : [];

  const [notes, chunks, cards] = await Promise.all([
    supabase.from("notes").select("title, content").eq("project_id", projectId).order("updated_at", { ascending: false }).limit(6),
    semanticChunks.length
      ? Promise.resolve({ data: [] as Array<{ content: string }> })
      : supabase.from("file_chunks").select("content").eq("project_id", projectId).order("chunk_index").limit(10),
    supabase.from("flashcards").select("front, back").eq("project_id", projectId).order("updated_at", { ascending: false }).limit(12)
  ]);

  const fileExcerpts = semanticChunks.length
    ? semanticChunks.map((chunk) => `File excerpt (relevant):\n${chunk.content}`)
    : ((chunks.data || []) as Array<{ content: string }>).map((chunk) => `File excerpt:\n${chunk.content}`);

  const parts = [
    ...((notes.data || []) as Array<{ title: string; content: string }>).map((note) => `Note: ${note.title}\n${note.content.slice(0, 1800)}`),
    ...fileExcerpts,
    ...((cards.data || []) as Array<{ front: string; back: string }>).map((card) => `Flashcard: ${card.front}\nAnswer: ${card.back}`)
  ];

  return parts.join("\n\n---\n\n").slice(0, 14000);
}
