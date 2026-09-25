export type Citation = {
  kind: "web";
  marker: string;
  title: string;
  url: string;
  snippet: string;
};

export type Artifact =
  | { type: "note"; id: string; title: string }
  | { type: "deck"; id: string; name: string; count: number }
  | { type: "search_off" };

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  thread_id: string;
  user_id: string;
  role: ChatRole;
  content: string;
  citations: Citation[] | null;
  artifacts: Artifact[] | null;
  created_at: string;
};

export type ChatThread = {
  id: string;
  user_id: string;
  title: string;
  model: string | null;
  created_at: string;
  updated_at: string;
};

export type NoteRecord = {
  id: string;
  user_id: string;
  thread_id: string | null;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type DeckRecord = {
  id: string;
  user_id: string;
  thread_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
};

export type FlashcardRecord = {
  id: string;
  deck_id: string;
  front: string;
  back: string;
};
