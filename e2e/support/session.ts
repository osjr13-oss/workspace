import type { BrowserContext, Page } from "@playwright/test";

const SUPABASE = "http://localhost:54321";
const GROQ = "http://localhost:54322";

const USER = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "student@example.test",
  app_metadata: {},
  user_metadata: { full_name: "Test Student" },
  created_at: "2026-01-01T00:00:00.000Z"
};

function fakeJwt() {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "HS256", typ: "JWT" })}.${part({ sub: USER.id, role: "authenticated", exp: 4_102_444_800 })}.sig`;
}

/** Signs the browser in against the mock Supabase. */
export async function signIn(context: BrowserContext) {
  const session = {
    access_token: fakeJwt(),
    token_type: "bearer",
    expires_in: 86_400,
    expires_at: Math.floor(Date.now() / 1000) + 86_400,
    refresh_token: "test-refresh",
    user: USER
  };
  await context.addCookies([
    { name: "sb-localhost-auth-token", value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`, domain: "localhost", path: "/" }
  ]);
}

export async function resetMocks() {
  await fetch(`${SUPABASE}/__reset`);
  await fetch(`${GROQ}/__reset`, { method: "POST" });
}

export async function control(settings: Record<string, unknown>) {
  await fetch(`${GROQ}/__control`, { method: "POST", body: JSON.stringify(settings) });
}

export async function groqRequests(): Promise<Array<Record<string, any>>> {
  return (await fetch(`${GROQ}/__requests`)).json();
}

export async function setQuota(allow: boolean) {
  await fetch(`${SUPABASE}/__quota?allow=${allow}`);
}

export async function tableRows(name: string): Promise<Array<Record<string, any>>> {
  return (await fetch(`${SUPABASE}/__table?name=${name}`)).json();
}

type Sample = { t: number; assistants: number; len: number; trace: boolean };

/** Records, every animation frame, what the last assistant bubble shows. */
export async function installRecorder(page: Page) {
  await page.addInitScript(() => {
    const samples: Sample[] = [];
    (window as any).__samples = samples;
    const start = performance.now();
    const tick = () => {
      const bubbles = Array.from(document.querySelectorAll('article[aria-label="Selrano response"]')) as HTMLElement[];
      const last = bubbles[bubbles.length - 1];
      samples.push({
        t: Math.round(performance.now() - start),
        assistants: bubbles.length,
        len: last ? last.innerText.trim().length : 0,
        trace: Boolean(document.querySelector(".thinking-orbit"))
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    type Sample = { t: number; assistants: number; len: number; trace: boolean };
  });
}

export async function readSamples(page: Page): Promise<Sample[]> {
  return page.evaluate(() => (window as any).__samples as Sample[]);
}

/**
 * Finds visible glitches in the newest reply: text that shrinks or disappears,
 * its bubble being removed, or the thinking mark coming back after words showed.
 * `baseline` is how many assistant bubbles existed when the message was sent.
 */
export function findGlitches(samples: Sample[], baseline: number) {
  const glitches: string[] = [];
  let sawText = false;
  let prev: Sample | null = null;
  for (const sample of samples) {
    const isNewest = sample.assistants > baseline;
    if (isNewest && sample.len > 0) sawText = true;
    if (prev && isNewest && prev.assistants === sample.assistants && sample.len < prev.len) {
      glitches.push(`t=${sample.t}ms text shrank ${prev.len} -> ${sample.len}`);
    }
    if (prev && prev.assistants > baseline && sample.assistants < prev.assistants) {
      glitches.push(`t=${sample.t}ms the reply bubble was removed (${prev.assistants} -> ${sample.assistants})`);
    }
    if (sawText && sample.trace && !prev?.trace) {
      glitches.push(`t=${sample.t}ms thinking mark came back after the reply started`);
    }
    prev = sample;
  }
  return glitches;
}

export async function setLatency(ms: number) {
  await fetch(`${SUPABASE}/__latency?ms=${ms}`);
}

export async function seed(table: string, rows: Array<Record<string, unknown>>) {
  await fetch(`${SUPABASE}/__seed`, { method: "POST", body: JSON.stringify({ table, rows }) });
}

/** Puts an existing conversation in the database: alternating user and assistant messages, oldest first. */
export async function seedConversation(turns: number, answerLength = 400) {
  const threadId = "11111111-1111-4111-8111-111111111111";
  await seed("chat_threads", [{ id: threadId, user_id: USER.id, project_id: null, title: "Earlier chat" }]);
  const base = Date.now() - 3_600_000;
  const rows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < turns; i += 1) {
    rows.push({ thread_id: threadId, user_id: USER.id, role: "user", content: `Earlier question number ${i + 1} about studying`, created_at: new Date(base + i * 2000).toISOString() });
    rows.push({ thread_id: threadId, user_id: USER.id, role: "assistant", content: `Earlier answer ${i + 1}. ` + "Detailed explanation. ".repeat(Math.ceil(answerLength / 22)), created_at: new Date(base + i * 2000 + 1000).toISOString() });
  }
  await seed("chat_messages", rows);
  return threadId;
}
