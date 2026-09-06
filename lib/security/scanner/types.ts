export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type FindingCategory =
  | "security_headers"
  | "transport"
  | "cookies_forms"
  | "frontend_exposure"
  | "trust_readiness";

export type ScanStatus = "queued" | "running" | "completed" | "failed";

export interface Finding {
  id: string;
  category: FindingCategory;
  severity: Severity;
  title: string;
  evidence: string;
  remediation: string;
  affectedUrl: string;
  references?: string[];
}

export interface BuilderPrompt {
  id: string;
  title: string;
  description: string;
  prompt: string;
}

export interface ScanAnalysis {
  headline: string;
  executiveSummary: string;
  priorityActions: string[];
  builderPrompts: BuilderPrompt[];
  generatedBy: "deterministic" | "ai";
}

export interface ScanMetadata {
  finalUrl: string;
  statusCode: number;
  fetchedAt: string;
  pageTitle?: string;
  thirdPartyScriptCount: number;
  formCount: number;
  trustSignalCount: number;
  responseHeaders: Record<string, string>;
  crawledPagesCount?: number;
  warnings?: string[];
}

export interface ScanResult {
  id: string;
  url: string;
  normalizedUrl: string;
  host: string;
  status: ScanStatus;
  score: number;
  summary: string;
  startedAt: string;
  completedAt: string;
  findings: Finding[];
  metadata: ScanMetadata;
  analysis?: ScanAnalysis;
}

export interface PassiveScanInput {
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  headers: Record<string, string>;
  html: string;
  setCookieHeaders: string[];
  fetchedAt: string;
}
