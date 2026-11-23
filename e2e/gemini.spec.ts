import { expect, test } from "@playwright/test";
import { resetMocks } from "./support/session";
import { configuredAiModel, streamChatWithTools } from "../lib/ai";
import { embedForMemory, embedText, hasEmbeddingProvider, memoryEmbeddingModel } from "../lib/embeddings";

// Gemini is the main model in production (GEMINI_API_KEY). These run the real
// client code against the fake Gemini server in e2e/support/mock-servers.mjs.
const endpoint = "http://localhost:54322";
const gemini = async () => (await fetch(`${endpoint}/__gemini`)).json();
const setGemini = (body: Record<string, unknown>) => fetch(`${endpoint}/__gemini`, { method: "POST", body: JSON.stringify(body) });

const tool = {
  type: "function",
  function: { name: "search_workspace", description: "Search notes.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } }
};

test.describe("Gemini", () => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "Requires offline fixtures");
  const saved = { ...process.env };

  test.beforeEach(async () => {
    await resetMocks();
    process.env.GEMINI_API_KEY = "test-gemini-key";
    process.env.GEMINI_BASE_URL = `${endpoint}/gemini/v1beta`;
    process.env.GROQ_API_KEY = "test-key";
    process.env.GROQ_BASE_URL = `${endpoint}/openai/v1`;
    delete process.env.GEMINI_MODEL;
  });

  test.afterEach(() => {
    for (const key of ["GEMINI_API_KEY", "GEMINI_BASE_URL", "GEMINI_MODEL", "GROQ_API_KEY", "GROQ_BASE_URL", "EMBEDDING_API_KEY"]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  test("streams an answer from the model chosen in one setting", async () => {
    expect(configuredAiModel(true)).toBe("gemini-4-hydrogen");
    let streamed = "";
    const result = await streamChatWithTools(
      [
        { role: "system", content: "You are Selrano." },
        { role: "user", content: "Hello" }
      ],
      [],
      { onToken: (token) => (streamed += token) }
    );
    expect(result.provider).toBe("gemini");
    expect(streamed).toContain("fake Gemini server");
    const [request] = (await gemini()).requests;
    expect(request.path).toBe("/gemini/v1beta/models/gemini-4-hydrogen:streamGenerateContent");
    expect(request.body.systemInstruction.parts[0].text).toBe("You are Selrano.");
    expect(request.body.contents).toEqual([{ role: "user", parts: [{ text: "Hello" }] }]);

    process.env.GEMINI_MODEL = "gemini-3.8-flash";
    expect(configuredAiModel(true)).toBe("gemini-3.8-flash");
  });

  test("a tool round sends the thought signature back, and the answer continues", async () => {
    await setGemini({ toolNext: { name: "search_workspace", args: { query: "lease" } } });
    const messages: Parameters<typeof streamChatWithTools>[0] = [{ role: "user", content: "Find my lease notes" }];
    const first = await streamChatWithTools(messages, [tool], { onToken: () => {} });
    expect(first.provider).toBe("gemini");
    expect(first.toolCalls).toEqual([{ id: "fc-1", type: "function", function: { name: "search_workspace", arguments: JSON.stringify({ query: "lease" }) } }]);

    messages.push({ role: "assistant", content: null, tool_calls: first.toolCalls }, { role: "tool", tool_call_id: "fc-1", content: "Lease ends March 31." });
    let answer = "";
    const second = await streamChatWithTools(messages, [tool], { provider: first.provider, assistantContent: first.assistantContent, onToken: (token) => (answer += token) });
    expect(second.provider).toBe("gemini");
    expect(answer).toContain("I used the tool");
    const replay = (await gemini()).requests[1].body.contents;
    expect(replay[1].parts[0].thoughtSignature).toBe("sig-from-gemini");
    expect(replay[2]).toEqual({ role: "user", parts: [{ functionResponse: { name: "search_workspace", id: "fc-1", response: { result: "Lease ends March 31." } } }] });
  });

  test("an older tool call without its signature still works", async () => {
    let answer = "";
    await streamChatWithTools(
      [
        { role: "user", content: "Find my lease notes" },
        { role: "assistant", content: null, tool_calls: [{ id: "old-1", type: "function", function: { name: "search_workspace", arguments: "{}" } }] },
        { role: "tool", tool_call_id: "old-1", content: "Nothing found." }
      ],
      [tool],
      { onToken: (token) => (answer += token) }
    );
    expect(answer).toContain("I used the tool");
  });

  test("a bad key falls back to Groq before any words are shown", async () => {
    process.env.GEMINI_API_KEY = "wrong-key";
    const result = await streamChatWithTools([{ role: "user", content: "Hello" }], [], { onToken: () => {} });
    expect(result.provider).toBe("groq");
    expect(result.fallbackReason).toBe("401:authentication");
  });

  test("memory search uses Google embeddings at 1536 dimensions, scaled to length 1", async () => {
    // Google wins even when an older embedding key is still configured.
    process.env.EMBEDDING_API_KEY = "old-openai-key";
    expect(memoryEmbeddingModel()).toBe("gemini-embedding-001");
    const vectors = await embedForMemory(["likes tea", "lives in Brooklyn"], 3000);
    expect(vectors).toHaveLength(2);
    expect(vectors![0]).toHaveLength(1536);
    const norm = Math.sqrt(vectors![0].reduce((sum, value) => sum + value * value, 0));
    expect(norm).toBeCloseTo(1, 5);
    const [request] = (await gemini()).requests;
    expect(request.path).toBe("/gemini/v1beta/models/gemini-embedding-001:batchEmbedContents");
    expect(request.body.requests[0].outputDimensionality).toBe(1536);

    delete process.env.EMBEDDING_API_KEY;
    expect(hasEmbeddingProvider()).toBe(true);
    const chunkVector = await embedText("project lease summary");
    expect(chunkVector).toHaveLength(1536);
  });

  test("enables built-in Google Search and URL context alongside workspace tools", async () => {
    const result = await streamChatWithTools(
      [{ role: "user", content: "What is the current price of the PS5?" }],
      [tool],
      { webSearch: true, onToken: () => {} }
    );
    expect(result.provider).toBe("gemini");
    const [request] = (await gemini()).requests;
    expect(request.body.tools).toEqual([
      { functionDeclarations: [{ name: tool.function.name, description: tool.function.description, parameters: tool.function.parameters }] },
      { googleSearch: {} },
      { urlContext: {} }
    ]);
  });
});
