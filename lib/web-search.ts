import { removeEmDashes } from "@/lib/text";

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export type WebSearchOutcome =
  | { status: "off" }
  | { status: "error"; message: string }
  | { status: "ok"; results: WebSearchResult[] };

export async function webSearch(query: string): Promise<WebSearchOutcome> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) return { status: "off" };

  let response: Response;
  try {
    response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        include_answer: false,
        max_results: 5
      })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Web search failed.";
    return { status: "error", message };
  }

  if (!response.ok) {
    const detail = await response.text();
    return { status: "error", message: detail || "Web search failed." };
  }

  const payload = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };

  const results = (payload.results || [])
    .filter((result): result is { title: string; url: string; content?: string } => Boolean(result.title && result.url))
    .map((result) => ({
      title: removeEmDashes(result.title),
      url: result.url,
      snippet: removeEmDashes(result.content || "").slice(0, 500)
    }));

  return { status: "ok", results };
}
