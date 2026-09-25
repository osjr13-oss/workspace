import { NextResponse } from "next/server";
import { executeTool, toolDefinitions, type ToolContext } from "@/lib/ai-tools";
import { callGroqWithTools, openGroqStream, readGroqStream, type GroqChatMessage } from "@/lib/groq";
import { resolveModel } from "@/lib/models";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { removeEmDashes } from "@/lib/text";
import type { Artifact, Citation } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  message?: string;
  threadId?: string | null;
  model?: string | null;
  editMessageId?: string;
  regenerateMessageId?: string;
  fileIds?: string[];
};

type FileRow = {
  id: string;
  name: string;
  extracted_text: string | null;
  extraction_status: string | null;
};

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Sign in to chat." }, { status: 401 });

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
    }

    if (body.editMessageId && body.regenerateMessageId) {
      return NextResponse.json({ error: "Edit and regenerate cannot be used together." }, { status: 400 });
    }

    let model: string;
    try {
      model = resolveModel(body.model);
    } catch (error) {
      return NextResponse.json({ error: serializeError(error) }, { status: 400 });
    }

    const fileIds = Array.isArray(body.fileIds) ? body.fileIds.filter((id) => typeof id === "string" && id) : [];
    let userContent = removeEmDashes(body.message || "").trim();
    let threadId = body.threadId || null;

    if (body.editMessageId) {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, thread_id, role, created_at")
        .eq("id", body.editMessageId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data || data.role !== "user") {
        return NextResponse.json({ error: "Editable message not found." }, { status: 404 });
      }
      if (!userContent) return NextResponse.json({ error: "Message is required." }, { status: 400 });
      const { error: updateError } = await supabase
        .from("chat_messages")
        .update({ content: userContent })
        .eq("id", data.id)
        .eq("user_id", user.id);
      if (updateError) throw updateError;
      const { error: deleteError } = await supabase
        .from("chat_messages")
        .delete()
        .eq("thread_id", data.thread_id)
        .eq("user_id", user.id)
        .gt("created_at", data.created_at);
      if (deleteError) throw deleteError;
      threadId = data.thread_id;
    }

    if (body.regenerateMessageId) {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, thread_id, role, created_at")
        .eq("id", body.regenerateMessageId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data || data.role !== "assistant") {
        return NextResponse.json({ error: "Regeneratable message not found." }, { status: 404 });
      }
      const { data: previousUser, error: previousError } = await supabase
        .from("chat_messages")
        .select("content")
        .eq("thread_id", data.thread_id)
        .eq("user_id", user.id)
        .eq("role", "user")
        .lt("created_at", data.created_at)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (previousError) throw previousError;
      if (!previousUser?.content) {
        return NextResponse.json({ error: "No user message was found to regenerate from." }, { status: 400 });
      }
      const { error: deleteError } = await supabase
        .from("chat_messages")
        .delete()
        .eq("thread_id", data.thread_id)
        .eq("user_id", user.id)
        .gte("created_at", data.created_at);
      if (deleteError) throw deleteError;
      threadId = data.thread_id;
      userContent = removeEmDashes(previousUser.content).trim();
    }

    if (!userContent) return NextResponse.json({ error: "Message is required." }, { status: 400 });
    if (userContent.length > 20000) {
      return NextResponse.json({ error: "That message is too long." }, { status: 400 });
    }

    if (threadId) {
      const { data: thread, error } = await supabase
        .from("chat_threads")
        .select("id")
        .eq("id", threadId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!thread) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
      const { error: modelError } = await supabase.from("chat_threads").update({ model }).eq("id", threadId).eq("user_id", user.id);
      if (modelError) throw modelError;
    } else {
      const { data, error } = await supabase
        .from("chat_threads")
        .insert({ user_id: user.id, title: userContent.slice(0, 72), model })
        .select("id")
        .single();
      if (error) throw error;
      threadId = data.id;
    }

    if (!threadId) return NextResponse.json({ error: "Could not resolve the conversation." }, { status: 500 });
    const finalThreadId = threadId;

    if (!body.editMessageId && !body.regenerateMessageId) {
      const { error } = await supabase.from("chat_messages").insert({
        user_id: user.id,
        thread_id: finalThreadId,
        role: "user",
        content: userContent
      });
      if (error) throw error;
    }

    if (fileIds.length) {
      const { error } = await supabase.from("files").update({ thread_id: finalThreadId }).in("id", fileIds).eq("user_id", user.id);
      if (error) throw error;
    }

    if (!process.env.GROQ_API_KEY?.trim()) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is not configured. The model cannot reply.", threadId: finalThreadId },
        { status: 503 }
      );
    }

    const [historyResult, threadFilesResult, mentionedFilesResult] = await Promise.all([
      supabase
        .from("chat_messages")
        .select("role, content")
        .eq("thread_id", finalThreadId)
        .order("created_at", { ascending: false })
        .limit(16),
      supabase
        .from("files")
        .select("id, name, extracted_text, extraction_status")
        .eq("thread_id", finalThreadId)
        .eq("user_id", user.id),
      fileIds.length
        ? supabase.from("files").select("id, name, extracted_text, extraction_status").in("id", fileIds).eq("user_id", user.id)
        : Promise.resolve({ data: [] as FileRow[], error: null })
    ]);
    if (historyResult.error) throw historyResult.error;
    if (threadFilesResult.error) throw threadFilesResult.error;
    if (mentionedFilesResult.error) throw mentionedFilesResult.error;

    const files = new Map<string, FileRow>();
    for (const file of [...((threadFilesResult.data || []) as FileRow[]), ...((mentionedFilesResult.data || []) as FileRow[])]) {
      files.set(file.id, file);
    }
    const fileContext = buildFileContext([...files.values()]);

    const history = ((historyResult.data || []) as Array<{ role: "user" | "assistant"; content: string }>).reverse();
    const baseMessages: GroqChatMessage[] = [
      {
        role: "system",
        content: [
          `You are a careful assistant in a chat. The selected Groq model id is ${model}. You are not a model owned by this product, and you must not claim another name.`,
          "Answer directly. Use attached file text when it is relevant. If a file could not be read, say so. Do not invent file contents or web sources.",
          "When you create a note or a flashcard deck, include the path the tool returns so the person can open it.",
          "Cite web results with the bracket ids you were given, like [1], and only those ids."
        ].join(" ")
      },
      ...(fileContext ? [{ role: "system" as const, content: fileContext }] : []),
      ...history.map((message) => ({ role: message.role, content: removeEmDashes(message.content) }))
    ];

    const artifacts: Artifact[] = [];
    const webCitations: Record<string, Citation> = {};
    const toolCtx: ToolContext = { supabase, userId: user.id, threadId: finalThreadId, artifacts, webCitations };
    let streamMessages = baseMessages;

    try {
      const guide: GroqChatMessage = {
        role: "system",
        content:
          "You can search the live web, create a note, or create flashcards. Read attached files from the conversation context. Do not search a workspace of projects. After tools, answer in plain prose."
      };
      const decision = await callGroqWithTools(model, [baseMessages[0], guide, ...baseMessages.slice(1)], toolDefinitions, request.signal);
      if (decision.tool_calls?.length) {
        const toolMessages: GroqChatMessage[] = [
          baseMessages[0],
          guide,
          ...baseMessages.slice(1),
          { role: "assistant", content: decision.content ?? "", tool_calls: decision.tool_calls }
        ];
        for (const call of decision.tool_calls) {
          let result: string;
          try {
            const args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
            result = await executeTool(call.function.name, args, toolCtx);
          } catch (error) {
            result = `Error running ${call.function.name}: ${serializeError(error)}`;
          }
          toolMessages.push({ role: "tool", tool_call_id: call.id, content: result });
        }
        streamMessages = toolMessages;
      }
    } catch (error) {
      if (request.signal.aborted) {
        return NextResponse.json({ error: "Stopped.", threadId: finalThreadId }, { status: 499 });
      }
      const message = serializeError(error);
      if (message.includes("GROQ_API_KEY")) {
        return NextResponse.json({ error: message, threadId: finalThreadId }, { status: 503 });
      }
      console.error("[chat] tool call failed", message);
    }

    let upstream: Response;
    try {
      upstream = await openGroqStream(model, streamMessages, request.signal);
    } catch (error) {
      if (request.signal.aborted) {
        return NextResponse.json({ error: "Stopped.", threadId: finalThreadId }, { status: 499 });
      }
      return NextResponse.json({ error: serializeError(error), threadId: finalThreadId }, { status: 502 });
    }

    const encoder = new TextEncoder();
    const userId = user.id;
    let persisted = false;
    let answer = "";

    async function persist() {
      if (persisted) return;
      persisted = true;
      const trimmed = removeEmDashes(answer).trim();
      if (!trimmed) return;
      const used = Array.from(new Set(Array.from(trimmed.matchAll(/\[(\d+)\]/g), (match) => match[1])));
      const citations = used.map((marker) => webCitations[marker]).filter((item): item is Citation => Boolean(item));
      const { error } = await supabase.from("chat_messages").insert({
        user_id: userId,
        thread_id: finalThreadId,
        role: "assistant",
        content: trimmed,
        citations,
        artifacts
      });
      if (error) console.error("[chat] persist assistant message failed", error.message);
      await supabase.from("chat_threads").update({ updated_at: new Date().toISOString(), model }).eq("id", finalThreadId);
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          answer = await readGroqStream(
            upstream,
            (token) => {
              controller.enqueue(encoder.encode(token));
            },
            request.signal
          );
        } catch (error) {
          if (!request.signal.aborted) console.error("[chat] stream failed", serializeError(error));
        } finally {
          try {
            await persist();
          } catch (error) {
            console.error("[chat] persist threw", serializeError(error));
          }
          controller.close();
        }
      },
      async cancel() {
        await persist();
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Thread-Id": finalThreadId,
        "X-AI-Model": model
      }
    });
  } catch (error) {
    const message = serializeError(error);
    console.error("[chat]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildFileContext(files: FileRow[]) {
  if (!files.length) return "";
  const parts = files.map((file) => {
    if (file.extraction_status === "ready" && file.extracted_text?.trim()) {
      return `File "${file.name}" (readable text):\n${file.extracted_text.slice(0, 16000)}`;
    }
    const reason =
      file.extraction_status === "unsupported"
        ? "This file type cannot be read as text."
        : "No text could be read from this file.";
    return `File "${file.name}" could not be read. ${reason}`;
  });
  return `Files attached to this conversation:\n\n${parts.join("\n\n---\n\n")}`.slice(0, 48000);
}
