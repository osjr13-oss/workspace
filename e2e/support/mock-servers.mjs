// Offline stand-ins for Supabase (port 54321) and Gemini (port 54322) so the real
// app can be driven end to end without any account or network.
//
//   node e2e/support/mock-servers.mjs
//
// Gemini behavior is steered through a control API on the Gemini port:
//   POST /__control   { "failNext": [{ "status": 429, "retryAfter": 1 }], "quota": false, ... }
//   GET  /__requests  every chat completion request received so far
//   POST /__reset     clear requests and scenarios
import http from "node:http";
import crypto from "node:crypto";

const SUPABASE_PORT = 54321;
const AI_PORT = 54322;
const ORIGINS = new Set(["http://localhost:3000", "http://127.0.0.1:3000"]);

export const TEST_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "student@example.test",
  app_metadata: {},
  user_metadata: { full_name: "Test Student" },
  created_at: "2026-01-01T00:00:00.000Z"
};

// ---------------------------------------------------------------- Supabase --

const tables = new Map();
const control = { quota: true, latencyMs: Number(process.env.MOCK_LATENCY_MS || 0), userEmail: TEST_USER.email, quotaReservations: 0 };

function table(name) {
  if (!tables.has(name)) tables.set(name, []);
  return tables.get(name);
}

function reset() {
  tables.clear();
  control.userEmail = TEST_USER.email;
  table("user_limits").push({ user_id: TEST_USER.id, tier: "free", subscription_status: null });
  table("profiles").push({ id: TEST_USER.id, full_name: "Test Student", email_opt_in: true });
}

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && ORIGINS.has(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS");
  res.setHeader("Access-Control-Expose-Headers", "Content-Range");
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => resolve(raw));
  });
}

function matches(row, key, expr) {
  const value = key.includes("->>") ? row[key.split("->>")[0]]?.[key.split("->>")[1]] : row[key];
  const dot = expr.indexOf(".");
  const op = expr.slice(0, dot);
  const operand = expr.slice(dot + 1);
  switch (op) {
    case "eq":
      return String(value) === operand;
    case "neq":
      return String(value) !== operand;
    case "gt":
      return String(value) > operand;
    case "gte":
      return String(value) >= operand;
    case "lt":
      return String(value) < operand;
    case "lte":
      return String(value) <= operand;
    case "in":
      return operand.replace(/^\(|\)$/g, "").split(",").includes(String(value));
    case "is":
      return operand === "null" ? value === null || value === undefined : String(value) === operand;
    default:
      return true;
  }
}

function filterRows(rows, params) {
  const reserved = new Set(["select", "order", "limit", "offset", "on_conflict", "or", "and", "columns"]);
  let result = rows.filter((row) => {
    for (const [key, expr] of params.entries()) {
      if (reserved.has(key)) continue;
      if (!matches(row, key, expr)) return false;
    }
    return true;
  });
  const order = params.get("order");
  if (order) {
    const specs = order.split(",").map((part) => {
      const [col, dir] = part.split(".");
      return { col, desc: dir === "desc" };
    });
    result = [...result].sort((a, b) => {
      for (const { col, desc } of specs) {
        if (a[col] === b[col]) continue;
        const cmp = String(a[col] ?? "") < String(b[col] ?? "") ? -1 : 1;
        return desc ? -cmp : cmp;
      }
      return 0;
    });
  }
  const limit = Number(params.get("limit"));
  if (limit > 0) result = result.slice(0, limit);
  return result;
}

function sendJson(res, status, body, extra = {}) {
  res.writeHead(status, { "Content-Type": "application/json", ...extra });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

async function handleSupabase(req, res) {
  cors(req, res);
  if (control.latencyMs && !req.url.startsWith("/__")) await new Promise((r) => setTimeout(r, control.latencyMs));
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;

  if (path === "/__reset") {
    reset();
    control.quota = true;
    control.quotaReservations = 0;
    control.latencyMs = Number(process.env.MOCK_LATENCY_MS || 0);
    return sendJson(res, 200, { ok: true });
  }
  if (path === "/__latency") {
    control.latencyMs = Number(url.searchParams.get("ms") || 0);
    return sendJson(res, 200, { ok: true });
  }
  if (path === "/__quota-reservations") return sendJson(res, 200, { count: control.quotaReservations });
  if (path === "/__quota") {
    control.quota = url.searchParams.get("allow") !== "false";
    return sendJson(res, 200, { ok: true });
  }
  if (path === "/__seed") {
    const { table: name, rows: seeded } = JSON.parse((await readBody(req)) || "{}");
    for (const row of seeded || []) {
      const now = new Date().toISOString();
      table(name).push({ id: crypto.randomUUID(), created_at: now, updated_at: now, ...row });
    }
    return sendJson(res, 200, { ok: true });
  }
  // Signs the session in as a different email, e.g. one that is not on ALLOWED_EMAILS.
  if (path === "/__user") {
    control.userEmail = url.searchParams.get("email") || TEST_USER.email;
    return sendJson(res, 200, { ok: true });
  }
  if (path === "/__table") {
    return sendJson(res, 200, table(url.searchParams.get("name") || ""));
  }

  if (path === "/auth/v1/user") return sendJson(res, 200, { ...TEST_USER, email: control.userEmail });
  if (path === "/auth/v1/logout") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (path.startsWith("/auth/v1/")) return sendJson(res, 200, {});

  const rpc = path.match(/^\/rest\/v1\/rpc\/(\w+)/);
  if (rpc) {
    await readBody(req);
    if (rpc[1] === "reserve_ai_usage") { control.quotaReservations++; return sendJson(res, 200, control.quota); }
    if (rpc[1] === "check_rate_limit") return sendJson(res, 200, true);
    if (rpc[1] === "search_chunks_fts") return sendJson(res, 200, []);
    return sendJson(res, 200, null);
  }

  const rest = path.match(/^\/rest\/v1\/(\w+)/);
  if (!rest) return sendJson(res, 404, { message: "not found" });

  const rows = table(rest[1]);
  const wantsObject = (req.headers.accept || "").includes("vnd.pgrst.object");
  const prefer = req.headers.prefer || "";
  const representation = prefer.includes("return=representation");

  const respondRows = (list, status = 200) => {
    if (wantsObject) {
      if (list.length !== 1) {
        return sendJson(res, 406, {
          code: "PGRST116",
          details: `The result contains ${list.length} rows`,
          message: "JSON object requested, multiple (or no) rows returned"
        });
      }
      return sendJson(res, status, list[0]);
    }
    return sendJson(res, status, list);
  };

  if (req.method === "GET" || req.method === "HEAD") {
    const list = filterRows(rows, url.searchParams);
    if (req.method === "HEAD") {
      res.writeHead(200, { "Content-Range": `*/${list.length}` });
      res.end();
      return;
    }
    return respondRows(list);
  }

  if (req.method === "POST") {
    const raw = await readBody(req);
    const payload = raw ? JSON.parse(raw) : [];
    const items = Array.isArray(payload) ? payload : [payload];
    const created = [];
    for (const item of items) {
      const now = new Date().toISOString();
      const row = { id: crypto.randomUUID(), created_at: now, updated_at: now, ...item };
      const upsertKey = url.searchParams.get("on_conflict") || (prefer.includes("merge-duplicates") ? (rest[1] === "style_profiles" ? "user_id" : "id") : null);
      const existing = upsertKey ? rows.findIndex((r) => r[upsertKey] === row[upsertKey]) : -1;
      if (existing >= 0) {
        rows[existing] = { ...rows[existing], ...item };
        created.push(rows[existing]);
      } else {
        rows.push(row);
        created.push(row);
      }
    }
    if (!representation) {
      res.writeHead(201);
      res.end();
      return;
    }
    return respondRows(created, 201);
  }

  if (req.method === "PATCH") {
    const raw = await readBody(req);
    const patch = raw ? JSON.parse(raw) : {};
    const targets = filterRows(rows, url.searchParams);
    for (const row of targets) Object.assign(row, patch);
    if (!representation) {
      res.writeHead(204);
      res.end();
      return;
    }
    return respondRows(targets);
  }

  if (req.method === "DELETE") {
    const targets = new Set(filterRows(rows, url.searchParams));
    for (let i = rows.length - 1; i >= 0; i -= 1) if (targets.has(rows[i])) rows.splice(i, 1);
    res.writeHead(204);
    res.end();
    return;
  }

  return sendJson(res, 405, { message: "method not allowed" });
}

// -------------------------------------------------------------------- Gemini --

const aiState = { requests: [], failNext: [], toolNext: false, toolPreface: "", reply: null, emptyNext: false, tokenDelayMs: 2, firstTokenDelayMs: 0, chunkChars: 0 };

function aiReset() {
  for (const key of ["toolName", "toolArgs", "grounding", "groundedText", "partial", "structuredReply", "assessment", "webFailure", "webDelayMs", "researchUnavailable"]) delete aiState[key];
  aiState.requests = [];
  aiState.failNext = [];
  aiState.toolNext = false;
  aiState.firstTokenDelayMs = 0;
  aiState.chunkChars = 0;
  aiState.toolPreface = "";
  aiState.reply = null;
  aiState.emptyNext = false;
  aiState.tokenDelayMs = 2;
}

function approxTokens(messages, tools) {
  const text = JSON.stringify(messages) + (tools ? JSON.stringify(tools) : "");
  return Math.ceil(text.length / 4);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function defaultReply(lastUser) {
  const topic = (lastUser || "that").slice(0, 60);
  return (
    `Here is a clear answer about ${topic}. ` +
    "The main idea is to break the problem into small steps, check each one, and keep notes as you go. " +
    "First, define what you are trying to achieve. Second, gather the facts you already have. " +
    "Third, test one change at a time so you know what worked.\n\n" +
    "If you want, I can go deeper on any of those steps."
  );
}

// Fixed public evidence fixtures. Keep research calls separate from ordinary transport controls.
const SOURCE_URL = "https://agency.gov/program";
const SOURCE_PASSAGE = "Applications close on 30 November 2026. Eligibility requires residence in New York.";
let researchRequests = [];
let webRequests = [];
function researchInput(body) {
  const user = [...(body.messages || [])].reverse().find((m) => m.role === "user");
  const content = typeof user?.content === "string" ? user.content : user?.content?.find((b) => b.type === "text")?.text;
  try { const v = JSON.parse(content); return v.stage?.startsWith("research_") ? v : null; } catch { return null; }
}
async function handleGemini(req, res, url) {
  const native = JSON.parse(await readBody(req));
  if (url.pathname.endsWith(":embedContent")) return sendJson(res, 200, { embedding: { values: Array.from({ length: 1536 }, (_, i) => i === 0 ? 1 : 0) } });
  const stream = url.pathname.endsWith(":streamGenerateContent");
  const model = decodeURIComponent(url.pathname.split("/").at(-1).split(":")[0]);
  const system = native.systemInstruction?.parts?.map((p) => p.text || "").join("\n") || "";
  const messages = [{ role: "system", content: system }, ...(native.contents || []).map((c) => ({ role: c.role === "model" ? "assistant" : "user", content: c.parts.map((p) => p.text || p.functionResponse?.response?.result || "").join(""), parts: c.parts }))];
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const payload = (text, groundingMetadata) => ({ modelVersion: model, candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP", ...(groundingMetadata ? { groundingMetadata } : {}) }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20 } });
  const v = researchInput({ messages });
  if (v) {
    researchRequests.push({ ...v, provider: "gemini", native });
    if (aiState.researchUnavailable) return sendJson(res, 503, {});
    const need = /latest|current|today|research|verify|look.*up|search the web|applications close|eligibility|what about/i.test(JSON.stringify(v.input));
    const answer = aiState.assessment ?? { decision: need ? "search" : "ordinary", query: need ? "agency program deadline New York official" : "", clarification: "", consequential: need };
    return sendJson(res, 200, payload(JSON.stringify(answer)));
  }
  if (native.tools?.some((t) => t.google_search)) {
    researchRequests.push({ stage: "google_grounding", provider: "gemini", native });
    if (aiState.webDelayMs) await sleep(aiState.webDelayMs);
    if (aiState.webFailure) return sendJson(res, 503, {});
    const text = aiState.groundedText ?? "Applications close on 30 November 2026.";
    const grounding = aiState.grounding ?? { webSearchQueries: ["program deadline"], searchEntryPoint: { renderedContent: '<a href="https://www.google.com/search?q=program">Search Google</a>' }, groundingChunks: [{ web: { uri: SOURCE_URL, title: "Agency program" } }], groundingSupports: [{ segment: { startIndex: 0, endIndex: text.length, text }, groundingChunkIndices: [0] }] };
    return sendJson(res, 200, payload(text, grounding));
  }
  aiState.requests.push({ native, at: Date.now(), model, stream, tools: Boolean(native.tools?.length), messageCount: messages.length, approxTokens: approxTokens(messages.map(({ role, content }) => ({ role, content })), native.tools), reasoning_effort: native.generationConfig?.thinkingConfig?.thinkingLevel, max_completion_tokens: native.generationConfig?.maxOutputTokens, lastUser: lastUser.slice(0, 80), system: system.slice(0, 60), systemText: system });
  const fail = aiState.failNext.shift();
  if (fail) { res.writeHead(fail.status || 429, { "Content-Type": "application/json", "retry-after": String(fail.retryAfter || 1) }); return res.end(JSON.stringify({ error: { message: "Unavailable" } })); }
  if (!stream) {
    const image = native.contents?.some((c) => c.parts.some((p) => p.inlineData));
    const text = image ? "Image transcription." : system.includes("Extract lasting facts") ? "[]" : aiState.structuredReply ?? "ok";
    return sendJson(res, 200, payload(text));
  }
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  const send = (parts, finishReason) => res.write(`data: ${JSON.stringify({ modelVersion: model, candidates: [{ content: { role: "model", parts }, ...(finishReason ? { finishReason } : {}) }] })}\n\n`);
  send([{ thought: true, text: "PRIVATE_REASONING", thoughtSignature: "test-thought" }]);
  if (aiState.toolNext && native.tools?.length && native.toolConfig?.functionCallingConfig?.mode !== "NONE") {
    aiState.toolNext = false;
    if (aiState.toolPreface) send([{ text: aiState.toolPreface }]);
    send([{ functionCall: { name: aiState.toolName || "search_workspace", args: aiState.toolArgs || { query: "biology" } }, thoughtSignature: "test-signature" }], "STOP");
    return res.end();
  }
  if (aiState.emptyNext) {
    aiState.emptyNext = aiState.emptyNext === true ? false : aiState.emptyNext - 1 || false;
    send([], "STOP"); return res.end();
  }
  if (aiState.firstTokenDelayMs) await sleep(aiState.firstTokenDelayMs);
  const text = aiState.reply ?? defaultReply(lastUser);
  let pending = "";
  for (const word of text.split(/(\s+)/)) {
    pending += word;
    if (aiState.chunkChars && pending.length < aiState.chunkChars) continue;
    send([{ text: pending }]); pending = "";
    if (aiState.partial) return res.end();
    if (aiState.tokenDelayMs) await sleep(aiState.tokenDelayMs);
  }
  if (pending) send([{ text: pending }]);
  if (aiState.partial) return res.end();
  send([], "STOP"); res.end();
}

async function handleAi(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/gemini/models/")) return handleGemini(req, res, url);

  if (url.pathname === "/__reset") {
    aiReset();
    researchRequests = []; webRequests = [];
    return sendJson(res, 200, { ok: true });
  }
  if (url.pathname === "/__research_requests") return sendJson(res, 200, researchRequests);
  if (url.pathname === "/__web_requests") return sendJson(res, 200, webRequests);
  if (url.pathname === "/__requests") return sendJson(res, 200, aiState.requests);
  if (url.pathname === "/__control") {
    const body = JSON.parse((await readBody(req)) || "{}");
    Object.assign(aiState, body);
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { error: "Unexpected AI endpoint" });
}

reset();
http.createServer((req, res) => handleSupabase(req, res).catch((e) => { console.error(e); res.writeHead(500); res.end(); })).listen(SUPABASE_PORT, () => console.log(`mock supabase on ${SUPABASE_PORT}`));
http.createServer((req, res) => handleAi(req, res).catch((e) => { console.error(e); res.writeHead(500); res.end(); })).listen(AI_PORT, () => console.log(`mock Gemini on ${AI_PORT}`));
