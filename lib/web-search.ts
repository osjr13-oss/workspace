import { removeEmDashes } from "@/lib/text";

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export async function webSearch(query: string): Promise<WebSearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) return [];

  const response = await fetch("https://api.tavily.com/search", {
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

  if (!response.ok) {
    console.error("[web-search] Tavily request failed", await response.text());
    return [];
  }

  const payload = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };

  return (payload.results || [])
    .filter(
      (result): result is { title: string; url: string; content?: string } =>
        Boolean(result.title && result.url)
    )
    .map((result) => ({
      title: removeEmDashes(result.title),
      url: result.url,
      snippet: removeEmDashes(result.content || "").slice(0, 500)
    }));
}
