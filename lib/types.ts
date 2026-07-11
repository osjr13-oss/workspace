export type Project = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type Note = {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type WorkspaceFile = {
  id: string;
  user_id: string;
  project_id: string | null;
  name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  extraction_status: "pending" | "ready" | "unsupported" | "failed";
  extracted_text: string | null;
  created_at: string;
};

export type ChatThread = {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  thread_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

export type FlashcardDeck = {
  id: string;
  user_id: string;
  project_id: string | null;
  name: string;
  is_public: boolean;
  share_slug: string | null;
  created_at: string;
  updated_at: string;
};

export type Flashcard = {
  id: string;
  user_id: string;
  deck_id: string;
  project_id: string | null;
  front: string;
  back: string;
  source_type: string | null;
  source_id: string | null;
  due_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
  welcome_email_sent_at?: string | null;
};
