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
  active_leaf_id?: string | null;
  title_locked?: boolean;
  temporary?: boolean;
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

/** A durable memory an answer relied on, cited as [M1]. */
export type MemoryCitation = {
  kind: "memory";
  marker: string;
  memoryId: string;
  content: string;
};

/** A connected account or workspace lookup a reply relied on (no visible marker). */
export type ToolCitation = {
  kind: "tool";
  marker: string;
  label: string;
};

export type Citation = FileCitation | WebCitation | MemoryCitation | ToolCitation;

export type ResearchMetadata = {
  groundingProvider?: "google";
  searchSuggestionsHtml?: string;
  status: "complete" | "limited" | "unavailable" | "timeout" | "no_results" | "inaccessible" | "insufficient_evidence" | "clarification" | "routing_failed";
  sources: WebCitation[];
  limitations: string[];
  searches: number;
  extractedPages: number;
};

/** One thing a reply did: a search, a lookup in the user's accounts, a note it wrote. */
export type ToolStep = {
  label: string;
  /** The tool's name, for lookups the model made. */
  tool?: string;
  /** A short copy of what the lookup found, replayed to later turns. Never shown raw. */
  digest?: string;
};

export type ToolTrace = { steps: ToolStep[]; durationMs?: number };

export type ChatMessage = {
  id: string;
  thread_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: Citation[];
  research?: ResearchMetadata | null;
  parent_id?: string | null;
  tool_trace?: ToolTrace | null;
  suggestions?: string[] | null;
  feedback?: number | null;
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
  welcome_email_sent_at?: string | null;
};
