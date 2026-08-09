import type { SupabaseClient } from "@supabase/supabase-js";
import { removeEmDashes } from "@/lib/text";

/**
 * Turning feed decisions into preference observations the Judgment layer reads.
 *
 * This is the loop that makes the product work: the user approves, dismisses or
 * edits, and the next run knows. Observations are written to content_memories
 * with kind='preference' so they stay out of chat recall, which reads only
 * kind='durable'.
 *
 * Observations are written in the second person and phrased as tendencies, not
 * single events, because that is how they will read when injected into the next
 * judgment prompt.
 */

export type FeedDecision = "approved" | "dismissed";

type FeedItemFacts = {
  actionType: string;
  title: string;
  sourceType: string | null;
  projectName: string | null;
  edited: boolean;
};

/** Human label for an action type, used inside the observation sentence. */
function actionLabel(actionType: string) {
  return actionType === "generate_flashcards" ? "flashcards" : "study briefs";
}

/**
 * Compose the observation.
 *
 * Deliberately concrete: "dismissed flashcards made from a note" is useful to a
 * planner; "did not like something" is not.
 */
export function describeDecision(decision: FeedDecision, facts: FeedItemFacts): string {
  const what = actionLabel(facts.actionType);
  const from = facts.sourceType ? ` made from a ${facts.sourceType}` : "";
  const project = facts.projectName ? ` in the ${facts.projectName} project` : "";

  if (decision === "dismissed") {
    return `This user dismissed ${what}${from}${project}. Weigh that against proposing the same thing again.`;
  }

  if (facts.edited) {
    return `This user approved ${what}${from}${project} but edited it first, so the generated version needed correction.`;
  }

  return `This user approved ${what}${from}${project} without changes.`;
}

/**
 * Record one decision as a preference memory.
 *
 * Uses the caller's authenticated client so row level security applies. Failures
 * are logged and swallowed: losing an observation must never fail the user's
 * approve or dismiss action.
 */
export async function recordFeedDecision(
  supabase: SupabaseClient,
  userId: string,
  decision: FeedDecision,
  facts: FeedItemFacts
): Promise<void> {
  const content = removeEmDashes(describeDecision(decision, facts));

  // Dismissals carry more signal than approvals: an approval mostly confirms the
  // default, while a dismissal is the user actively rejecting something.
  const importance = decision === "dismissed" ? 0.8 : facts.edited ? 0.7 : 0.5;

  const { error } = await supabase.from("content_memories").insert({
    user_id: userId,
    content,
    importance,
    kind: "preference"
  });

  if (error) {
    console.error("[feedback] could not record preference observation", {
      userId,
      decision,
      error: error.message
    });
  }
}

/**
 * Preference observations for the Judgment layer.
 *
 * Ordered by importance then recency, so a recent dismissal outranks an old
 * routine approval.
 */
export async function loadPreferenceObservations(
  admin: SupabaseClient,
  userId: string,
  limit = 12
): Promise<string[]> {
  const { data, error } = await admin
    .from("content_memories")
    .select("content")
    .eq("user_id", userId)
    .eq("kind", "preference")
    .order("importance", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return ((data || []) as Array<{ content: string }>).map((row) => row.content);
}
