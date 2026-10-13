/**
 * One small server standing in for every external service the workflows call.
 *
 *   /llm/chat/completions   an OpenAI-compatible reply, chosen by rules below
 *   /db/<table>             an in-memory table with a PostgREST-style API
 *   anything else           recorded, answered with { ok: true, id }
 *
 * Control routes, used by the test runner:
 *   GET    /__calls          every request received since the last reset
 *   POST   /__reset          clear calls, tables, canned routes and failures
 *   POST   /__seed           { table: [rows] }
 *   POST   /__route          { path, response }   a canned reply for a path
 *   POST   /__fail           { path, times, status }   fail the next N requests
 */
import http from "node:http";
import https from "node:https";
import fs from "node:fs";

let calls = [];
let tables = {};
let routes = {};
let failures = [];
let unique = {}; // table -> column that must be unique, as a database constraint would
let script = []; // scripted model replies, see /__llm
let seq = 0;

const send = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

/** The reply an LLM would give, decided by what the system prompt asks for. */
function llm(body) {
  const system = (body.messages ?? []).filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const user = (body.messages ?? []).filter((m) => m.role === "user").map((m) => m.content).join("\n");
  const text = `${system}\n${user}`.toLowerCase();
  let content;
  const tag = /\[task:([a-z-]+)\]/.exec(system)?.[1];
  switch (tag) {
    case "qualify-lead": {
      const fit = /budget|timeline|clinic|team of|\$\d/.test(user.toLowerCase());
      content = JSON.stringify({ score: fit ? 82 : 24, fit, reason: fit ? "States a need, a budget and a timeline." : "No clear need or budget.", missing: fit ? [] : ["budget", "timeline"] });
      break;
    }
    case "support-answer": {
      const known = /refund|shipping|hours|password|invoice/.test(user.toLowerCase());
      content = JSON.stringify({ answer: known ? "Here is what our help centre says about that." : "", confidence: known ? 0.91 : 0.22, sources: known ? ["kb-12"] : [], handover: !known || /angry|lawyer|chargeback|cancel/.test(user.toLowerCase()) });
      break;
    }
    case "classify": {
      const u = user.toLowerCase();
      const label = /refund|charge|invoice|payment/.test(u) ? "billing" : /bug|error|broken|crash/.test(u) ? "technical" : /spam|scam|http/.test(u) ? "spam" : "general";
      content = JSON.stringify({ label, urgent: /urgent|asap|down|immediately/.test(u), sentiment: /angry|terrible|worst/.test(u) ? "negative" : "neutral" });
      break;
    }
    case "moderate": {
      const u = user.toLowerCase();
      const bad = /scam|free nitro|airdrop|http:\/\/|kill/.test(u);
      content = JSON.stringify({ action: bad ? "remove" : /idiot|stupid/.test(u) ? "review" : "allow", reason: bad ? "Looks like a scam link." : "Fine." });
      break;
    }
    case "extract": {
      content = JSON.stringify({ vendor: "Acme Supplies", invoice_number: "INV-1042", total: 1280.5, currency: "USD", due_date: "2026-11-15", confidence: 0.94 });
      break;
    }
    case "outline":
      content = JSON.stringify({ title: "A practical guide", sections: ["What it is", "How it works", "Common mistakes"], keywords: ["guide", "how to"] });
      break;
    case "draft":
      content = "# A practical guide\n\nMock draft body with three sections.\n\n## What it is\n...\n";
      break;
    case "social":
      content = JSON.stringify({ x: "New post: a practical guide.", linkedin: "We published a practical guide.", facebook: "New on the blog." });
      break;
    case "summarise":
      content = "Mock summary: three things happened, one needs attention.";
      break;
    default:
      content = /json/.test(text) ? JSON.stringify({ ok: true }) : "Mock completion.";
  }
  return {
    id: `chatcmpl-mock-${++seq}`,
    object: "chat.completion",
    model: body.model ?? "mock",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 100, completion_tokens: 40, total_tokens: 140 },
  };
}

/* ---- Scripted model replies ----
 * A test posts { replies: [{ system?, last?, text?, json?, tool? }] } to /__llm.
 * `system` and `last` are regular expressions, tested against the system prompt
 * and against the newest message (which is a tool's result when an agent is
 * mid-loop). The first reply that matches and is not used up answers the call;
 * `times` lets one reply answer more than once. With no match the model says so,
 * which makes a missing script obvious in a failing test.
 */
const flat = (c) => (typeof c === "string" ? c : Array.isArray(c) ? c.map((x) => x.text ?? (x.content ? flat(x.content) : JSON.stringify(x))).join("\n") : JSON.stringify(c ?? ""));
function pick(system, last) {
  const hit = script.find((r) => r.used < (r.times ?? 1) && (!r.system || new RegExp(r.system, "is").test(system)) && (!r.last || new RegExp(r.last, "is").test(last)));
  if (!hit) return { text: "UNSCRIPTED: no mock reply matched this request." };
  hit.used += 1;
  return hit;
}
function sse(res, events) {
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
  for (const [event, data] of events) res.write((event ? `event: ${event}\n` : "") + `data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`);
  res.end();
}
function anthropic(res, body) {
  const system = flat(body.system);
  const last = flat(body.messages?.at(-1)?.content);
  const r = pick(system, last);
  const id = `msg_mock_${++seq}`;
  const block = r.tool ? { type: "tool_use", id: `toolu_mock_${seq}`, name: r.tool.name, input: r.tool.input ?? {} } : { type: "text", text: r.json ? JSON.stringify(r.json) : (r.text ?? "") };
  const stop = r.tool ? "tool_use" : "end_turn";
  const usage = { input_tokens: 120, output_tokens: 40 };
  const head = { id, type: "message", role: "assistant", model: body.model ?? "claude-mock" };
  if (!body.stream) return send(res, 200, { ...head, content: [block], stop_reason: stop, stop_sequence: null, usage });
  const events = [["message_start", { type: "message_start", message: { ...head, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 120, output_tokens: 0 } } }]];
  if (r.tool) {
    events.push(["content_block_start", { type: "content_block_start", index: 0, content_block: { ...block, input: {} } }]);
    events.push(["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: JSON.stringify(block.input) } }]);
  } else {
    events.push(["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }]);
    events.push(["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: block.text } }]);
  }
  events.push(["content_block_stop", { type: "content_block_stop", index: 0 }]);
  events.push(["message_delta", { type: "message_delta", delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 40 } }]);
  events.push(["message_stop", { type: "message_stop" }]);
  sse(res, events);
}
function openai(res, body) {
  const system = (body.messages ?? []).filter((m) => m.role === "system" || m.role === "developer").map((m) => flat(m.content)).join("\n");
  const last = flat(body.messages?.at(-1)?.content);
  const r = pick(system, last);
  const id = `chatcmpl-mock-${++seq}`;
  const message = r.tool
    ? { role: "assistant", content: null, tool_calls: [{ id: `call_mock_${seq}`, type: "function", function: { name: r.tool.name, arguments: JSON.stringify(r.tool.input ?? {}) } }] }
    : { role: "assistant", content: r.json ? JSON.stringify(r.json) : (r.text ?? "") };
  const finish = r.tool ? "tool_calls" : "stop";
  const usage = { prompt_tokens: 120, completion_tokens: 40, total_tokens: 160 };
  if (!body.stream) return send(res, 200, { id, object: "chat.completion", created: 0, model: body.model ?? "gpt-mock", choices: [{ index: 0, message, finish_reason: finish }], usage });
  const chunk = (delta, finish_reason = null) => ({ id, object: "chat.completion.chunk", created: 0, model: body.model ?? "gpt-mock", choices: [{ index: 0, delta, finish_reason }] });
  const first = r.tool ? { role: "assistant", tool_calls: [{ index: 0, ...message.tool_calls[0] }] } : { role: "assistant", content: message.content };
  sse(res, [[null, chunk(first)], [null, chunk({}, finish)], [null, { ...chunk({}, null), choices: [], usage }], [null, "[DONE]"]]);
}
/** A fixed-length vector that depends only on the text, so retrieval is repeatable. */
function embeddings(body) {
  const inputs = Array.isArray(body.input) ? body.input : [body.input ?? ""];
  const dims = body.dimensions ?? 1536;
  return {
    object: "list",
    model: body.model ?? "text-embedding-mock",
    data: inputs.map((text, index) => {
      let h = 7;
      for (const c of String(text)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      return { object: "embedding", index, embedding: Array.from({ length: dims }, (_, i) => (((h >>> (i % 24)) & 255) / 255) * 0.02) };
    }),
    usage: { prompt_tokens: 8, total_tokens: 8 },
  };
}

/** `field=eq.value` filters, the way PostgREST writes them. */
function filterRows(rows, query) {
  let out = rows;
  for (const [k, v] of query) {
    if (["on_conflict", "select", "order", "limit"].includes(k)) continue;
    const m = /^(eq|neq|lt|lte|gt|gte|is)\.(.*)$/.exec(v);
    if (!m) continue;
    const [, op, raw] = m;
    const cmp = (a) => {
      const b = typeof a === "number" ? Number(raw) : raw === "true" ? true : raw === "false" ? false : raw === "null" ? null : raw;
      if (op === "eq" || op === "is") return a === b || String(a) === String(raw);
      if (op === "neq") return String(a) !== String(raw);
      if (op === "lt") return a < b;
      if (op === "lte") return a <= b;
      if (op === "gt") return a > b;
      return a >= b;
    };
    out = out.filter((r) => cmp(r[k]));
  }
  const limit = query.get("limit");
  return limit ? out.slice(0, Number(limit)) : out;
}

function db(req, res, url, body, table = url.pathname.split("/")[2]) {
  const rows = (tables[table] ??= []);
  if (req.method === "GET") return send(res, 200, filterRows(rows, url.searchParams));
  if (req.method === "POST") {
    const key = url.searchParams.get("on_conflict");
    const merge = /merge-duplicates/.test(req.headers.prefer ?? "");
    const incoming = Array.isArray(body) ? body : [body];
    const inserted = [];
    for (const row of incoming) {
      const existing = key && rows.find((r) => String(r[key]) === String(row[key]));
      if (existing && merge) {
        Object.assign(existing, row);
        inserted.push(existing);
        continue;
      }
      if (existing) continue;
      // No ON CONFLICT clause: a unique constraint refuses the row, as Postgres does.
      const col = unique[table];
      if (!key && col && rows.some((r) => String(r[col]) === String(row[col]))) {
        return send(res, 409, { code: "23505", details: `Key (${col})=(${row[col]}) already exists.`, hint: null, message: `duplicate key value violates unique constraint "${table}_${col}_key"` });
      }
      const withId = { id: row.id ?? `row_${++seq}`, ...row };
      rows.push(withId);
      inserted.push(withId);
    }
    return send(res, 201, inserted);
  }
  if (req.method === "PATCH") {
    const hit = filterRows(rows, url.searchParams);
    hit.forEach((r) => Object.assign(r, body));
    return send(res, 200, hit);
  }
  if (req.method === "DELETE") {
    const hit = filterRows(rows, url.searchParams);
    tables[table] = rows.filter((r) => !hit.includes(r));
    return send(res, 200, hit);
  }
  send(res, 405, { error: "method not allowed" });
}

const handle = (req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const url = new URL(req.url, "http://mocks");
      let body = raw;
      try {
        body = raw ? JSON.parse(raw) : undefined;
      } catch {}
      const p = url.pathname;

      if (p === "/__calls") return send(res, 200, calls);
      if (p === "/__reset") {
        calls = [];
        tables = {};
        routes = {};
        failures = [];
        script = [];
        unique = {};
        return send(res, 200, { ok: true });
      }
      if (p === "/__seed") {
        for (const [t, rows] of Object.entries(body ?? {})) tables[t] = structuredClone(rows);
        return send(res, 200, { ok: true });
      }
      if (p === "/__route") {
        routes[body.path] = body.response;
        return send(res, 200, { ok: true });
      }
      if (p === "/__fail") {
        failures.push({ ...body });
        return send(res, 200, { ok: true });
      }
      if (p === "/__unique") {
        Object.assign(unique, body ?? {});
        return send(res, 200, { ok: true });
      }
      if (p === "/__llm") {
        script = (body.replies ?? []).map((r) => ({ ...r, used: 0 }));
        return send(res, 200, { ok: true });
      }
      if (p === "/health") return send(res, 200, { ok: true });

      calls.push({ host: (req.headers.host ?? "").split(":")[0], method: req.method, path: p, query: Object.fromEntries(url.searchParams), headers: req.headers, body });

      const failing = failures.find((f) => p.startsWith(f.path) && f.times > 0);
      if (failing) {
        failing.times -= 1;
        return send(res, failing.status ?? 503, { error: "mock failure" });
      }
      const host = (req.headers.host ?? "").split(":")[0];
      if (`${host}${p}` in routes) return send(res, 200, routes[`${host}${p}`]);
      if (p in routes) return send(res, 200, routes[p]);
      if (host === "api.anthropic.com" && p === "/v1/messages") return anthropic(res, body ?? {});
      if (host === "api.openai.com" && p === "/v1/chat/completions") return openai(res, body ?? {});
      if (host === "api.openai.com" && p === "/v1/embeddings") return send(res, 200, embeddings(body ?? {}));
      if (p.startsWith("/llm/")) return send(res, 200, llm(body ?? {}));
      if (p.startsWith("/db/")) return db(req, res, url, body);
      if (host.endsWith(".supabase.co") && p.startsWith("/rest/v1/")) return db(req, res, url, body, p.split("/")[3]);
      send(res, 200, { ok: true, id: `mock_${++seq}` });
    });
};

http.createServer(handle).listen(4010, () => console.log("mocks on :4010"));
// The same server over TLS on 443, for the platforms' own hostnames (see docker-compose.yml).
if (fs.existsSync("/certs/key.pem")) {
  https.createServer({ key: fs.readFileSync("/certs/key.pem"), cert: fs.readFileSync("/certs/cert.pem") }, handle).listen(443, () => console.log("mocks on :443"));
}
