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

let calls = [];
let tables = {};
let routes = {};
let failures = [];
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

function db(req, res, url, body) {
  const table = url.pathname.split("/")[2];
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

http
  .createServer((req, res) => {
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
      if (p === "/health") return send(res, 200, { ok: true });

      calls.push({ method: req.method, path: p, query: Object.fromEntries(url.searchParams), headers: req.headers, body });

      const failing = failures.find((f) => p.startsWith(f.path) && f.times > 0);
      if (failing) {
        failing.times -= 1;
        return send(res, failing.status ?? 503, { error: "mock failure" });
      }
      if (p in routes) return send(res, 200, routes[p]);
      if (p.startsWith("/llm/")) return send(res, 200, llm(body ?? {}));
      if (p.startsWith("/db/")) return db(req, res, url, body);
      send(res, 200, { ok: true, id: `mock_${++seq}` });
    });
  })
  .listen(4010, () => console.log("mocks on :4010"));
