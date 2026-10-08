import { after, NextResponse } from "next/server";
import { refundAiRequest, reserveAiRequest } from "@/lib/ai-usage";
import { executeTool, toolDefinitions, type ToolContext } from "@/lib/ai-tools";
import { configuredAiModel, streamAi } from "@/lib/ai";
import { extractMemories, maybeBootstrapMemories, retrieveMemories } from "@/lib/content-memory";
import { GroqHttpError, streamGroqWithTools, type GroqChatMessage } from "@/lib/groq";
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

    // Ownership checks and the quota reservation do not depend on each other.
    const [ownership, limitError] = await Promise.all([
      resolveConversation(supabase, user.id, threadId, projectId),
      reserveAiRequest(supabase, user.id, "chat", { model: configuredAiModel(), input_chars: userContent.length })
    ]);
    if ("response" in ownership) return ownership.response;
    projectId = ownership.projectId;
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

    let createdThread = false;
    if (!threadId) {
      const title = userContent.slice(0, 72);
      const { data, error } = await supabase
        .from("chat_threads")
        .insert({ user_id: user.id, project_id: projectId, title })
        .select("*")
        .single();
      if (error) throw error;
      threadId = data.id;
      createdThread = true;
    }
    if (!threadId) return NextResponse.json({ error: "Could not resolve conversation" }, { status: 500 });
    const finalThreadId = threadId;
    const isNewMessage = !editTarget && !regenerateTarget;
    let savedUserMessageId: string | null = null;

    // Everything the prompt needs is loaded at the same time, including saving
    // the new message. History may or may not already contain that message
    // depending on which finishes first, so it is normalised below.
    const [historyResult, context, styleProfile, memories] = await Promise.all([
      supabase
        .from("chat_messages")
        .select("role, content")
        .eq("thread_id", finalThreadId)
        .order("created_at", { ascending: false })
        .limit(HISTORY_ROWS),
      loadProjectContext(supabase, projectId, userContent),
      ingestUserStyle(supabase, user.id, userContent),
      retrieveMemories(supabase, user.id, userContent),
      isNewMessage
        ? supabase
            .from("chat_messages")
            .insert({ user_id: user.id, thread_id: finalThreadId, role: "user", content: userContent })
            .select("id")
            .single()
            .then(({ data, error }) => {
              if (error) throw error;
              savedUserMessageId = data.id;
            })
        : Promise.resolve()
    ]).then(([history, ctx, style, mem]) => [history, ctx, style, mem] as const);

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
      ...buildHistory((historyResult.data || []) as HistoryRow[], isNewMessage ? userContent : null)
    ];

    const webCitations: Record<string, Citation> = {};
    const toolCtx: ToolContext = {
      supabase,
      userId: user.id,
      projectId,
      webCitations,
      citationOffset: Object.keys(context.citations).length
    };
    const toolMessages: GroqChatMessage[] = [messages[0], ACTION_GUIDE, ...messages.slice(1)];

    const encoder = new TextEncoder();
    const startedAt = Date.now();
    let clientGone = false;
    let resolveFirstOutput!: (outcome: FirstOutcome) => void;
    const firstOutput = new Promise<FirstOutcome>((resolve) => {
      resolveFirstOutput = resolve;
    });

    // Generation starts immediately and runs to completion even if the browser
    // goes away, so a finished answer is always saved. Output is held until the
    // first words are ready so a failure can still be reported as a clean error.
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        void generate(controller);
      },
      cancel() {
        clientGone = true;
      }
    });

    async function generate(controller: ReadableStreamDefaultController<Uint8Array>) {
      let answer = "";
      let held = "";
      let holding = true;
      let firstTokenAt = 0;
      let firstVisibleAt = 0;
      let failure: unknown = null;
      let toolsUsed = 0;

      const push = (text: string) => {
        if (!text) return;
        answer += text;
        if (!firstVisibleAt) {
          firstVisibleAt = Date.now();
          resolveFirstOutput({ type: "text" });
        }
        if (clientGone) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          clientGone = true;
        }
      };

      // Models often write a short lead-in ("Let me look that up") before a tool
      // call. Hold back the opening words until it is clear whether a tool call
      // follows, so that lead-in never flashes on screen and then disappears.
      const release = () => {
        holding = false;
        const text = held;
        held = "";
        push(text);
      };
      const onToken = (token: string) => {
        if (!holding) return push(token);
        if (!firstTokenAt) firstTokenAt = Date.now();
        held += token;
        if (held.length >= HOLD_CHARS || Date.now() - firstTokenAt >= HOLD_MS) release();
      };
      const onToolCallStart = () => {
        if (holding) {
          held = "";
          holding = false;
        }
      };
      const streamPlain = (msgs: GroqChatMessage[]) =>
        streamAi(msgs, { temperature: 0.6, onToken: (token) => push(removeEmDashes(token)) });

      try {
        let first: Awaited<ReturnType<typeof streamGroqWithTools>> | null = null;
        try {
          first = await streamGroqWithTools(toolMessages, toolDefinitions, {
            temperature: 0.6,
            onToken,
            onToolCallStart
          });
        } catch (error) {
          // A malformed tool request should never prevent a normal answer, as
          // long as nothing has been shown yet. Capacity problems are different:
          // every model and wait has already been tried, so retrying only delays the error.
          if (answer) throw error;
          if (error instanceof GroqHttpError && (error.rateLimited || error.status >= 500)) throw error;
          held = "";
          holding = false;
          console.error("[chat] tool-enabled stream failed, retrying without tools", serializeError(error));
        }
        if (holding) release();

        if (first && first.toolCalls.length) {
          toolsUsed = first.toolCalls.length;
          toolMessages.push({ role: "assistant", content: first.text || null, tool_calls: first.toolCalls });
          const results: string[] = [];
          for (const call of first.toolCalls) {
            let result: string;
            try {
              const args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
              result = await executeTool(call.function.name, args, toolCtx);
            } catch (error) {
              result = `Error running ${call.function.name}: ${serializeError(error)}`;
            }
            results.push(result);
            toolMessages.push({ role: "tool", tool_call_id: call.id, content: result });
          }
          if (answer) push("\n\n");
          const before = answer.length;
          try {
            await streamPlain(toolMessages);
          } catch (error) {
            console.error("[chat] answer after tools failed", serializeError(error));
          }
          if (answer.length === before) {
            // Never leave a finished action without a reply.
            push(
              results.length && results.every((result) => /^(Created|Could not)/.test(result))
                ? results.join("\n")
                : "I looked into that but could not put together an answer. Please try again."
            );
          }
        } else if (!answer.trim()) {
          // The model said nothing. Ask once more without tools before giving up.
          console.warn("[chat] empty model reply, retrying without tools");
          await streamPlain(messages);
        }
      } catch (error) {
        failure = error;
        console.error("[chat] stream failed", serializeError(error), error);
      }

      if (!answer.trim()) {
        resolveFirstOutput({ type: "failure", error: failure });
      } else if (failure) {
        push("\n\nThe response was cut short. Try regenerating it.");
      }

      // Persist before closing so the browser's reload is guaranteed to find the
      // same complete (or partial) reply. A failure here must never stop the
      // stream from closing.
      try {
        if (answer.trim()) {
          const allCitations = { ...context.citations, ...webCitations };
          const usedMarkers = Array.from(new Set(Array.from(answer.matchAll(/\[(\d+)\]/g), (match) => match[1])));
          const citations = usedMarkers
            .map((marker) => allCitations[marker])
            .filter((citation): citation is Citation => Boolean(citation));

          const { error: assistantMessageError } = await supabase.from("chat_messages").insert({
            user_id: user!.id,
            thread_id: finalThreadId,
            role: "assistant",
            content: removeEmDashes(answer.trim()),
            citations
          });
          if (assistantMessageError) console.error("[chat] persist assistant message failed", assistantMessageError);

          console.info(
            "[chat] reply",
            JSON.stringify({
              model: configuredAiModel(),
              ttftMs: firstVisibleAt ? firstVisibleAt - startedAt : null,
              totalMs: Date.now() - startedAt,
              chars: answer.length,
              tools: toolsUsed,
              clientGone,
              partial: Boolean(failure)
            })
          );
        }
      } catch (persistError) {
        console.error("[chat] persist assistant message threw", serializeError(persistError));
      }

      try {
        controller.close();
      } catch {
        // Already closed or cancelled by the browser.
      }

      // Bookkeeping that must never delay the reply, including the model calls
      // for memory, runs once the response is done.
      const finalAnswer = answer;
      runAfterResponse(async () => {
        if (!finalAnswer.trim()) {
          await refundAiRequest(user!.id, "chat");
          return;
        }
        await supabase.from("chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", finalThreadId);
        await extractMemories(supabase, user!.id, userContent, finalAnswer);
        await maybeBootstrapMemories(supabase, user!.id);
      });
    }

    const outcome = await firstOutput;
    if (outcome.type === "failure") {
      // The turn produced nothing, so leave no trace of it: the message the
      // user just sent (and the thread, if this request created it) is removed
      // and the page puts their text back in the box.
      try {
        if (savedUserMessageId) {
          await supabase.from("chat_messages").delete().eq("id", savedUserMessageId).eq("user_id", user.id);
        }
        if (createdThread) {
          await supabase.from("chat_threads").delete().eq("id", finalThreadId).eq("user_id", user.id);
        }
      } catch (rollbackError) {
        console.error("[chat] rollback failed", serializeError(rollbackError));
      }
      return NextResponse.json({ error: describeFailure(outcome.error) }, { status: failureStatus(outcome.error) });
    }

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

const ACTION_GUIDE = {
  role: "system" as const,
  content:
    "Tools: search the user's notes and files, search the live web, create a note, create a flashcard deck. Use web_search when the answer may have changed since your training (news, prices, releases). Use the workspace tools only when the user asks about their own materials or asks you to create something. Do not write any text before calling a tool. After tools, answer in plain prose and cite web results with their bracketed id, like <claim> [1]. Cite only ids you were given."
};

// Groq limits tokens per minute, so every request is kept lean.
const HISTORY_ROWS = 12;
const HISTORY_CHAR_BUDGET = 8000;
const HISTORY_MESSAGE_MAX = 2000;
const CURRENT_MESSAGE_MAX = 12000;
const HOLD_CHARS = 160;
const HOLD_MS = 350;

type HistoryRow = { role: "user" | "assistant"; content: string };
type FirstOutcome = { type: "text" } | { type: "failure"; error: unknown };

function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

/**
 * Recent conversation, oldest first, kept within a character budget. When the
 * new message was saved in parallel it may already be the newest row; it is
 * removed and re-added so it appears exactly once, in full.
 */
function buildHistory(newestFirst: HistoryRow[], newMessage: string | null) {
  const rows = [...newestFirst];
  if (newMessage !== null && rows[0]?.role === "user" && removeEmDashes(rows[0].content).trim() === newMessage.trim()) {
    rows.shift();
  }

  const kept: Array<{ role: "user" | "assistant"; content: string }> = [];
  let used = 0;
  for (const row of rows) {
    const content = clip(removeEmDashes(row.content), HISTORY_MESSAGE_MAX);
    if (used + content.length > HISTORY_CHAR_BUDGET && kept.length) break;
    used += content.length;
    kept.push({ role: row.role, content });
  }
  kept.reverse();

  if (newMessage !== null) kept.push({ role: "user", content: clip(newMessage, CURRENT_MESSAGE_MAX) });
  return kept;
}

async function resolveConversation(
  supabase: Awaited<ReturnType<typeof getAuthenticatedUser>>["supabase"],
  userId: string,
  threadId: string | null,
  projectId: string | null
): Promise<{ projectId: string | null } | { response: NextResponse }> {
  if (threadId) {
    const { data: thread, error } = await supabase
      .from("chat_threads")
      .select("id, project_id")
      .eq("id", threadId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!thread) return { response: NextResponse.json({ error: "Conversation not found" }, { status: 404 }) };
    return { projectId: thread.project_id };
  }

  if (projectId) {
    const { data: project, error } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!project) return { response: NextResponse.json({ error: "Project not found" }, { status: 400 }) };
  }
  return { projectId };
}

function describeFailure(error: unknown) {
  if (error instanceof GroqHttpError && error.rateLimited) {
    return "Selrano's AI is handling a lot of requests right now. Wait a few seconds and send that again. This did not count against your limit.";
  }
  if (error) return "Selrano could not generate that response. Please try again. This did not count against your limit.";
  return "The AI returned an empty reply. Please try again. This did not count against your limit.";
}

function failureStatus(error: unknown) {
  return error instanceof GroqHttpError && error.rateLimited ? 429 : 502;
}

/** Runs work after the response is delivered, or right away if that is not possible. */
function runAfterResponse(work: () => Promise<void>) {
  const safe = async () => {
    try {
      await work();
    } catch (error) {
      console.error("[chat] post-response work failed", serializeError(error));
    }
  };
  try {
    after(safe);
  } catch {
    void safe();
  }
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

  return { text: parts.join("\n\n---\n\n").slice(0, 9000), citations };
}
