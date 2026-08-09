import type { UserGoal } from "@/lib/types";

/**
 * Days from today until a goal's deadline.
 *
 * Deadlines are calendar days, so this compares dates rather than instants: a
 * deadline of today is 0, tomorrow is 1, and a past deadline is negative.
 * Returns null when the goal has no deadline, which the Worker reads as "no
 * urgency signal" rather than "not urgent".
 */
export function daysUntilDeadline(deadline: string | null, today = new Date()): number | null {
  if (!deadline) return null;
  const [year, month, day] = deadline.split("-").map(Number);
  if (!year || !month || !day) return null;

  const due = Date.UTC(year, month - 1, day);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((due - now) / 86_400_000);
}

/** Short human phrase for a deadline, for example "in 9 days" or "overdue by 2 days". */
export function describeDeadline(deadline: string | null, today = new Date()): string | null {
  const days = daysUntilDeadline(deadline, today);
  if (days === null) return null;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days > 1) return `in ${days} days`;
  if (days === -1) return "overdue by 1 day";
  return `overdue by ${Math.abs(days)} days`;
}

/** Sort active goals by urgency: soonest deadline first, undated goals last. */
export function byUrgency(a: UserGoal, b: UserGoal): number {
  if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
  if (a.deadline) return -1;
  if (b.deadline) return 1;
  return a.created_at.localeCompare(b.created_at);
}
