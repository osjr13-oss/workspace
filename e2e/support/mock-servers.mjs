// Offline stand-ins for Supabase (port 54321) and Groq (port 54322) so the real
// app can be driven end to end without any account or network.
//
//   node e2e/support/mock-servers.mjs
//
// Groq behavior is steered through a control API on the Groq port:
//   POST /__control   { "failNext": [{ "status": 429, "retryAfter": 1 }], "quota": false, ... }
//   GET  /__requests  every chat completion request received so far
//   POST /__reset     clear requests and scenarios
import http from "node:http";
import crypto from "node:crypto";

const SUPABASE_PORT = 54321;
const GROQ_PORT = 54322;
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
const control = { quota: true, latencyMs: Number(process.env.MOCK_LATENCY_MS || 0), userEmail: TEST_USER.email };

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
  const value = row[key];
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
    control.latencyMs = Number(process.env.MOCK_LATENCY_MS || 0);
    return sendJson(res, 200, { ok: true });
  }
  if (path === "/__latency") {
    control.latencyMs = Number(url.searchParams.get("ms") || 0);
    return sendJson(res, 200, { ok: true });
  }
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
    if (rpc[1] === "reserve_ai_usage") return sendJson(res, 200, control.quota);
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

// -------------------------------------------------------------------- Groq --

const groqState = { requests: [], failNext: [], toolNext: false, toolPreface: "", reply: null, emptyNext: false, tokenDelayMs: 2, firstTokenDelayMs: 0, chunkChars: 0 };

function groqReset() {
  groqState.requests = [];
  groqState.failNext = [];
  groqState.toolNext = false;
  groqState.firstTokenDelayMs = 0;
  groqState.chunkChars = 0;
  groqState.toolPreface = "";
  groqState.reply = null;
  groqState.emptyNext = false;
  groqState.tokenDelayMs = 2;
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

async function handleGroq(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/__reset") {
    groqReset();
    return sendJson(res, 200, { ok: true });
  }
  if (url.pathname === "/__requests") return sendJson(res, 200, groqState.requests);
  if (url.pathname === "/__control") {
    const body = JSON.parse((await readBody(req)) || "{}");
    Object.assign(groqState, body);
    return sendJson(res, 200, { ok: true });
  }

  if (!url.pathname.endsWith("/chat/completions")) return sendJson(res, 404, { error: "not found" });

  const body = JSON.parse(await readBody(req));
  const messages = body.messages || [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const lastUserText = typeof lastUser?.content === "string" ? lastUser.content : "";
  groqState.requests.push({
    at: Date.now(),
    model: body.model,
    stream: Boolean(body.stream),
    tools: Boolean(body.tools?.length),
    messageCount: messages.length,
    approxTokens: approxTokens(messages, body.tools),
    reasoning_effort: body.reasoning_effort,
    max_completion_tokens: body.max_completion_tokens ?? body.max_tokens,
    lastUser: lastUserText.slice(0, 80),
    system: typeof messages[0]?.content === "string" ? messages[0].content.slice(0, 60) : "",
    systemText: messages
      .filter((m) => m.role === "system" && typeof m.content === "string")
      .map((m) => m.content)
      .join("\n")
      .slice(0, 12000)
  });

  const fail = groqState.failNext.shift();
  if (fail) {
    res.writeHead(fail.status || 429, {
      "Content-Type": "application/json",
      ...(fail.retryAfter ? { "retry-after": String(fail.retryAfter) } : {})
    });
    res.end(
      JSON.stringify({
        error: {
          message:
            fail.message ||
            "Rate limit reached for model `openai/gpt-oss-120b` in organization `org_test` service tier `on_demand` on tokens per minute (TPM): Limit 8000, Used 7000, Requested 3000. Please try again in 6.1s.",
          type: "tokens",
          code: "rate_limit_exceeded"
        }
      })
    );
    return;
  }

  // Background calls (memory extraction and similar) are non-streaming.
  if (!body.stream) {
    const isExtraction = JSON.stringify(messages[0]?.content || "").includes("Extract lasting facts");
    const content = isExtraction ? "[]" : "ok";
    sendJson(res, 200, {
      choices: [{ message: { role: "assistant", content } }],
      usage: { prompt_tokens: approxTokens(messages), completion_tokens: 5 }
    });
    return;
  }

  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
  const send = (delta, finish = null) =>
    res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`);

  if (groqState.toolNext && body.tools?.length) {
    groqState.toolNext = false;
    if (groqState.toolPreface) send({ role: "assistant", content: groqState.toolPreface });
    send({ role: "assistant", content: null, tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "web_search", arguments: "" } }] });
    send({ tool_calls: [{ index: 0, function: { arguments: '{"query":"latest news"}' } }] });
    send({}, "tool_calls");
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }

  if (groqState.emptyNext) {
    groqState.emptyNext = groqState.emptyNext === true ? false : groqState.emptyNext - 1 || false;
    send({ role: "assistant", content: "" });
    send({}, "stop");
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }

  const text = groqState.reply ?? defaultReply(lastUserText);
  const words = text.split(/(\s+)/);
  send({ role: "assistant", content: "" });
  if (groqState.firstTokenDelayMs) await sleep(groqState.firstTokenDelayMs);
  // chunkChars groups words into bursts, the way the real Groq delivers a fast reply.
  let pending = "";
  for (const word of words) {
    if (!word) continue;
    pending += word;
    if (groqState.chunkChars && pending.length < groqState.chunkChars) continue;
    send({ content: pending });
    pending = "";
    if (groqState.tokenDelayMs) await sleep(groqState.tokenDelayMs);
  }
  if (pending) send({ content: pending });
  send({}, "stop");
  res.write("data: [DONE]\n\n");
  res.end();
}

reset();
http.createServer((req, res) => handleSupabase(req, res).catch((e) => { console.error(e); res.writeHead(500); res.end(); })).listen(SUPABASE_PORT, () => console.log(`mock supabase on ${SUPABASE_PORT}`));
http.createServer((req, res) => handleGroq(req, res).catch((e) => { console.error(e); res.writeHead(500); res.end(); })).listen(GROQ_PORT, () => console.log(`mock groq on ${GROQ_PORT}`));
