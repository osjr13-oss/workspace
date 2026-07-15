import { NextResponse } from "next/server";
import { reserveAiRequest } from "@/lib/ai-usage";
import { executeTool, toolDefinitions } from "@/lib/ai-tools";
import { callGroqWithTools, streamGroq, type GroqChatMessage } from "@/lib/groq";
import { searchChunksFullText, searchProjectChunks, type RetrievedChunk } from "@/lib/retrieve-context";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import type { Citation } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as { message?: string; threadId?: string | null; projectId?: string | null };
    if (!body.message?.trim()) return NextResponse.json({ error: "Message is required" }, { status: 400 });

    let threadId = body.threadId || null;
    let projectId = body.projectId || null;

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
      model: process.env.GROQ_MODEL || "groq",
      input_chars: body.message.length
    });
    if (limitError) return NextResponse.json({ error: limitError }, { status: 429 });

    if (!threadId) {
      const title = body.message.slice(0, 72);
      const { data, error } = await supabase
        .from("chat_threads")
        .insert({ user_id: user.id, project_id: projectId, title })
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
      loadProjectContext(supabase, projectId, body.message)
    ]);

    const messages = [
      {
        role: "system" as const,
        content:
          "You are Selrano, an AI built into an academic workspace. Be direct and conversational — answer the question immediately without preamble, intros, or sign-offs. Never start with 'I can help with...' or list your own capabilities. Never use bullet points or numbered lists unless the user explicitly asks for them or the content is genuinely list-like. Write in plain prose. Keep responses tight — say what needs to be said, nothing more. If the user's project context is relevant, use it naturally without announcing that you're doing so. If you don't know something, say so plainly. When project context is provided, treat it as the source of truth for facts about the user's own notes and files — do not add claims about that material beyond what the context supports, even if you know more generally, and if the context doesn't cover the question, say so plainly instead of guessing. This grounding rule only applies to claims about the user's own material; answer unrelated general questions normally. When you state a fact drawn from the project context, add the matching reference id in brackets right after the claim, like this: <claim> [1]. Only cite ids that were actually provided. Do not invent citations."
      },
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
      ...((historyResult.data || []) as Array<{ role: "user" | "assistant"; content: string }>).map((message) => ({
        role: message.role,
        content: message.content
      }))
    ];

    if (!threadId) return NextResponse.json({ error: "Could not resolve conversation" }, { status: 500 });
    const finalThreadId = threadId;

    const streamMessages = shouldUseWorkspaceTools(body.message)
      ? await prepareToolMessages(messages, {
        supabase,
        userId: user.id,
        projectId
      })
      : messages;

    const encoder = new TextEncoder();

    // Stream the model's answer to the browser token-by-token. Once the stream
    // finishes we persist the complete assistant message and bump the thread.
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let answer = "";
        try {
          await streamGroq(streamMessages, {
            temperature: 0.6,
            onToken: (token) => {
              answer += token;
              controller.enqueue(encoder.encode(token));
            }
          });
        } catch (error) {
          console.error("[chat] stream failed", serializeError(error), error);
          if (!answer) {
            answer = "Sorry — something went wrong generating that response. Please try again.";
            controller.enqueue(encoder.encode(answer));
          }
        } finally {
          // Persist before closing so the browser's post-stream reload is
          // guaranteed to find the same complete (or partial) assistant reply.
          // Wrapped so a persistence failure (network blip, transient DB
          // error) can never prevent controller.close() below — otherwise
          // the stream never signals completion and the client hangs
          // waiting for more data that will never arrive.
          try {
            if (answer) {
              const usedMarkers = Array.from(new Set(Array.from(answer.matchAll(/\[(\d+)\]/g), (match) => match[1])));
              const citations = usedMarkers
                .map((marker) => context.citations[marker])
                .filter((citation): citation is Citation => Boolean(citation));

              const { error: assistantMessageError } = await supabase.from("chat_messages").insert({
                user_id: user.id,
                thread_id: finalThreadId,
                role: "assistant",
                content: answer.trim(),
                citations
              });
              if (assistantMessageError) {
                console.error("[chat] persist assistant message failed", assistantMessageError);
              }
              await supabase.from("chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", finalThreadId);
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
        "X-Thread-Id": finalThreadId
      }
    });
  } catch (error) {
    const message = serializeError(error);
    console.error("[chat]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function shouldUseWorkspaceTools(message: string): boolean {
  const mentionsOwnedMaterial = /\b(?:my|this)\s+(?:notes?|files?|documents?|materials?|workspace|project)\b/i;
  const requestsCreation = /\b(?:create|make|draft|save|add|generate|build|turn)\b[\s\S]{0,80}\b(?:notes?|flashcards?|study cards?|decks?)\b/i;
  const requestsSearch = /\b(?:search|find|look up|look for)\b[\s\S]{0,80}\b(?:notes?|files?|documents?|materials?|workspace|project)\b/i;
  return mentionsOwnedMaterial.test(message) || requestsCreation.test(message) || requestsSearch.test(message);
}

async function prepareToolMessages(
  baseMessages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  ctx: { supabase: Awaited<ReturnType<typeof getAuthenticatedUser>>["supabase"]; userId: string; projectId: string | null }
): Promise<GroqChatMessage[]> {
  const actionGuide = {
    role: "system" as const,
    content:
      "You can take actions in the user's workspace with the provided tools: search their notes and files, create a note, or create a flashcard deck. When the user asks you to do one of these, call the matching tool rather than describing how. Only create content when the user clearly asks for it. After using tools, briefly confirm what you did in plain prose."
  };

  const toolMessages: GroqChatMessage[] = [baseMessages[0], actionGuide, ...baseMessages.slice(1)];
  let reply;
  try {
    reply = await callGroqWithTools(toolMessages, toolDefinitions, { temperature: 0.4 });
  } catch (error) {
    // A malformed or unavailable tool request should never prevent a normal
    // streamed answer from reaching the user.
    console.error("[chat] tool call failed, falling back to streamed answer", serializeError(error));
    return baseMessages;
  }

  if (!reply.tool_calls?.length) return baseMessages;

  toolMessages.push({ role: "assistant", content: reply.content ?? "", tool_calls: reply.tool_calls });
  for (const call of reply.tool_calls) {
    let result: string;
    try {
      const args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
      result = await executeTool(call.function.name, args, ctx);
    } catch (error) {
      result = `Error running ${call.function.name}: ${serializeError(error)}`;
    }
    toolMessages.push({ role: "tool", tool_call_id: call.id, content: result });
  }

  return toolMessages;
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
  // treat it as strong evidence either — see the grounding instruction above.
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
