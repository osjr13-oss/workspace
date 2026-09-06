import type { ScanResult } from "./scanner/types";

export interface ScanRow {
  id: string;
  url: string;
  host: string;
  status: "running" | "completed" | "failed";
  score: number | null;
  summary: string | null;
  finding_count: number;
  failure: string | null;
  created_at: string;
  completed_at: string | null;
  report?: ScanResult | null;
}

export interface CopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export const SCAN_COLUMNS =
  "id,url,host,status,score,summary,finding_count,failure,created_at,completed_at";
export const SEVERITIES = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
] as const;
export const CATEGORY_LABELS = {
  security_headers: "Security headers",
  transport: "HTTPS & transport",
  cookies_forms: "Cookies & forms",
  frontend_exposure: "Frontend exposure",
  trust_readiness: "Trust & readiness",
};
