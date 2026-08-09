import type { SupabaseClient } from "@supabase/supabase-js";
import { describeDeadline } from "@/lib/goals";
import { RECENT_WINDOW_DAYS } from "@/lib/worker/config";
import { loadPreferenceObservations } from "@/lib/worker/feedback";

/**
 * Everything a run knows before it decides anything.
 *
 * Every query here is explicitly scoped by user_id. The Worker runs under the
 * service role, which bypasses row level security, so scoping is this module's
 * responsibility rather than the database's.
 */

export type WorkerSource = {
  kind: "note" | "file";
  id: string;
  title: string;
  projectId: string | null;
  projectName: string | null;
  /** Last-modified marker used to detect whether a source changed since we acted on it. */
  fingerprint: string;
  changedAt: string;
  excerpt: string;
  /** Whether the Worker has already produced something from this exact version. */
  alreadyActedOn: boolean;
};

export type WorkerGoal = {
  id: string;
  title: string;
  deadline: string | null;
  deadlinePhrase: string | null;
  daysRemaining: number | null;
  projectId: string | null;
  projectName: string | null;
};

export type WorkerFeedback = {
  actionType: string;
  status: string;
  title: string;
  decidedAt: string | null;
};

export type WorkerContext = {
  userId: string;
  lastRunAt: string | null;
  goals: WorkerGoal[];
  sources: WorkerSource[];
  /** Durable facts about the user (kind='durable'). */
  memories: string[];
  /** Learned preferences from past feed decisions (kind='preference'). */
  preferences: string[];
  recentFeedback: WorkerFeedback[];
  counts: { notes: number; files: number; decks: number };
};

function excerpt(value: string | null | undefined, max = 700) {
  return (value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** When the user's previous worker run finished, or null if this is the first. */
async function loadLastRunAt(admin: SupabaseClient, userId: string) {
  const { data } = await admin
    .from("background_jobs")
    .select("completed_at, created_at")
    .eq("user_id", userId)
    .eq("job_type", "worker_run")
    .eq("status", "succeeded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.completed_at as string | null) ?? null;
}

async function loadGoals(admin: SupabaseClient, userId: string, projectNames: Map<string, string>) {
  const { data } = await admin
    .from("user_goals")
    .select("id, title, deadline, project_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("deadline", { ascending: true, nullsFirst: false });

  return ((data || []) as Array<{ id: string; title: string; deadline: string | null; project_id: string | null }>).map(
    (goal) => {
      const phrase = describeDeadline(goal.deadline);
      const days = goal.deadline
        ? Math.round(
            (Date.parse(`${goal.deadline}T00:00:00Z`) -
              Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())) /
              86_400_000
          )
        : null;
      return {
        id: goal.id,
        title: goal.title,
        deadline: goal.deadline,
        deadlinePhrase: phrase,
        daysRemaining: days,
        projectId: goal.project_id,
        projectName: goal.project_id ? projectNames.get(goal.project_id) ?? null : null
      };
    }
  );
}

/**
 * Notes and files that changed recently, annotated with whether this exact
 * version has already produced feed output.
 *
 * files has no updated_at column, so its fingerprint combines created_at with
 * extraction_status: a re-extracted file legitimately reads as new material.
 */
async function loadSources(
  admin: SupabaseClient,
  userId: string,
  projectNames: Map<string, string>
): Promise<WorkerSource[]> {
  const since = new Date(Date.now() - RECENT_WINDOW_DAYS * 86_400_000).toISOString();

  const [notesResult, filesResult, actedResult] = await Promise.all([
    admin
      .from("notes")
      .select("id, title, content, project_id, updated_at")
      .eq("user_id", userId)
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(20),
    admin
      .from("files")
      .select("id, name, extracted_text, project_id, created_at, extraction_status")
      .eq("user_id", userId)
      .eq("extraction_status", "ready")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20),
    admin.from("feed_items").select("source_type, source_id, source_fingerprint").eq("user_id", userId)
  ]);

  const acted = new Set(
    ((actedResult.data || []) as Array<{ source_type: string | null; source_id: string | null; source_fingerprint: string | null }>).map(
      (row) => `${row.source_type}:${row.source_id}:${row.source_fingerprint}`
    )
  );

  const notes: WorkerSource[] = ((notesResult.data || []) as Array<{
    id: string;
    title: string;
    content: string;
    project_id: string | null;
    updated_at: string;
  }>)
    .filter((note) => excerpt(note.content, 100000).length >= 200)
    .map((note) => ({
      kind: "note" as const,
      id: note.id,
      title: note.title,
      projectId: note.project_id,
      projectName: note.project_id ? projectNames.get(note.project_id) ?? null : null,
      fingerprint: note.updated_at,
      changedAt: note.updated_at,
      excerpt: excerpt(note.content),
      alreadyActedOn: acted.has(`note:${note.id}:${note.updated_at}`)
    }));

  const files: WorkerSource[] = ((filesResult.data || []) as Array<{
    id: string;
    name: string;
    extracted_text: string | null;
    project_id: string | null;
    created_at: string;
    extraction_status: string;
  }>)
    .filter((file) => excerpt(file.extracted_text, 100000).length >= 200)
    .map((file) => {
      const fingerprint = `${file.created_at}:${file.extraction_status}`;
      return {
        kind: "file" as const,
        id: file.id,
        title: file.name,
        projectId: file.project_id,
        projectName: file.project_id ? projectNames.get(file.project_id) ?? null : null,
        fingerprint,
        changedAt: file.created_at,
        excerpt: excerpt(file.extracted_text),
        alreadyActedOn: acted.has(`file:${file.id}:${fingerprint}`)
      };
    });

  return [...notes, ...files].sort((a, b) => b.changedAt.localeCompare(a.changedAt));
}

/** What the user did with recent feed items. Phase 3 turns this into memory. */
async function loadRecentFeedback(admin: SupabaseClient, userId: string): Promise<WorkerFeedback[]> {
  const { data } = await admin
    .from("feed_items")
    .select("action_type, status, title, decided_at")
    .eq("user_id", userId)
    .neq("status", "pending")
    .order("decided_at", { ascending: false })
    .limit(20);

  return ((data || []) as Array<{ action_type: string; status: string; title: string; decided_at: string | null }>).map(
    (row) => ({
      actionType: row.action_type,
      status: row.status,
      title: row.title,
      decidedAt: row.decided_at
    })
  );
}

export async function gatherContext(admin: SupabaseClient, userId: string): Promise<WorkerContext> {
  const { data: projectRows } = await admin.from("projects").select("id, name").eq("user_id", userId);
  const projectNames = new Map(
    ((projectRows || []) as Array<{ id: string; name: string }>).map((project) => [project.id, project.name])
  );

  const [lastRunAt, goals, sources, memoryRows, preferences, recentFeedback, noteCount, fileCount, deckCount] =
    await Promise.all([
    loadLastRunAt(admin, userId),
    loadGoals(admin, userId, projectNames),
    loadSources(admin, userId, projectNames),
    // Durable facts only. Preference observations are loaded separately so they
    // can be presented to the model as a distinct, higher-weight signal.
    admin
      .from("content_memories")
      .select("content")
      .eq("user_id", userId)
      .eq("kind", "durable")
      .order("importance", { ascending: false })
      .limit(12),
    loadPreferenceObservations(admin, userId),
    loadRecentFeedback(admin, userId),
    admin.from("notes").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin.from("files").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin.from("flashcard_decks").select("id", { count: "exact", head: true }).eq("user_id", userId)
  ]);

  return {
    userId,
    lastRunAt,
    goals,
    sources,
    memories: ((memoryRows.data || []) as Array<{ content: string }>).map((row) => row.content),
    preferences,
    recentFeedback,
    counts: {
      notes: noteCount.count || 0,
      files: fileCount.count || 0,
      decks: deckCount.count || 0
    }
  };
}

/** Compact, readable serialization of the context for the judgment prompt. */
export function serializeContext(context: WorkerContext): string {
  const lines: string[] = [];

  lines.push(`Today: ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`Last worker run: ${context.lastRunAt ? context.lastRunAt.slice(0, 10) : "never"}`);
  lines.push(
    `Workspace size: ${context.counts.notes} notes, ${context.counts.files} files, ${context.counts.decks} decks`
  );

  lines.push("");
  lines.push("ACTIVE GOALS:");
  if (!context.goals.length) {
    lines.push("  (none set)");
  } else {
    for (const goal of context.goals) {
      const when = goal.deadlinePhrase ? `due ${goal.deadlinePhrase}` : "no deadline";
      const project = goal.projectName ? `, project: ${goal.projectName}` : "";
      lines.push(`  - ${goal.title} (${when}${project})`);
    }
  }

  lines.push("");
  lines.push("RECENTLY CHANGED MATERIAL:");
  const available = context.sources.filter((source) => !source.alreadyActedOn);
  if (!available.length) {
    lines.push("  (nothing new since the last time you acted on these)");
  } else {
    for (const source of available) {
      const project = source.projectName ? `, project: ${source.projectName}` : "";
      // The id is printed bare and labelled. It used to be shown as
      // [note:<uuid>], and the model faithfully copied the "note:" prefix into
      // source_id, which then matched nothing and got every action silently
      // dropped by the validator.
      lines.push(`  - ${source.kind} "${source.title}" (changed ${source.changedAt.slice(0, 10)}${project})`);
      lines.push(`    source_id: ${source.id}`);
      lines.push(`    excerpt: ${source.excerpt.slice(0, 400)}`);
    }
  }

  const skipped = context.sources.filter((source) => source.alreadyActedOn);
  if (skipped.length) {
    lines.push("");
    lines.push("ALREADY HANDLED (do not act on these again, they have not changed):");
    for (const source of skipped) lines.push(`  - "${source.title}"`);
  }

  // Learned preferences come before general facts and are stated as binding,
  // because reacting to them is the whole point of the feedback loop.
  if (context.preferences.length) {
    lines.push("");
    lines.push("WHAT YOU HAVE LEARNED ABOUT WHAT THIS USER WANTS:");
    lines.push("(These come from their own past decisions. Treat them as strong evidence.)");
    for (const preference of context.preferences) lines.push(`  - ${preference}`);
  }

  if (context.memories.length) {
    lines.push("");
    lines.push("WHAT YOU KNOW ABOUT THIS USER:");
    for (const memory of context.memories) lines.push(`  - ${memory}`);
  }

  if (context.recentFeedback.length) {
    lines.push("");
    lines.push("HOW THEY REACTED TO PAST SUGGESTIONS:");
    for (const entry of context.recentFeedback) {
      lines.push(`  - ${entry.status} the ${entry.actionType} "${entry.title}"`);
    }
  }

  return lines.join("\n");
}
