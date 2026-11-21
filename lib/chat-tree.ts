/**
 * A conversation is a tree of messages: each message points at the one it
 * answers or follows (`parent_id`). Editing a question or retrying an answer
 * adds a sibling instead of deleting what came after, and the thread remembers
 * which branch is showing (`chat_threads.active_leaf_id`). Used by the chat
 * route (to build history) and the chat page (to show versions).
 */

export type TreeNode = { id: string; parent_id?: string | null; role: string; created_at: string };

function byTime(a: TreeNode, b: TreeNode) {
  return a.created_at === b.created_at ? (a.id < b.id ? -1 : 1) : a.created_at < b.created_at ? -1 : 1;
}

/**
 * The parent each message effectively has. A message saved with a parent keeps
 * it. Messages saved before versions existed have no parent and follow the
 * message before them: that is every parentless message older than the first
 * message saved with a parent, and any parentless answer. A parentless
 * question saved after that is a new version of the first question.
 */
export function effectiveParents<T extends TreeNode>(rows: T[]) {
  const ordered = [...rows].sort(byTime);
  const firstLinked = ordered.find((row) => row.parent_id);
  const parents = new Map<string, string>();
  ordered.forEach((row, index) => {
    if (row.parent_id) return void parents.set(row.id, row.parent_id);
    const legacy = !firstLinked || byTime(row, firstLinked) < 0 || row.role !== "user";
    parents.set(row.id, legacy && index ? ordered[index - 1].id : "");
  });
  return parents;
}

/** Children of each message (key "" holds the first message), oldest first. */
export function childrenIndex<T extends TreeNode>(rows: T[], parents = effectiveParents(rows)) {
  const index = new Map<string, T[]>();
  for (const row of rows) {
    const key = parents.get(row.id) || "";
    const list = index.get(key);
    if (list) list.push(row);
    else index.set(key, [row]);
  }
  for (const list of index.values()) list.sort(byTime);
  return index;
}

/** Follows the newest child from `id` down to the end of that branch. */
export function deepestLeaf<T extends TreeNode>(rows: T[], id: string, index = childrenIndex(rows)): string {
  let current = id;
  for (let guard = 0; guard < 10_000; guard += 1) {
    const children = index.get(current);
    if (!children?.length) return current;
    current = children[children.length - 1].id;
  }
  return current;
}

/**
 * The messages on screen, first to last, ending at `leafId`. With no valid leaf
 * it shows the newest branch. Old conversations saved before the tree existed
 * have no parents at all; they are shown in time order.
 */
export function activePath<T extends TreeNode>(rows: T[], leafId?: string | null, options: { exact?: boolean } = {}): T[] {
  if (!rows.length) return [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const parents = effectiveParents(rows);
  const index = childrenIndex(rows, parents);
  // A saved position that has newer messages under it (a reply still being
  // written, or one saved by an older app) shows the newest message below it.
  // With `exact`, the path ends at leafId itself (history up to a message).
  let leaf = leafId && byId.has(leafId) ? (options.exact ? leafId : deepestLeaf(rows, leafId, index)) : "";
  if (!leaf) {
    const roots = index.get("") || [];
    if (!roots.length) return [...rows].sort(byTime);
    leaf = deepestLeaf(rows, roots[roots.length - 1].id, index);
  }
  const path: T[] = [];
  const seen = new Set<string>();
  let current = byId.get(leaf);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.push(current);
    const parent = parents.get(current.id);
    current = parent ? byId.get(parent) : undefined;
  }
  return path.reverse();
}

/** The versions of a message: it and its siblings, oldest first, and where it sits among them. */
export function versionsOf<T extends TreeNode>(rows: T[], message: T, parents = effectiveParents(rows), index = childrenIndex(rows, parents)) {
  const siblings = (index.get(parents.get(message.id) || "") || []).filter((row) => row.role === message.role);
  return { ids: siblings.map((row) => row.id), position: Math.max(0, siblings.findIndex((row) => row.id === message.id)) };
}
