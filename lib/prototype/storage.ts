import { type Conversation, STORAGE_KEY } from "./release";
export function loadConversations(
  storage: Pick<Storage, "getItem">,
): Conversation[] {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (
    !Array.isArray(parsed) ||
    parsed.some(
      (c) =>
        !c ||
        typeof c.id !== "string" ||
        typeof c.title !== "string" ||
        typeof c.updatedAt !== "string" ||
        !Array.isArray(c.messages) ||
        c.messages.some(
          (m: {
            id?: unknown;
            role?: unknown;
            content?: unknown;
            release?: unknown;
            status?: unknown;
          }) =>
            typeof m.id !== "string" ||
            !["user", "assistant"].includes(String(m.role)) ||
            typeof m.content !== "string" ||
            (m.release !== undefined && typeof m.release !== "string") ||
            (m.status !== undefined &&
              !["complete", "interrupted"].includes(String(m.status))),
        ),
    )
  )
    throw new Error(
      "Saved chats could not be read. They have not been overwritten.",
    );
  return parsed;
}
export function saveConversations(
  storage: Pick<Storage, "setItem">,
  conversations: Conversation[],
) {
  storage.setItem(STORAGE_KEY, JSON.stringify(conversations));
}
