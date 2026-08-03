import { NextResponse } from "next/server";
import { reserveAiRequest } from "@/lib/ai-usage";
import { executeTool, toolDefinitions, type ToolContext } from "@/lib/ai-tools";
import { configuredAiModel, streamAi } from "@/lib/ai";
import { extractMemories, retrieveMemories } from "@/lib/content-memory";
import { callGroqWithTools, type GroqChatMessage } from "@/lib/groq";
import { searchChunksFullText, searchProjectChunks, type RetrievedChunk } from "@/lib/retrieve-context";
import { serializeError } from "@/lib/serialize-error";
import { ingestUserStyle } from "@/lib/style-profile";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { removeEmDashes } from "@/lib/text";
import type { Citation } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as {
      message?: string;
      threadId?: string | null;
      projectId?: string | null;
      editMessageId?: string;
      regenerateMessageId?: string;
    };
    let userContent = removeEmDashes(body.message || "").trim();

    let threadId = body.threadId || null;
    let projectId = body.projectId || null;
    let editTarget:
      | { id: string; thread_id: string; created_at: string }
      | null = null;
    let regenerateTarget:
      | { id: string; thread_id: string; created_at: string }
      | null = null;

    if (body.editMessageId) {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, thread_id, role, created_at")
        .eq("id", body.editMessageId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data || data.role !== "user") {
        return NextResponse.json({ error: "Editable message not found" }, { status: 404 });
      }
      if (!userContent) {
        return NextResponse.json({ error: "Message is required" }, { status: 400 });
      }
      editTarget = data;
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
        return NextResponse.json({ error: "Regeneratable message not found" }, { status: 404 });
      }

      const { data: previousUser, error: previousUserError } = await supabase
        .from("chat_messages")
        .select("content")
        .eq("thread_id", data.thread_id)
        .eq("user_id", user.id)
        .eq("role", "user")
        .lt("created_at", data.created_at)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (previousUserError) throw previousUserError;
      if (!previousUser) {
        return NextResponse.json({ error: "No user message was found to regenerate from" }, { status: 400 });
      }

      regenerateTarget = data;
      threadId = data.thread_id;
      userContent = removeEmDashes(previousUser.content || "").trim();
    }

    if (!userContent) return NextResponse.json({ error: "Message is required" }, { status: 400 });

    if (threadId) {
      const { data: thread, error: threadError } = await supabase
        .from("chat_threads")
        .select("id, project_id")
        .eq("id", threadId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (threadError) throw threadError;
      if (!thread) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      projectId = thread.project_id;
    } else if (projectId) {
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (projectError) throw projectError;
      if (!project) return NextResponse.json({ error: "Project not found" }, { status: 400 });
    }

    const limitError = await reserveAiRequest(supabase, user.id, "chat", {
      model: configuredAiModel(),
      input_chars: userContent.length
    });
    if (limitError) return NextResponse.json({ error: limitError }, { status: 429 });

    if (editTarget) {
      const { error: updateError } = await supabase
        .from("chat_messages")
        .update({ content: userContent })
        .eq("id", editTarget.id)
        .eq("user_id", user.id);
      if (updateError) throw updateError;

      const { error: deleteError } = await supabase
        .from("chat_messages")
        .delete()
        .eq("thread_id", editTarget.thread_id)
        .eq("user_id", user.id)
        .gt("created_at", editTarget.created_at);
      if (deleteError) throw deleteError;
    }

    if (regenerateTarget) {
      const { error: deleteError } = await supabase
        .from("chat_messages")
        .delete()
        .eq("thread_id", regenerateTarget.thread_id)
        .eq("user_id", user.id)
        .gte("created_at", regenerateTarget.created_at);
      if (deleteError) throw deleteError;
    }

    if (!threadId) {
      const title = userContent.slice(0, 72);
      const { data, error } = await supabase
        .from("chat_threads")
        .insert({ user_id: user.id, project_id: projectId, title })
        .select("*")
        .single();
      if (error) throw error;
      threadId = data.id;
    }

    if (!editTarget && !regenerateTarget) {
      const { error: userMessageError } = await supabase.from("chat_messages").insert({
        user_id: user.id,
        thread_id: threadId,
        role: "user",
        content: userContent
      });
      if (userMessageError) throw userMessageError;
    }

    const [historyResult, context, styleProfile, memories] = await Promise.all([
      supabase.from("chat_messages").select("role, content").eq("thread_id", threadId).order("created_at", { ascending: false }).limit(16),
      loadProjectContext(supabase, projectId, userContent),
      ingestUserStyle(supabase, user.id, userContent),
      retrieveMemories(supabase, user.id, userContent)
    ]);

    const messages = [
      {
        role: "system" as const,
        content:
          "You are Selrano, an adaptive AI workspace assistant. Answer directly without preamble or sign-offs. Never start by listing your capabilities. Use bullets or numbered lists only when requested or when the content is genuinely list-like. Write in plain prose and keep responses focused. Never use an em dash. If project context is relevant, use it naturally without announcing that you are doing so. Treat project context as the source of truth for facts about the user's own notes and files. Do not add unsupported claims about those materials. If the context does not cover the question, say so plainly instead of guessing. This grounding rule applies only to the user's own material. Answer unrelated general questions normally. When stating a fact drawn from project context, add the matching reference id in brackets immediately after the claim, like this: <claim> [1]. Cite only ids that were provided."
      },
      ...(styleProfile?.styleDirective
        ? [
            {
              role: "system" as const,
              content: `Communication preferences learned from the user: ${styleProfile.styleDirective}`
            }
          ]
        : []),
      ...(memories.length
        ? [
            {
              role: "system" as const,
              content:
                "Durable personal context learned from earlier conversations follows. Use it only when relevant. It is not source evidence and must never be cited as project material.\n" +
                memories.map((memory) => `- ${memory}`).join("\n")
            }
          ]
        : []),
      ...(context.text
        ? [
            {
              role: "system" as const,
              content: `Project context:\n${context.text}`
            }
          ]
        : projectId
          ? [
              {
                role: "system" as const,
                content:
                  "No matching project context was found for this question. If the user is asking about their own notes, files, or materials, say plainly that nothing relevant was found in their workspace rather than guessing or using general knowledge."
              }
            ]
          : []),
      ...([
        ...((historyResult.data || []) as Array<{
          role: "user" | "assistant";
          content: string;
        }>)
      ]
        .reverse()
        .map((message) => ({
          role: message.role,
          content: removeEmDashes(message.content)
        })))
    ];

    if (!threadId) return NextResponse.json({ error: "Could not resolve conversation" }, { status: 500 });
    const finalThreadId = threadId;

    const { messages: streamMessages, webCitations } = await prepareToolMessages(messages, {
      supabase,
      userId: user.id,
      projectId,
      citationOffset: Object.keys(context.citations).length
    });
    const allCitations = { ...context.citations, ...webCitations };

    const encoder = new TextEncoder();

    // Stream the model's answer to the browser token-by-token. Once the stream
    // finishes we persist the complete assistant message and bump the thread.
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let answer = "";
        try {
          await streamAi(streamMessages, {
            temperature: 0.6,
            onToken: (token) => {
              const normalized = removeEmDashes(token);
              answer += normalized;
              controller.enqueue(encoder.encode(normalized));
            }
          });
        } catch (error) {
          console.error("[chat] stream failed", serializeError(error), error);
          if (!answer) {
            answer = "Sorry, something went wrong generating that response. Please try again.";
            controller.enqueue(encoder.encode(answer));
          }
        } finally {
          // Persist before closing so the browser's post-stream reload is
          // guaranteed to find the same complete (or partial) assistant reply.
          // Wrapped so a persistence failure (network blip, transient DB
          // error) can never prevent controller.close() below. Otherwise
          // the stream never signals completion and the client hangs
          // waiting for more data that will never arrive.
          try {
            if (answer) {
              const usedMarkers = Array.from(new Set(Array.from(answer.matchAll(/\[(\d+)\]/g), (match) => match[1])));
              const citations = usedMarkers
                .map((marker) => allCitations[marker])
                .filter((citation): citation is Citation => Boolean(citation));

              const { error: assistantMessageError } = await supabase.from("chat_messages").insert({
                user_id: user.id,
                thread_id: finalThreadId,
                role: "assistant",
                content: removeEmDashes(answer.trim()),
                citations
              });
              if (assistantMessageError) {
                console.error("[chat] persist assistant message failed", assistantMessageError);
              }
              await supabase.from("chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", finalThreadId);
              await extractMemories(supabase, user.id, userContent, answer);
            }
          } catch (persistError) {
            console.error("[chat] persist assistant message threw", serializeError(persistError));
          } finally {
            controller.close();
          }
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Thread-Id": finalThreadId,
        "X-AI-Model": configuredAiModel()
      }
    });
  } catch (error) {
    const message = serializeError(error);
    console.error("[chat]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function prepareToolMessages(
  baseMessages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  ctx: {
    supabase: Awaited<ReturnType<typeof getAuthenticatedUser>>["supabase"];
    userId: string;
    projectId: string | null;
    citationOffset: number;
  }
): Promise<{ messages: GroqChatMessage[]; webCitations: Record<string, Citation> }> {
  const actionGuide = {
    role: "system" as const,
    content:
      "You can take actions with the provided tools: search the user's notes and files, search the live web, create a note, or create a flashcard deck. Call web_search whenever you are not confident your training data is current enough to answer well, such as news, prices, recent releases, or anything that may have changed since your training cutoff. Call the workspace tools only when the user clearly asks about their own materials or asks you to create something. After using tools, answer normally in plain prose. Cite web search results using the bracketed reference id each result provides, like this: <claim> [1]. Cite only ids that were given to you."
  };

  const toolMessages: GroqChatMessage[] = [baseMessages[0], actionGuide, ...baseMessages.slice(1)];
  const webCitations: Record<string, Citation> = {};
  const toolCtx: ToolContext = {
    supabase: ctx.supabase,
    userId: ctx.userId,
    projectId: ctx.projectId,
    webCitations,
    citationOffset: ctx.citationOffset
  };

  let reply;
  try {
    reply = await callGroqWithTools(toolMessages, toolDefinitions, { temperature: 0.4 });
  } catch (error) {
    // A malformed or unavailable tool request should never prevent a normal
    // streamed answer from reaching the user.
    console.error("[chat] tool call failed, falling back to streamed answer", serializeError(error));
    return { messages: baseMessages, webCitations };
  }

  if (!reply.tool_calls?.length) return { messages: baseMessages, webCitations };

  toolMessages.push({ role: "assistant", content: reply.content ?? "", tool_calls: reply.tool_calls });
  for (const call of reply.tool_calls) {
    let result: string;
    try {
      const args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
      result = await executeTool(call.function.name, args, toolCtx);
    } catch (error) {
      result = `Error running ${call.function.name}: ${serializeError(error)}`;
    }
    toolMessages.push({ role: "tool", tool_call_id: call.id, content: result });
  }

  return { messages: toolMessages, webCitations };
}

type FallbackChunkRow = {
  id: string;
  content: string;
  file_id: string;
  page_number: number | null;
  char_start: number | null;
  char_end: number | null;
  files: { name: string } | null;
};

async function loadProjectContext(
  supabase: Awaited<ReturnType<typeof getAuthenticatedUser>>["supabase"],
  projectId: string | null,
  query?: string
): Promise<{ text: string; citations: Record<string, Citation> }> {
  if (!projectId) return { text: "", citations: {} };

  const trimmedQuery = query?.trim() || "";
  const semanticChunks = trimmedQuery ? await searchProjectChunks(supabase, projectId, trimmedQuery, 6) : [];

  // Best available file retrieval: vector search (if embeddings are configured) →
  // free full-text keyword search → the project's first chunks.
  const ftsChunks =
    !semanticChunks.length && trimmedQuery
      ? await searchChunksFullText(supabase, trimmedQuery, { projectId, limit: 6 })
      : [];

  const needsFallbackChunks = !semanticChunks.length && !ftsChunks.length;

  const [notes, fallbackChunks, cards] = await Promise.all([
    supabase.from("notes").select("title, content").eq("project_id", projectId).order("updated_at", { ascending: false }).limit(6),
    needsFallbackChunks
      ? supabase
          .from("file_chunks")
          .select("id, content, file_id, page_number, char_start, char_end, files(name)")
          .eq("project_id", projectId)
          .order("chunk_index")
          .limit(10)
      : Promise.resolve({ data: [] as FallbackChunkRow[] }),
    supabase.from("flashcards").select("front, back").eq("project_id", projectId).order("updated_at", { ascending: false }).limit(12)
  ]);

  // Ranked hits (semantic or full-text) are treated as strong evidence; the
  // fallback path (arbitrary first chunks of a file, used only when neither
  // ranked search found anything) is labeled unranked so the model doesn't
  // treat it as strong evidence either. See the grounding instruction above.
  const rankedChunks: RetrievedChunk[] = semanticChunks.length ? semanticChunks : ftsChunks;
  const fallbackSources: RetrievedChunk[] = rankedChunks.length
    ? []
    : ((fallbackChunks.data || []) as FallbackChunkRow[]).map((row) => ({
        content: row.content,
        chunkId: row.id,
        fileId: row.file_id,
        fileName: row.files?.name || "Untitled file",
        pageNumber: row.page_number,
        charStart: row.char_start,
        charEnd: row.char_end
      }));

  const citations: Record<string, Citation> = {};
  const fileExcerpts = (rankedChunks.length ? rankedChunks : fallbackSources).map((chunk, index) => {
    const marker = String(index + 1);
    citations[marker] = {
      marker,
      fileId: chunk.fileId,
      fileName: chunk.fileName,
      pageNumber: chunk.pageNumber,
      charStart: chunk.charStart,
      charEnd: chunk.charEnd
    };
    const location = chunk.pageNumber ? `, page ${chunk.pageNumber}` : "";
    const label = rankedChunks.length
      ? `[${marker}] File excerpt from "${chunk.fileName}"${location}:`
      : `[${marker}] File excerpt (unranked, just the start of a file, may not relate to this question) from "${chunk.fileName}"${location}:`;
    return `${label}\n${chunk.content}`;
  });

  const parts = [
    ...((notes.data || []) as Array<{ title: string; content: string }>).map((note) => `Note: ${note.title}\n${note.content.slice(0, 1800)}`),
    ...fileExcerpts,
    ...((cards.data || []) as Array<{ front: string; back: string }>).map((card) => `Flashcard: ${card.front}\nAnswer: ${card.back}`)
  ];

  return { text: parts.join("\n\n---\n\n").slice(0, 14000), citations };
}
