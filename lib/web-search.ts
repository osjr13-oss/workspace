import { isIP } from "node:net";
import { removeEmDashes } from "@/lib/text";
import type { WebCitation } from "@/lib/types";

export type SearchSource = Omit<WebCitation, "marker" | "kind">;
export type RetrievalOutcome = "ok" | "unavailable" | "timeout" | "no_results" | "inaccessible";
export type SearchOutcome = { outcome: RetrievalOutcome; sources: SearchSource[]; dropped?: number };

/** Tavily relevance score (0 to 1) a result must beat to reach the model. */
export const MIN_SOURCE_SCORE = 0.45;

/** Only public HTTPS source candidates are ever sent to the extraction service. */
export function publicSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.port || !host.includes(".") ||
        isIP(host.replace(/^\[|\]$/g, "")) || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host)) return null;
    url.hash = "";
    return url.href;
  } catch { return null; }
}

/** Queries contain public subject terms, never conversation dumps or credentials. */
export function publicSearchQuery(query: string): string | null {
  const text = removeEmDashes(query).trim();
  if (!text || text.length > 300 || /[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:sk-|gsk_|tvly-|sb_secret_|gh[pousr]_|Bearer\s)|\b\d{3}-\d{2}-\d{4}\b/i.test(text)) return null;
  return text;
}

async function tavily(path: string, body: Record<string, unknown>, signal?: AbortSignal) {
  const key = process.env.TAVILY_API_KEY?.trim();
  if (!key) return null;
  const response = await fetch(`${process.env.TAVILY_BASE_URL?.trim() || "https://api.tavily.com"}/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000),
    body: JSON.stringify(body)
  });
  if (!response.ok) return null; // Response bodies can contain private queries or credentials.
  return response.json();
}

/** How recent results must be. "news" searches Tavily's news index instead of the general web. */
export type SearchFreshness = { topic?: "news" | "general"; timeRange?: "day" | "week" | "month" };

const MAX_AGE_DAYS: Record<NonNullable<SearchFreshness["timeRange"]>, number> = {
  day: 3,
  week: 10,
  month: 40
};

/** Normalize any valid publication date (such as RFC-2822 news dates) to YYYY-MM-DD. */
export function normalizePublishedDate(raw: unknown, url?: string): string | null {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = Date.parse(trimmed);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  }
  if (url) {
    const match = url.match(/\/(20\d{2})\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])(?:\/|$)/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  return null;
}

function isStaleForRange(publishedAt: string | null, timeRange?: SearchFreshness["timeRange"]): boolean {
  if (!timeRange) return false;
  if (!publishedAt) return false;
  const parsed = Date.parse(`${publishedAt}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return false;
  const ageDays = (Date.now() - parsed) / 86_400_000;
  return ageDays > MAX_AGE_DAYS[timeRange];
}

function isLowValueResult(url: string, title: string, snippet: string): boolean {
  if (snippet.trim().length < 25) return true;
  const path = new URL(url).pathname.toLowerCase();
  if (/\/(?:section|category|tag|topics?)\/|\/page-\d+\/?$|\/amp_videoshow\//.test(path)) return true;
  if (/school[- ]assembly[- ]news|news[- ]headlines[- ]for[- ]school|audio[- ]briefing|top[- ]story[- ]summaries[- ]for/i.test(`${title} ${path}`)) return true;
  return false;
}

export async function webSearch(query: string, signal?: AbortSignal, freshness: SearchFreshness = {}): Promise<SearchOutcome> {
  const safe = publicSearchQuery(query);
  if (!safe) return { outcome: "unavailable", sources: [] };
  try {
    // "fast" returns the most relevant passages from each page in one quick call.
    const payload = await tavily("search", {
      query: safe,
      search_depth: "fast",
      chunks_per_source: 3,
      max_results: 5,
      include_answer: false,
      include_raw_content: false,
      include_published_date: true,
      topic: freshness.topic || "general",
      ...(freshness.timeRange ? { time_range: freshness.timeRange } : {})
    }, signal);
    if (!payload) return { outcome: "unavailable", sources: [] };
    if (!Array.isArray(payload.results)) return { outcome: "unavailable", sources: [] };
    const sources: SearchSource[] = [];
    let dropped = 0;
    for (const result of payload.results.slice(0, 5)) {
      // Weak matches never reach the model; a result without a score is treated as weak.
      if (!(typeof result.score === "number" && result.score > MIN_SOURCE_SCORE)) { dropped++; continue; }
      const url = typeof result.url === "string" ? publicSourceUrl(result.url) : null;
      if (!url || typeof result.title !== "string" || sources.some((s) => s.url === url)) continue;
      const snippet = removeEmDashes(String(result.content || "")).slice(0, 1500);
      const title = removeEmDashes(result.title).slice(0, 300);
      const publishedAt = normalizePublishedDate(result.published_date, url);
      if (isLowValueResult(url, title, snippet) || isStaleForRange(publishedAt, freshness.timeRange)) { dropped++; continue; }
      const publisher = new URL(url).hostname;
      if (freshness.topic === "news" && sources.filter((s) => s.publisher === publisher).length >= 2) { dropped++; continue; }
      sources.push({ title, url, snippet, evidence: snippet,
        evidenceKind: "search_excerpt", publisher, retrievedAt: new Date().toISOString(),
        publishedAt });
    }
    return { outcome: sources.length ? "ok" : "no_results", sources, dropped };
  } catch (error) {
    return { outcome: signal?.aborted || (error instanceof Error && /timeout|abort/i.test(error.name)) ? "timeout" : "unavailable", sources: [] };
  }
}

export async function extractSources(sources: SearchSource[], query: string, signal: AbortSignal): Promise<SearchOutcome> {
  const candidates = sources.slice(0, 3);
  if (!candidates.length) return { outcome: "no_results", sources: [] };
  try {
    const payload = await tavily("extract", { urls: candidates.map((s) => s.url), query, chunks_per_source: 3, extract_depth: "basic", format: "text", timeout: 8 }, signal);
    if (!payload) return { outcome: "unavailable", sources: candidates };
    const results = Array.isArray(payload.results) ? payload.results : [];
    const extracted = candidates.map((source) => {
      const result = results.find((r: { url?: string }) => r.url && publicSourceUrl(r.url) === source.url);
      const evidence = typeof result?.raw_content === "string" ? removeEmDashes(result.raw_content).trim().slice(0, 3000) : "";
      return evidence ? { ...source, evidence, evidenceKind: "page" as const, retrievedAt: new Date().toISOString() } : source;
    });
    return { outcome: extracted.some((s) => s.evidenceKind === "page") ? "ok" : "inaccessible", sources: extracted };
  } catch (error) {
    return { outcome: signal.aborted || (error instanceof Error && /timeout|abort/i.test(error.name)) ? "timeout" : "inaccessible", sources: candidates };
  }
}
