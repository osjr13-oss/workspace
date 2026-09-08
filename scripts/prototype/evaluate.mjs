import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomInt } from "node:crypto";
import { RELEASE } from "../../lib/prototype/release.ts";
const scenarios = JSON.parse(
  await readFile(new URL("./scenarios.json", import.meta.url), "utf8"),
);
const dir = new URL("../../.prototype-evaluation/", import.meta.url);
await mkdir(dir, { recursive: true });
let results = [];
try {
  const saved = JSON.parse(
    await readFile(new URL("results.json", dir), "utf8"),
  );
  if (saved.release === RELEASE.id) results = saved.results;
} catch {
  /* first run */
}
for (const scenario of scenarios) {
  if (results.some((s) => s.id === scenario.id)) continue;
  const responses = {};
  for (const variant of ["baseline", "selrano"]) {
    let response;
    for (let attempt = 0; attempt < 5; attempt++) {
      response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          signal: AbortSignal.timeout(60000),
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY?.trim()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: RELEASE.model,
            temperature: RELEASE.temperature,
            max_tokens: RELEASE.maxTokens,
            reasoning_effort: RELEASE.reasoningEffort,
            messages: [
              {
                role: "system",
                content:
                  variant === "selrano"
                    ? RELEASE.system
                    : "You are a helpful AI assistant. Answer clearly and honestly.",
              },
              ...scenario.messages,
            ],
          }),
        },
      );
      if (response.status !== 429) break;
      const seconds = Math.min(
        60,
        Math.max(15, Number(response.headers.get("retry-after")) || 45),
      );
      console.log(
        `Rate limited; waiting ${seconds}s before retry ${attempt + 1}.`,
      );
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    }
    if (!response.ok)
      throw new Error(
        `Provider status ${response.status}; evaluation stopped. No failed pairs are scored.`,
      );
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text?.trim() || data.choices[0].finish_reason === "length")
      throw new Error("Incomplete evaluation response.");
    await new Promise((resolve) => setTimeout(resolve, 4000));
    responses[variant] = text.replace(/\u2014/g, "-");
  }
  const order = randomInt(2)
    ? ["selrano", "baseline"]
    : ["baseline", "selrano"];
  results.push({ ...scenario, order, responses });
  await writeFile(
    new URL("results.json", dir),
    JSON.stringify(
      {
        release: RELEASE.id,
        model: RELEASE.model,
        createdAt: new Date().toISOString(),
        results,
      },
      null,
      2,
    ),
  );
  console.log(`Completed pair ${scenario.id}/20`);
}
let markdown = `# Selrano 1: Blind comparison\n\nTwenty fictional conversations, same provider model and generation settings. A/B order varies by scenario. Choose A, B, or Tie before opening results.json. This is a personal product test, not a benchmark.\n\nJudge helpfulness, initiative, remembered constraints, honesty, and unnecessary questioning. Target: you prefer Selrano in at least 15/20 pairs. Your ratings have not been supplied yet.\n`;
for (const s of results) {
  markdown += `\n## ${s.id}: ${s.focus}\n\n${s.messages.map((m) => `**${m.role}:** ${m.content}`).join("\n\n")}\n\n### A\n\n${s.responses[s.order[0]]}\n\n### B\n\n${s.responses[s.order[1]]}\n\n**Your preference: A / B / Tie**\n\nReason: __________\n`;
}
await writeFile(new URL("comparison.md", dir), markdown);
console.log("Comparison ready in .prototype-evaluation/comparison.md");
