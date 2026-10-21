import { isIP } from "node:net";
import { removeEmDashes } from "@/lib/text";
import type { WebCitation } from "@/lib/types";

export type SearchSource = Omit<WebCitation, "marker" | "kind">;
export type RetrievalOutcome = "ok" | "unavailable" | "timeout" | "no_results" | "inaccessible";
export type SearchOutcome = { outcome: RetrievalOutcome; sources: SearchSource[] };

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

export async function webSearch(query: string, signal?: AbortSignal): Promise<SearchOutcome> {
  const safe = publicSearchQuery(query);
  if (!safe) return { outcome: "unavailable", sources: [] };
  try {
    const payload = await tavily("search", { query: safe, search_depth: "basic", include_answer: false, include_published_date: true, max_results: 5, include_raw_content: false }, signal);
    if (!payload) return { outcome: "unavailable", sources: [] };
    if (!Array.isArray(payload.results)) return { outcome: "unavailable", sources: [] };
    const sources: SearchSource[] = [];
    for (const result of payload.results.slice(0, 5)) {
      const url = typeof result.url === "string" ? publicSourceUrl(result.url) : null;
      if (!url || typeof result.title !== "string" || sources.some((s) => s.url === url)) continue;
      const snippet = removeEmDashes(String(result.content || "")).slice(0, 600);
      sources.push({ title: removeEmDashes(result.title).slice(0, 300), url, snippet, evidence: snippet,
        evidenceKind: "search_excerpt", publisher: new URL(url).hostname, retrievedAt: new Date().toISOString(),
        publishedAt: typeof result.published_date === "string" && Number.isFinite(Date.parse(result.published_date)) ? result.published_date : null });
    }
    return { outcome: sources.length ? "ok" : "no_results", sources };
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
