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

export type FileCitation = {
  kind?: "file";
  marker: string;
  fileId: string;
  fileName: string;
  pageNumber: number | null;
  charStart: number | null;
  charEnd: number | null;
};

export type WebCitation = {
  kind: "web";
  marker: string;
  title: string;
  url: string;
  snippet: string;
  evidence?: string;
  evidenceKind?: "page" | "search_excerpt";
  publishedAt?: string | null;
  retrievedAt?: string;
  publisher?: string;
};

export type Citation = FileCitation | WebCitation;

export type ResearchMetadata = {
  groundingProvider?: "google";
  searchSuggestionsHtml?: string;
  status: "complete" | "limited" | "unavailable" | "timeout" | "no_results" | "inaccessible" | "insufficient_evidence" | "clarification" | "routing_failed";
  sources: WebCitation[];
  limitations: string[];
  searches: number;
  extractedPages: number;
};

export type ChatMessage = {
  id: string;
  thread_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: Citation[];
  research?: ResearchMetadata | null;
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
