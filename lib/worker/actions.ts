import type { SupabaseClient } from "@supabase/supabase-js";
import { completeStructured, StructuredOutputError, type TokenUsage } from "@/lib/ai";
import { generateCardsFromText, type FlashcardInput } from "@/lib/flashcards";
import { removeEmDashes } from "@/lib/text";
import { MAX_SOURCE_CHARS } from "@/lib/worker/config";
import type { WorkerSource } from "@/lib/worker/context";
import type { PlannedAction } from "@/lib/worker/judgment";

/**
 * Executing a planned action and checking the result before it reaches the feed.
 *
 * Shipping one bad item costs more trust than shipping nothing, so every
 * produced item goes through a cheap self check asking whether it is accurate to
 * the source and worth the user's attention. Failing that check discards the
 * output and logs it.
 */

export type ExecutedAction = {
  action: PlannedAction;
  title: string;
  payload: Record<string, unknown>;
  usage: TokenUsage;
};

export type ActionOutcome =
  | { ok: true; item: ExecutedAction }
  | { ok: false; usage: TokenUsage; discardedBecause: string };

const BRIEF_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Short title for the brief." },
    covers: { type: "string", description: "One paragraph on what this material covers." },
    matters_most: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: { type: "string" },
      description: "The points that matter most, each one sentence."
    },
    connects_to: {
      type: "string",
      description: "How this connects to the user's earlier material. Empty string if there is no honest connection."
    },
    looks_confusing: {
      type: "string",
      description:
        "One thing that looks confusing, contradictory, or likely to be misread. Empty string if nothing genuinely stands out. Do not invent a problem."
    }
  },
  required: ["title", "covers", "matters_most"]
} as const;

const SELF_CHECK_SCHEMA = {
  type: "object",
  properties: {
    accurate: { type: "boolean", description: "Is every claim supported by the source material?" },
    worth_attention: { type: "boolean", description: "Would a busy student be glad to see this, rather than annoyed?" },
    problem: { type: "string", description: "If either answer is false, one sentence naming the problem. Otherwise empty." }
  },
  required: ["accurate", "worth_attention"]
} as const;

type StudyBrief = {
  title: string;
  covers: string;
  mattersMost: string[];
  connectsTo: string;
  looksConfusing: string;
};

function validateBrief(input: unknown): StudyBrief | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;

  const title = removeEmDashes(String(raw.title ?? "").trim());
  const covers = removeEmDashes(String(raw.covers ?? "").trim());
  const mattersMost = Array.isArray(raw.matters_most)
    ? raw.matters_most.map((entry) => removeEmDashes(String(entry ?? "").trim())).filter(Boolean)
    : [];

  if (!title || !covers || mattersMost.length < 2) return null;

  return {
    title: title.slice(0, 160),
    covers,
    mattersMost,
    connectsTo: removeEmDashes(String(raw.connects_to ?? "").trim()),
    looksConfusing: removeEmDashes(String(raw.looks_confusing ?? "").trim())
  };
}

/** Render a brief as the markdown body that becomes a note when approved. */
export function renderBrief(brief: StudyBrief): string {
  const parts = [`## What this covers`, "", brief.covers, "", `## What matters most`, ""];
  for (const point of brief.mattersMost) parts.push(`- ${point}`);
  if (brief.connectsTo) parts.push("", `## How it connects`, "", brief.connectsTo);
  if (brief.looksConfusing) parts.push("", `## Worth a second look`, "", brief.looksConfusing);
  return parts.join("\n");
}

/** Full text of a source, for generation. The excerpt in context is too short. */
async function loadFullSource(admin: SupabaseClient, userId: string, source: WorkerSource): Promise<string> {
  if (source.kind === "note") {
    const { data } = await admin
      .from("notes")
      .select("title, content")
      .eq("id", source.id)
      .eq("user_id", userId)
      .maybeSingle();
    return data ? `${data.title}\n\n${data.content}` : "";
  }

  const { data } = await admin
    .from("files")
    .select("name, extracted_text")
    .eq("id", source.id)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.extracted_text ? `${data.name}\n\n${data.extracted_text}` : "";
}

/**
 * Cheap verification pass. Asks whether the produced item is accurate to its
 * source and worth showing at all.
 */
async function selfCheck(
  sourceText: string,
  produced: string
): Promise<{ pass: boolean; problem: string; usage: TokenUsage }> {
  try {
    const result = await completeStructured({
      system:
        "You are reviewing material generated from a source document before it is shown to the person who owns that document. Be strict. Approve only if every claim is supported by the source and the result is genuinely worth a busy student's attention. Never use an em dash.",
      user: `SOURCE MATERIAL:\n${sourceText.slice(0, MAX_SOURCE_CHARS)}\n\nGENERATED OUTPUT:\n${produced.slice(0, 6000)}`,
      tool: {
        name: "review_output",
        description: "Report whether the generated output should be shown.",
        schema: SELF_CHECK_SCHEMA as unknown as Record<string, unknown>
      },
      validate: (input) => {
        if (!input || typeof input !== "object") return null;
        const raw = input as Record<string, unknown>;
        if (typeof raw.accurate !== "boolean" || typeof raw.worth_attention !== "boolean") return null;
        return {
          pass: raw.accurate && raw.worth_attention,
          problem: removeEmDashes(String(raw.problem ?? "").trim())
        };
      },
      temperature: 0
    });

    return { pass: result.data.pass, problem: result.data.problem, usage: result.usage };
  } catch (error) {
    // A check that cannot run is not a pass. Withholding costs less than a bad item.
    console.error("[worker] self check failed to run, discarding output", {
      error: error instanceof Error ? error.message : String(error)
    });
    return { pass: false, problem: "self check could not run", usage: { inputTokens: 0, outputTokens: 0 } };
  }
}

export async function executeAction(
  admin: SupabaseClient,
  userId: string,
  action: PlannedAction,
  source: WorkerSource
): Promise<ActionOutcome> {
  const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  const sourceText = await loadFullSource(admin, userId, source);

  if (!sourceText.trim()) {
    return { ok: false, usage, discardedBecause: "source had no readable text" };
  }

  let title: string;
  let payload: Record<string, unknown>;
  let produced: string;

  try {
    if (action.type === "generate_flashcards") {
      const generated = await generateCardsFromText(sourceText);
      usage.inputTokens += generated.usage.inputTokens;
      usage.outputTokens += generated.usage.outputTokens;

      const cards: FlashcardInput[] = generated.cards;
      title = `Flashcards from ${source.title}`;
      payload = { cards };
      produced = cards.map((card) => `Q: ${card.front}\nA: ${card.back}`).join("\n\n");
    } else {
      const result = await completeStructured({
        system:
          "Write a short, structured study brief on the user's own material. Be specific and grounded in the source. Do not pad. Only report something as confusing or contradictory if it genuinely is; an empty answer is better than an invented problem. Never use an em dash.",
        user: sourceText.slice(0, MAX_SOURCE_CHARS),
        tool: {
          name: "write_study_brief",
          description: "Return the structured study brief.",
          schema: BRIEF_SCHEMA as unknown as Record<string, unknown>
        },
        validate: validateBrief,
        temperature: 0.3
      });

      usage.inputTokens += result.usage.inputTokens;
      usage.outputTokens += result.usage.outputTokens;

      title = result.data.title;
      const body = renderBrief(result.data);
      payload = { body, title: result.data.title };
      produced = body;
    }
  } catch (error) {
    if (error instanceof StructuredOutputError) {
      console.error("[worker] generation failed schema validation", {
        actionType: action.type,
        provider: error.provider,
        raw: JSON.stringify(error.raw)?.slice(0, 400)
      });
      return { ok: false, usage, discardedBecause: "generation did not satisfy its schema" };
    }
    throw error;
  }

  const check = await selfCheck(sourceText, produced);
  usage.inputTokens += check.usage.inputTokens;
  usage.outputTokens += check.usage.outputTokens;

  if (!check.pass) {
    console.error("[worker] discarded output after self check", {
      actionType: action.type,
      sourceId: source.id,
      problem: check.problem
    });
    return { ok: false, usage, discardedBecause: check.problem || "failed self check" };
  }

  return { ok: true, item: { action, title, payload, usage } };
}
