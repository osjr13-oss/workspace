"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Plus, Target, Trash2, Undo2 } from "lucide-react";
import { byUrgency, daysUntilDeadline, describeDeadline } from "@/lib/goals";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Project, UserGoal } from "@/lib/types";

/**
 * Goals the user is working toward, with optional deadlines and project links.
 *
 * Pure CRUD, no AI. The Worker reads these to decide urgency, which is why the
 * deadline and project link matter more than they appear to here.
 */
export function GoalsPanel() {
  const [goals, setGoals] = useState<UserGoal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [projectId, setProjectId] = useState("");
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const [goalsResult, projectsResult] = await Promise.all([
      supabase.from("user_goals").select("*").order("deadline", { ascending: true, nullsFirst: false }),
      supabase.from("projects").select("*").order("name")
    ]);

    if (goalsResult.error) setError(goalsResult.error.message);
    setGoals(((goalsResult.data as UserGoal[]) || []).slice().sort(byUrgency));
    setProjects((projectsResult.data as Project[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addGoal(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || adding) return;

    setAdding(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You are signed out. Reload and try again.");
      setAdding(false);
      return;
    }

    const { error: insertError } = await supabase.from("user_goals").insert({
      user_id: user.id,
      title: trimmed,
      deadline: deadline || null,
      project_id: projectId || null
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setTitle("");
      setDeadline("");
      setProjectId("");
      await load();
    }
    setAdding(false);
  }

  async function setStatus(goal: UserGoal, status: UserGoal["status"]) {
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.from("user_goals").update({ status }).eq("id", goal.id);
    if (updateError) setError(updateError.message);
    await load();
  }

  async function removeGoal(goal: UserGoal) {
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: deleteError } = await supabase.from("user_goals").delete().eq("id", goal.id);
    if (deleteError) setError(deleteError.message);
    await load();
  }

  const active = goals.filter((goal) => goal.status === "active");
  const done = goals.filter((goal) => goal.status === "done");
  const visible = showDone ? done : active;

  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">
          <Target size={14} />
          Goals
        </h2>
        {done.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowDone((value) => !value)}
            className="text-sm font-bold text-[var(--muted)] hover:text-[var(--text)]"
          >
            {showDone ? `Active (${active.length})` : `Done (${done.length})`}
          </button>
        ) : null}
      </div>

      <form onSubmit={addGoal} className="mb-4 space-y-2">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Exam, ACC 120 midterm"
          maxLength={200}
          className="input-premium w-full px-5"
          aria-label="Goal title"
        />
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
            className="input-premium min-w-0 flex-1 px-5"
            aria-label="Deadline"
          />
          <select
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className="input-premium min-w-0 flex-1 px-5"
            aria-label="Linked project"
          >
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary min-h-10 px-4 text-sm" disabled={!title.trim() || adding}>
            <Plus size={16} />
            {adding ? "Adding" : "Add"}
          </button>
        </div>
      </form>

      {error ? <p className="mb-3 text-sm font-bold text-[var(--high)]">{error}</p> : null}

      {loading ? (
        <p className="py-8 text-center text-sm text-[var(--muted)]">Loading goals</p>
      ) : visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--muted)]">
          {showDone ? "Nothing finished yet" : "No goals yet. Add an exam or deadline so Selrano knows what matters."}
        </p>
      ) : (
        <ul className="space-y-1">
          {visible.map((goal) => (
            <GoalRow
              key={goal.id}
              goal={goal}
              projectName={projects.find((project) => project.id === goal.project_id)?.name ?? null}
              onToggle={() => setStatus(goal, goal.status === "active" ? "done" : "active")}
              onDelete={() => removeGoal(goal)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function GoalRow({
  goal,
  projectName,
  onToggle,
  onDelete
}: {
  goal: UserGoal;
  projectName: string | null;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const days = daysUntilDeadline(goal.deadline);
  const phrase = describeDeadline(goal.deadline);
  // Only urgency worth a visual signal: due within a week, or already past.
  const urgent = goal.status === "active" && days !== null && days <= 7;

  return (
    <li className="flex items-center justify-between gap-3 rounded-2xl px-3 py-3 hover:bg-[var(--surface-subtle)]">
      <div className="min-w-0">
        <p className={`truncate font-bold ${goal.status === "done" ? "text-[var(--muted)] line-through" : ""}`}>
          {goal.title}
        </p>
        <p className="mt-0.5 truncate text-sm text-[var(--muted)]">
          {phrase ? <span className={urgent ? "font-bold text-[var(--high)]" : ""}>{phrase}</span> : "No deadline"}
          {projectName ? ` · ${projectName}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onToggle}
          className="grid h-9 w-9 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
          aria-label={goal.status === "active" ? `Mark ${goal.title} done` : `Reopen ${goal.title}`}
        >
          {goal.status === "active" ? <Check size={16} /> : <Undo2 size={16} />}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="grid h-9 w-9 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
          aria-label={`Delete ${goal.title}`}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </li>
  );
}
