import { assessResearch, isOrdinaryHealthTurn, runResearch, researchFailure } from "@/lib/research";
import { coachSystemPrompt } from "@/lib/coach-prompt";
import { buildHealthContext } from "@/lib/health-context";
import { EVERYDAY_ANSWER_GUIDE } from "@/lib/chat-guidance";
import type { ResearchMetadata } from "@/lib/types";
import { after, NextResponse } from "next/server";
import { refundAiRequest, reserveAiRequest } from "@/lib/ai-usage";
import { executeTool, toolDefinitions, type ToolContext } from "@/lib/ai-tools";
import { configuredAiModel, streamAi, streamChatWithTools } from "@/lib/ai";
import { extractMemories, maybeBootstrapMemories, retrieveMemories } from "@/lib/content-memory";
import { GroqHttpError, type GroqChatMessage } from "@/lib/groq";
import { serializeError } from "@/lib/serialize-error";
import { ingestUserStyle } from "@/lib/style-profile";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { removeEmDashes } from "@/lib/text";
import type { ChatStreamEvent } from "@/lib/chat-stream";
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
      editMessageId?: string;
      regenerateMessageId?: string;
    };
    let userContent = removeEmDashes(body.message || "").trim();

    let threadId = body.threadId || null;
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

    // The ownership check and the quota reservation do not depend on each other.
    const [ownership, limitError] = await Promise.all([
      resolveConversation(supabase, user.id, threadId),
      reserveAiRequest(supabase, user.id, "chat", { model: configuredAiModel(true), input_chars: userContent.length })
    ]);
    if (ownership) return ownership;
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
        .insert({ user_id: user.id, title })
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
    let replyBoundaryAt = editTarget?.created_at || regenerateTarget?.created_at || "";

    // Everything the prompt needs is loaded at the same time, including saving
    // the new message. History may or may not already contain that message
    // depending on which finishes first, so it is normalised below.
    const [historyResult, styleProfile, memories, health] = await Promise.all([
      supabase
        .from("chat_messages")
        .select("role, content, research")
        .eq("thread_id", finalThreadId)
        .order("created_at", { ascending: false })
        .limit(HISTORY_ROWS),
      ingestUserStyle(supabase, user.id, userContent),
      retrieveMemories(supabase, user.id, userContent),
      buildHealthContext(supabase, user.id).catch((error) => {
        // The coach still answers without the user's data rather than not at all.
        console.error("[chat] health context failed", serializeError(error));
        return null;
      }),
      isNewMessage
        ? supabase
            .from("chat_messages")
            .insert({ user_id: user.id, thread_id: finalThreadId, role: "user", content: userContent })
            .select("id, created_at")
            .single()
            .then(({ data, error }) => {
              if (error) throw error;
              savedUserMessageId = data.id;
              replyBoundaryAt = data.created_at;
            })
        : Promise.resolve()
    ]).then(([history, style, mem, healthContext]) => [history, style, mem, healthContext] as const);

    const messages = [
      {
        role: "system" as const,
        content: coachSystemPrompt(health?.today || new Date().toISOString().slice(0, 10))
      },
      { role: "system" as const, content: EVERYDAY_ANSWER_GUIDE },
      ...(health ? [{ role: "system" as const, content: health.text }] : []),
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
                "Durable personal context learned from earlier conversations follows. Use it only when relevant. It is not source evidence and must never be cited.\n" +
                memories.map((memory) => `- ${memory}`).join("\n")
            }
          ]
        : []),
      ...buildHistory(((historyResult.data || []) as HistoryRow[]).map((row) => row.research?.groundingProvider === "google" ? { ...row, content: "[A Google-grounded answer was displayed here. Its content is excluded from automated transformations.]" } : row), isNewMessage ? userContent : null)
    ];

    const webCitations: Record<string, Citation> = {};
    const toolCtx: ToolContext = {
      supabase,
      userId: user.id,
      webCitations
    };
    const toolMessages: GroqChatMessage[] = [messages[0], ...messages.slice(1)];

    const encoder = new TextEncoder();
    const startedAt = Date.now();
    let clientGone = false;

    // The reply is a stream of JSON lines (ChatStreamEvent in lib/chat-stream.ts):
    // the conversation id, what Selrano is doing while it uses a tool, the
    // answer text as it arrives, or an error when nothing could be produced.
    // Generation runs to completion even if the browser goes away, so a
    // finished answer is always saved, unless the user pressed Stop
    // (/api/ai/chat/stop saves what they saw instead).
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
      let research: ResearchMetadata | null = null;

      const send = (event: ChatStreamEvent) => {
        if (clientGone) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          clientGone = true;
        }
      };

      const push = (text: string) => {
        if (!text) return;
        answer += text;
        if (!firstVisibleAt) firstVisibleAt = Date.now();
        send({ type: "text", text });
      };

      send({ type: "start", threadId: finalThreadId });
      // Find this turn's stopped reply even when a later user turn has already started.
      const savedReply = async () => {
        const { data, error } = await supabase.from("chat_messages").select("id, content")
          .eq("thread_id", finalThreadId).eq("user_id", user!.id).eq("role", "assistant")
          .gt("created_at", replyBoundaryAt).order("created_at", { ascending: true }).limit(1).maybeSingle();
        if (error) throw error;
        return data;
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
      let first: Awaited<ReturnType<typeof streamChatWithTools>> | null = null;
      let answerProvider: "openai" | "groq" | undefined;
      let answerModel: string | undefined;
      let fallbackReason: string | undefined;
      const streamPlain = async (msgs: GroqChatMessage[]) => {
        const result = await streamAi(msgs, {
          temperature: 0.6,
          provider: first?.provider,
          assistantContent: first?.assistantContent,
          tools: first?.toolCalls.length ? toolDefinitions : undefined,
          onToken: (token) => push(removeEmDashes(token))
        });
        answerProvider = result.provider;
        answerModel = result.model;
        fallbackReason = result.fallbackReason || fallbackReason;
        return result;
      };

      try {
        const researchSignal = AbortSignal.timeout(45_000);
        let route: Awaited<ReturnType<typeof assessResearch>> | null = null;
        let routed = true;
        try {
          route = isOrdinaryHealthTurn(userContent)
            ? null
            : await assessResearch(messages, AbortSignal.any([researchSignal, AbortSignal.timeout(8_000)]));
        } catch {
          routed = false;
          const result = researchFailure(researchSignal.aborted ? "timeout" : "routing_failed");
          research = result.research;
          send({ type: "research", research });
          push(result.text);
          console.info("[research]", JSON.stringify({ outcome: research.status, searches: 0, sourceCount: 0, durationMs: Date.now() - startedAt, fallbackCategory: "assessment" }));
        }
        if (route?.data.decision === "clarify") {
          research = { status: "clarification", sources: [], limitations: [], searches: 0, extractedPages: 0 };
          send({ type: "research", research });
          push(removeEmDashes(route.data.clarification));
        } else if (route?.data.decision === "search") {
          const result = await runResearch({ assessment: route.data, history: messages, signal: researchSignal,
            offset: 0, progress: (label) => send({ type: "status", label }) });
          research = result.research;
          for (const source of research.sources) webCitations[source.marker] = source;
          answerProvider = result.model?.provider;
          answerModel = result.model?.model;
          fallbackReason = result.model?.fallbackReason;
          send({ type: "research", research });
          // Reveal only the exact reviewed answer, in small chunks through the existing stream.
          for (const chunk of result.text.match(/[\s\S]{1,96}/g) || []) push(chunk);
        } else if (routed && !toolDefinitions.length) {
          await streamPlain(messages);
          if (!answer.trim()) {
            // The model said nothing. Ask once more before giving up.
            console.warn("[chat] empty model reply, retrying");
            await streamPlain(messages);
          }
        } else if (routed) {
          try {
            first = await streamChatWithTools(toolMessages, toolDefinitions, {
              temperature: 0.6,
              onToken,
              onToolCallStart
            });
            answerProvider = first.provider;
            answerModel = first.model;
            fallbackReason = first.fallbackReason;
          } catch (error) {
            // A malformed tool request should never prevent a normal answer, as
            // long as nothing has been shown yet. Capacity problems are different:
            // every model and wait has already been tried, so retrying only delays the error.
            if (held.trim()) release();
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
                send({ type: "status", label: describeToolCall(call.function.name, args) });
                result = await executeTool(call.function.name, args, toolCtx);
              } catch (error) {
                result = `Error running ${call.function.name}: ${serializeError(error)}`;
              }
              results.push(result);
              toolMessages.push({ role: "tool", tool_call_id: call.id, content: result });
            }
            // The status stays up while the answer is written; the page clears it at the first words.
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
        }
      } catch (error) {
        failure = error;
        console.error("[chat] stream failed", serializeError(error), error);
      }

      if (answerProvider && answerModel) send({ type: "model", provider: answerProvider, model: answerModel, fallbackReason });

      // Stop saves the words the user saw as the newest message
      // (/api/ai/chat/stop). If that happened, nothing more is saved or undone.
      let stopped = false;
      {
        try {
          const saved = await savedReply();
          stopped = Boolean(saved);
          if (saved && research) {
            const markers = new Set(Array.from(String(saved.content).matchAll(/\[(\d+)\]/g), (m) => m[1]));
            await supabase.from("chat_messages").update({ research, citations: research.sources.filter((source) => markers.has(source.marker)) }).eq("id", saved.id).eq("user_id", user!.id);
          }
        } catch (stopCheckError) {
          console.error("[chat] stop check failed", serializeError(stopCheckError));
        }
      }

      if (!answer.trim() && !stopped) {
        // The turn produced nothing, so leave no trace of it: the message the
        // user just sent (and the thread, if this request created it) is removed
        // and the page puts their text back in the box.
        try {
          if (savedUserMessageId) {
            await supabase.from("chat_messages").delete().eq("id", savedUserMessageId).eq("user_id", user!.id);
          }
          if (createdThread) {
            await supabase.from("chat_threads").delete().eq("id", finalThreadId).eq("user_id", user!.id);
          }
        } catch (rollbackError) {
          console.error("[chat] rollback failed", serializeError(rollbackError));
        }
        send({ type: "error", error: describeFailure(failure), restore: true });
      } else if (failure && answer.trim()) {
        push("\n\nThe response was cut short. Try regenerating it.");
      }

      // Persist before closing so the browser's reload is guaranteed to find the
      // same complete (or partial) reply. A failure here must never stop the
      // stream from closing.
      try {
        if (answer.trim() && !stopped) {
          const allCitations = webCitations;
          const usedMarkers = Array.from(new Set(Array.from(answer.matchAll(/\[(\d+)\]/g), (match) => match[1])));
          const citations = usedMarkers
            .map((marker) => allCitations[marker])
            .filter((citation): citation is Citation => Boolean(citation));

          const { error: assistantMessageError } = await supabase.from("chat_messages").insert({
            user_id: user!.id,
            thread_id: finalThreadId,
            role: "assistant",
            content: removeEmDashes(answer.trim()),
            citations,
            research
          });
          if (assistantMessageError) console.error("[chat] persist assistant message failed", assistantMessageError);
        }
        if (answer.trim()) {
          console.info(
            "[chat] reply",
            JSON.stringify({
              model: answerModel || configuredAiModel(true),
              provider: answerProvider || "unknown",
              fallbackReason,
              ttftMs: firstVisibleAt ? firstVisibleAt - startedAt : null,
              totalMs: Date.now() - startedAt,
              chars: answer.length,
              tools: toolsUsed,
              clientGone,
              stopped,
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
        if (!finalAnswer.trim() && !stopped) {
          await refundAiRequest(user!.id, "chat");
          return;
        }
        await supabase.from("chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", finalThreadId);
        if (stopped) return;
        await extractMemories(supabase, user!.id, userContent, finalAnswer);
        await maybeBootstrapMemories(supabase, user!.id);
      });
    }

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Thread-Id": finalThreadId,
        "X-AI-Model": configuredAiModel(true)
      }
    });
  } catch (error) {
    const message = serializeError(error);
    console.error("[chat]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Groq limits tokens per minute, so every request is kept lean.
const HISTORY_ROWS = 12;
const HISTORY_CHAR_BUDGET = 8000;
const HISTORY_MESSAGE_MAX = 2000;
const CURRENT_MESSAGE_MAX = 12000;
const HOLD_CHARS = 160;
const HOLD_MS = 350;

type HistoryRow = { role: "user" | "assistant"; content: string; research?: ResearchMetadata | null };

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
    if (!row.content.trim()) continue; // a reply stopped before any words
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
  threadId: string | null
): Promise<NextResponse | null> {
  if (!threadId) return null;
  const { data: thread, error } = await supabase
    .from("chat_threads")
    .select("id")
    .eq("id", threadId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return thread ? null : NextResponse.json({ error: "Conversation not found" }, { status: 404 });
}

function describeFailure(error: unknown) {
  if (error instanceof GroqHttpError && error.rateLimited) {
    return "Selrano's AI is handling a lot of requests right now. Wait a few seconds and send that again. This did not count against your limit.";
  }
  if (error) return "Selrano could not generate that response. Please try again. This did not count against your limit.";
  return "The AI returned an empty reply. Please try again. This did not count against your limit.";
}

/** What the page shows while a tool runs. */
function describeToolCall(name: string, _args: Record<string, unknown>) {
  switch (name) {
    default:
      return "Working on it";
  }
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
