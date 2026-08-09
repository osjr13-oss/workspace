import { completeStructured, StructuredOutputError, type TokenUsage } from "@/lib/ai";
import { removeEmDashes } from "@/lib/text";
import { MAX_ACTIONS_PER_RUN } from "@/lib/worker/config";
import { serializeContext, type WorkerContext, type WorkerSource } from "@/lib/worker/context";

/**
 * The Judgment layer: decide what, if anything, is worth producing this run.
 *
 * The hard rules from the spec are enforced here in code, not left to the
 * prompt. A model that is asked nicely to return at most three actions will
 * eventually return four; a model told to always give a reason will eventually
 * give an empty one. Everything the model returns is treated as a proposal that
 * must survive validation before it becomes work.
 *
 * Doing nothing is a first-class result. A worker that manufactures output every
 * day to look busy destroys trust faster than one that stays quiet.
 */

export type PlannedAction = {
  type: "generate_flashcards" | "write_study_brief";
  sourceKind: "note" | "file";
  sourceId: string;
  reason: string;
};

export type JudgmentResult = {
  actions: PlannedAction[];
  noActionReason: string | null;
  usage: TokenUsage;
  attempts: number;
};

const ACTION_TYPES = ["generate_flashcards", "write_study_brief"] as const;

const JUDGMENT_SCHEMA = {
  type: "object",
  properties: {
    actions: {
      type: "array",
      maxItems: MAX_ACTIONS_PER_RUN,
      description: `Zero to ${MAX_ACTIONS_PER_RUN} things worth producing right now. An empty array is the correct answer when nothing genuinely helps.`,
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: [...ACTION_TYPES],
            description: "generate_flashcards makes a deck from one source. write_study_brief writes a short structured brief on one source."
          },
          source_kind: { type: "string", enum: ["note", "file"] },
          source_id: { type: "string", description: "The exact id shown in brackets next to the material." },
          reason: {
            type: "string",
            description:
              "One plain sentence, written to the user, explaining why this is worth their attention right now. Reference the concrete trigger, for example an approaching deadline or a new upload."
          }
        },
        required: ["type", "source_kind", "source_id", "reason"]
      }
    },
    no_action_reason: {
      type: "string",
      description: "When actions is empty, one short sentence explaining why nothing was needed. Leave empty when there are actions."
    }
  },
  required: ["actions"]
} as const;

const SYSTEM_PROMPT = `You decide what a study workspace should produce for its owner while they are away.

You are not a chatbot and you are not trying to be helpful for its own sake. Most days the right answer is to do nothing. Only propose work when a specific, concrete trigger makes it genuinely useful right now.

Good triggers:
- A deadline is approaching and the material is linked to that goal.
- Material was uploaded or edited recently and has not been turned into anything yet.
- The user has a pattern of wanting this kind of output for this kind of material.

Bad reasons to act:
- The material exists.
- It has been a while since you did something.
- To appear productive.

Rules:
- At most ${MAX_ACTIONS_PER_RUN} actions.
- Never act on material listed as already handled.
- Never propose two actions on the same source in one run.
- Every action needs a reason you can state plainly to the user in one sentence. If you cannot state why it helps right now, do not propose it.
- Prefer fewer, better actions. Two strong ones beat three where the third is filler.
- Never use an em dash.`;

type RawAction = { type?: unknown; source_kind?: unknown; source_id?: unknown; reason?: unknown };

/**
 * Validate the model's plan against the hard rules.
 *
 * Returns null when the payload is not even the right shape, which
 * completeStructured turns into a StructuredOutputError so the caller can retry.
 * Individual actions that fail a rule are dropped rather than failing the whole
 * run: two good actions plus one bad one should yield two, not zero.
 */
export function validateJudgment(
  input: unknown,
  allowedSources: WorkerSource[]
): { actions: PlannedAction[]; noActionReason: string | null } | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as { actions?: unknown; no_action_reason?: unknown };
  if (!Array.isArray(raw.actions)) return null;

  const byId = new Map(allowedSources.map((source) => [source.id, source]));
  const seen = new Set<string>();
  const actions: PlannedAction[] = [];

  for (const entry of raw.actions as RawAction[]) {
    if (!entry || typeof entry !== "object") continue;

    const type = String(entry.type ?? "");
    if (!ACTION_TYPES.includes(type as (typeof ACTION_TYPES)[number])) continue;

    const sourceId = String(entry.source_id ?? "").trim();
    const source = byId.get(sourceId);
    // Rejects hallucinated ids, sources belonging to someone else, and anything
    // already acted on at this version, since allowedSources excludes those.
    if (!source) continue;

    const sourceKind = String(entry.source_kind ?? "");
    if (sourceKind !== source.kind) continue;

    // One action per source per run.
    if (seen.has(sourceId)) continue;

    // A reason the user will actually read. No reason, no action.
    const reason = removeEmDashes(String(entry.reason ?? "").trim());
    if (reason.length < 12) continue;

    seen.add(sourceId);
    actions.push({
      type: type as PlannedAction["type"],
      sourceKind: source.kind,
      sourceId,
      reason: reason.slice(0, 300)
    });

    if (actions.length >= MAX_ACTIONS_PER_RUN) break;
  }

  const noActionReason = removeEmDashes(String(raw.no_action_reason ?? "").trim()).slice(0, 300);
  return { actions, noActionReason: actions.length ? null : noActionReason || null };
}

/**
 * Run the judgment call, retrying once on a schema failure before giving up.
 *
 * A second failure is recorded as a no-action run rather than an error: the
 * user's feed should say nothing was needed, not show them a stack trace.
 */
export async function planActions(context: WorkerContext): Promise<JudgmentResult> {
  const available = context.sources.filter((source) => !source.alreadyActedOn);
  const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };

  // Nothing to work with. Skip the model call entirely rather than pay for it.
  if (!available.length) {
    return {
      actions: [],
      noActionReason: "Nothing new since the last run.",
      usage,
      attempts: 0
    };
  }

  const serialized = serializeContext(context);
  let attempts = 0;
  let lastError: unknown = null;

  while (attempts < 2) {
    attempts += 1;
    try {
      const result = await completeStructured({
        system: SYSTEM_PROMPT,
        user: serialized,
        tool: {
          name: "plan_actions",
          description: "Return the work worth doing for this user right now, or an empty list.",
          schema: JUDGMENT_SCHEMA as unknown as Record<string, unknown>
        },
        validate: (input) => validateJudgment(input, available),
        temperature: 0.2
      });

      usage.inputTokens += result.usage.inputTokens;
      usage.outputTokens += result.usage.outputTokens;

      return {
        actions: result.data.actions,
        noActionReason: result.data.noActionReason,
        usage,
        attempts
      };
    } catch (error) {
      lastError = error;
      if (error instanceof StructuredOutputError) {
        usage.inputTokens += 0;
        console.error("[worker] judgment failed schema validation", {
          attempt: attempts,
          provider: error.provider,
          raw: JSON.stringify(error.raw)?.slice(0, 600)
        });
        continue;
      }
      // Transport failures are not retried here; they are the run's problem.
      throw error;
    }
  }

  console.error("[worker] judgment abandoned after retry", {
    error: lastError instanceof Error ? lastError.message : String(lastError)
  });

  return {
    actions: [],
    noActionReason: "Could not plan reliably this run.",
    usage,
    attempts
  };
}
