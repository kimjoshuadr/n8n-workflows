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

/**
 * What a model would say for one of the library's standing prompts, decided by
 * the prompt's id and the message. This is the default when a test scripts no
 * reply: enough for a workflow's ordinary paths to run without every test
 * spelling the model out.
 */
function canned(tag, user) {
  let content;
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
      return null;
  }
  return content;
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
  if (!hit) {
    const tag = /\[task:([a-z-]+)\]/.exec(system)?.[1];
    const content = tag ? canned(tag, last) : null;
    if (content === null) return { text: "UNSCRIPTED: no mock reply matched this request." };
    try {
      const final = JSON.parse(content);
      if (final && typeof final === "object") return { final };
    } catch {}
    return { text: content };
  }
  hit.used += 1;
  return hit;
}
function sse(res, events) {
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
  for (const [event, data] of events) res.write((event ? `event: ${event}\n` : "") + `data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`);
  res.end();
}
/** `final` is an agent's structured answer: sent through the output tool when the request offers one. */
function settle(r, tools) {
  // n8n names a tool after its node, with its own spelling rules. A script may use the node's name as written.
  if (r.tool) {
    const norm = (n) => String(n).toLowerCase().replace(/[^a-z0-9]/g, "");
    const offered = (tools ?? []).map((t) => t.name ?? t.function?.name).find((n) => norm(n) === norm(r.tool.name));
    return offered ? { ...r, tool: { ...r.tool, name: offered } } : r;
  }
  if (r.final === undefined) return r;
  const viaTool = (tools ?? []).some((t) => (t.name ?? t.function?.name) === "format_final_json_response");
  return viaTool ? { ...r, tool: { name: "format_final_json_response", input: { output: r.final } } } : { ...r, json: r.final };
}
function anthropic(res, body) {
  const system = flat(body.system);
  const last = flat(body.messages?.at(-1)?.content);
  const r = settle(pick(system, last), body.tools);
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
  const r = settle(pick(system, last), body.tools);
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
      const vector = Array.from({ length: dims }, (_, i) => (((h >>> (i % 24)) & 255) / 255) * 0.02);
      const embedding = body.encoding_format === "base64" ? Buffer.from(new Float32Array(vector).buffer).toString("base64") : vector;
      return { object: "embedding", index, embedding };
    }),
    usage: { prompt_tokens: 8, total_tokens: 8 },
  };
}

/** One PostgREST condition against one row. */
function holds(row, col, op, raw) {
  // PostgREST quotes a value that holds reserved characters: email.eq."a@b.co"
  if (/^".*"$/s.test(raw)) raw = raw.slice(1, -1).replace(/\\"/g, '"');
  const a = row[col];
  const b = typeof a === "number" ? Number(raw) : raw === "true" ? true : raw === "false" ? false : raw === "null" ? null : raw;
  if (op === "eq" || op === "is") return a === b || (a !== undefined && a !== null && String(a) === String(raw)) || (raw === "null" && a === undefined);
  if (op === "neq") return String(a) !== String(raw);
  if (a === undefined || a === null) return false;
  if (op === "lt") return a < b;
  if (op === "lte") return a <= b;
  if (op === "gt") return a > b;
  if (op === "gte") return a >= b;
  if (op === "like" || op === "ilike") return new RegExp("^" + String(raw).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/[*%]/g, ".*") + "$", op === "ilike" ? "i" : "").test(String(a));
  return true;
}

/**
 * PostgREST filters: `field=eq.value` in the query, and the combined form
 * `and=(field.eq.value,other.gte.value)` that the Supabase node sends for reads.
 */
function filterRows(rows, query) {
  let out = rows;
  for (const [k, v] of query) {
    if (["on_conflict", "select", "order", "limit", "offset"].includes(k)) continue;
    if (k === "and" || k === "or") {
      const conds = v.replace(/^\(|\)$/g, "").split(/,(?=[A-Za-z_]+\.(?:eq|neq|gt|gte|lt|lte|is|like|ilike)\.)/).map((c) => /^([A-Za-z_]+)\.([a-z]+)\.(.*)$/s.exec(c)).filter(Boolean);
      out = out.filter((r) => (k === "and" ? conds.every((m) => holds(r, m[1], m[2], m[3])) : conds.some((m) => holds(r, m[1], m[2], m[3]))));
      continue;
    }
    const m = /^(eq|neq|lt|lte|gt|gte|is|like|ilike)\.(.*)$/s.exec(v);
    if (m) out = out.filter((r) => holds(r, k, m[1], m[2]));
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


/** A canned reply of `{ __raw, type }` is sent as that text, not as JSON: a feed, a page, a file. */
const reply = (res, body) => {
  if (body && typeof body === "object" && "__raw" in body) {
    res.writeHead(200, { "content-type": body.type ?? "text/plain; charset=utf-8" });
    return res.end(body.__raw);
  }
  send(res, 200, body);
};

const PIXEL = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

/**
 * Telegram. A "send and wait" message carries a link back into the waiting
 * run; a person would tap it. Here the next seeded row of `telegram_replies`
 * does: { approve: true | false } presses a button, { text } fills in the
 * reply form. With nothing seeded, the answer is yes.
 */
const N8N_INSIDE = "http://n8n:5678";
// n8n ignores link-preview bots on these links, so the tap has to look like a browser's.
const BROWSER = { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" };
async function answerTelegram(body) {
  const markup = typeof body?.reply_markup === "string" ? JSON.parse(body.reply_markup) : body?.reply_markup;
  const links = (markup?.inline_keyboard ?? []).flat().map((b) => b.url).filter((u) => u && u.includes("/webhook-waiting/"));
  if (!links.length) return;
  const answer = (tables.telegram_replies ?? []).shift() ?? { approve: true };
  const inside = (u) => N8N_INSIDE + new URL(u).pathname + new URL(u).search;
  await new Promise((r) => setTimeout(r, 700));
  try {
    if ("text" in answer) {
      const form = new FormData();
      form.set("field-0", answer.text);
      const r = await fetch(inside(links[0]), { method: "POST", body: form, headers: BROWSER });
      if (!r.ok) console.log("telegram answer refused:", r.status, (await r.text()).slice(0, 200));
    } else {
      const want = answer.approve ? "approved=true" : "approved=false";
      const r = await fetch(inside(links.find((u) => u.includes(want)) ?? links[0]), { headers: BROWSER });
      if (!r.ok) console.log("telegram answer refused:", r.status, (await r.text()).slice(0, 200));
    }
  } catch (e) {
    console.log("telegram answer failed:", e.message);
  }
}

/** Gemini's own API, answered from the same script as the other models. */
function gemini(res, body, model, stream) {
  const system = flat((body.systemInstruction?.parts ?? []).map((p) => p.text ?? "").join("\n"));
  const lastParts = body.contents?.at(-1)?.parts ?? [];
  const last = lastParts.map((p) => p.text ?? (p.functionResponse ? JSON.stringify(p.functionResponse.response) : "")).join("\n");
  const wantsImage = /image/.test(model) || (body.generationConfig?.responseModalities ?? []).includes("IMAGE");
  let parts;
  if (wantsImage) parts = [{ inlineData: { mimeType: "image/png", data: PIXEL } }];
  else {
    const tools = (body.tools ?? []).flatMap((t) => t.functionDeclarations ?? []);
    const r = settle(pick(system, last), tools);
    parts = r.tool ? [{ functionCall: { name: r.tool.name, args: r.tool.input ?? {} } }] : [{ text: r.json ? JSON.stringify(r.json) : (r.text ?? "") }];
  }
  const out = { candidates: [{ content: { role: "model", parts }, finishReason: "STOP", index: 0 }], usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 40, totalTokenCount: 160 }, modelVersion: model };
  if (stream) return sse(res, [[null, out]]);
  send(res, 200, out);
}

// The tabs any spreadsheet has here: the ones the library's workflows name.
const SHEETS = ["Pack", "Import", "Luma events", "Dashboard", "Instagram posts", "Instagram reels", "X posts", "TikTok videos", "YouTube videos", "Facebook posts"];

/** A Google Sheet: the seeded `sheet_data` rows under a header row made of their keys. */
function sheetValues() {
  const rows = tables.sheet_data ?? [];
  const header = (tables.sheet_header ?? [])[0]?.columns ?? [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return [header.length ? header : ["month", "account", "amount", "prior", "change"], ...rows.map((r) => header.map((h) => r[h] ?? ""))];
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
      if (`${host}${p}` in routes) return reply(res, routes[`${host}${p}`]);
      if (p in routes) return reply(res, routes[p]);
      if (host === "api.anthropic.com" && p === "/v1/messages") return anthropic(res, body ?? {});
      // Google Sheets: every tab reads as the seeded rows under a header row; writes are accepted and kept.
      if (host === "sheets.googleapis.com" && req.method === "GET" && /^\/v4\/spreadsheets\/[^/]+$/.test(p)) {
        return send(res, 200, { spreadsheetId: p.split("/").pop(), sheets: SHEETS.map((title, index) => ({ properties: { sheetId: index, title, index } })) });
      }
      if (host === "sheets.googleapis.com" && req.method === "GET" && p.includes("/values/")) {
        const all = sheetValues();
        const range = decodeURIComponent(p.split("/values/")[1]);
        // "A1:Z1" or "1:1" asks for the header row only; a single column asks for that column.
        const cell = range.split("!").pop();
        const headerOnly = /^[A-Z]*1:[A-Z]*1$/.test(cell);
        const column = /^([A-Z]):\1$/.exec(cell)?.[1] ?? /^([A-Z])\d*:\1\d*$/.exec(cell)?.[1];
        const values = headerOnly ? [all[0]] : column ? all.map((r) => [r[column.charCodeAt(0) - 65] ?? ""]) : all;
        return send(res, 200, { range, majorDimension: "ROWS", values });
      }
      if (host === "sheets.googleapis.com" && p.endsWith(":clear")) {
        tables.sheet_data = [];
        return send(res, 200, { spreadsheetId: "x", clearedRange: decodeURIComponent(p.split("/values/")[1] ?? "") });
      }
      if (host === "sheets.googleapis.com" && p.endsWith("values:batchUpdate")) {
        (tables.sheet_rows ??= []).push(...(body?.data ?? []).flatMap((d) => (d.values ?? []).map((row) => ({ row, range: d.range }))));
        return send(res, 200, { spreadsheetId: "x", totalUpdatedRows: (body?.data ?? []).length, responses: [] });
      }
      if (host === "sheets.googleapis.com" && p.includes(":append")) {
        (tables.sheet_rows ??= []).push(...(body?.values ?? []).map((row) => ({ row })));
        return send(res, 200, { spreadsheetId: "x", updates: { updatedRows: (body?.values ?? []).length } });
      }
      // Gmail: a message has the headers a reply is built from.
      if (p.startsWith("/gmail/v1/") && req.method === "GET" && /\/messages\/[^/]+$/.test(p)) {
        const id = p.split("/").pop();
        return send(res, 200, { id, threadId: `thread-${id}`, labelIds: ["INBOX", "UNREAD"], snippet: "", payload: { headers: [{ name: "Subject", value: "Re: your email" }, { name: "From", value: "Lead <lead@example.com>" }, { name: "To", value: "kim@example.com" }, { name: "Message-ID", value: `<${id}@mail.example.com>` }, { name: "Reply-To", value: "lead@example.com" }] } });
      }
      if (p.startsWith("/gmail/v1/") && p.endsWith("/profile")) return send(res, 200, { emailAddress: "kim@example.com" });
      // Pinecone: any index exists, and a query returns the seeded `kb` rows, best first.
      if (host === "api.pinecone.io" && p.startsWith("/indexes/")) {
        return send(res, 200, { name: p.split("/")[2], dimension: 1536, metric: "cosine", host: "kb-index.svc.pinecone.io", status: { ready: true, state: "Ready" }, spec: { serverless: { cloud: "aws", region: "us-east-1" } } });
      }
      if (host.endsWith(".svc.pinecone.io") && p === "/query") {
        const docs = (tables.kb ?? []).slice(0, body?.topK ?? 4);
        return send(res, 200, { matches: docs.map((d, i) => ({ id: d.id ?? `kb-${i}`, score: 0.92 - i * 0.05, values: [], metadata: { text: d.text, title: d.title ?? "" } })), namespace: "", usage: { readUnits: 1 } });
      }
      if (host === "api.openai.com" && p === "/v1/chat/completions") return openai(res, body ?? {});
      if (host === "api.openai.com" && p === "/v1/embeddings") return send(res, 200, embeddings(body ?? {}));
      // A HubSpot search with nothing canned finds nobody.
      if (host === "api.hubapi.com" && p.endsWith("/search")) return send(res, 200, { total: 0, results: [] });
      if (host === "api.groq.com" && p.endsWith("/chat/completions")) return openai(res, body ?? {});
      if (host === "generativelanguage.googleapis.com") {
        const m = /\/models\/([^:/]+):(generateContent|streamGenerateContent|predict)$/.exec(p);
        if (m && m[2] === "predict") return send(res, 200, { predictions: [{ bytesBase64Encoded: PIXEL, mimeType: "image/png" }] });
        if (m) return gemini(res, body ?? {}, m[1], m[2] === "streamGenerateContent");
        if (p.endsWith("/models")) return send(res, 200, { models: [{ name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] }] });
      }
      if (host === "api.telegram.org") {
        const method = p.split("/").pop();
        if (p.startsWith("/file/")) return reply(res, { __raw: (tables.telegram_files ?? [])[0]?.content ?? "# Notes\n\nNothing seeded.", type: "text/markdown" });
        if (method === "getFile") return send(res, 200, { ok: true, result: { file_id: body?.file_id ?? url.searchParams.get("file_id"), file_size: 100, file_path: "documents/" + ((tables.telegram_files ?? [])[0]?.name ?? "notes.md") } });
        answerTelegram(body);
        return send(res, 200, { ok: true, result: { message_id: ++seq, date: 0, chat: { id: Number(body?.chat_id) || 1, type: "private" }, text: body?.text } });
      }
      // Bubble's Data API: one in-memory table per data type, named bubble_<type>.
      if (host.endsWith(".bubbleapps.io") && p.startsWith("/api/1.1/obj/")) {
        const [type, id] = p.split("/").slice(4);
        const rows = (tables[`bubble_${type}`] ??= []);
        if (req.method === "GET" && !id) {
          const cursor = Number(url.searchParams.get("cursor") ?? 0);
          const limit = Number(url.searchParams.get("limit") ?? 100);
          const empty = (v) => v === undefined || v === null || v === "";
          const constraints = JSON.parse(url.searchParams.get("constraints") ?? "[]");
          const kept = rows.filter((r) => constraints.every((c) => (c.constraint_type === "is_not_empty" ? !empty(r[c.key]) : c.constraint_type === "is_empty" ? empty(r[c.key]) : c.constraint_type === "equals" ? String(r[c.key]) === String(c.value) : true)));
          const page = kept.slice(cursor, cursor + limit);
          return send(res, 200, { response: { cursor, results: page, count: page.length, remaining: Math.max(0, kept.length - cursor - page.length) } });
        }
        if (req.method === "GET") return send(res, 200, { response: rows.find((r) => r._id === id) ?? {} });
        if (req.method === "POST") {
          const row = { _id: `obj_${++seq}`, ...body };
          rows.push(row);
          return send(res, 201, { status: "success", id: row._id });
        }
        if (req.method === "DELETE") {
          tables[`bubble_${type}`] = rows.filter((r) => r._id !== id);
          return send(res, 204, {});
        }
      }
      // Apify: a task's run succeeds at once, and its dataset is the seeded table apify_<task>.
      if (host === "api.apify.com") {
        const run = /^\/v2\/actor-tasks\/([^/]+)\/runs$/.exec(p);
        if (run) return send(res, 201, { data: { id: `run_${run[1]}`, actorTaskId: run[1], status: "RUNNING", defaultDatasetId: `ds_${run[1]}` } });
        const poll = /^\/v2\/actor-runs\/run_([^/]+)(\/abort)?$/.exec(p);
        if (poll) return send(res, 200, { data: { id: `run_${poll[1]}`, status: poll[2] ? "ABORTED" : "SUCCEEDED", defaultDatasetId: `ds_${poll[1]}` } });
        const items = /^\/v2\/datasets\/ds_([^/]+)\/items$/.exec(p);
        if (items) return send(res, 200, tables[`apify_${decodeURIComponent(items[1])}`] ?? []);
      }
      // Google Drive: a search lists the seeded `drive_files`; a download returns that file's text.
      if (p === "/drive/v3/files" && req.method === "GET") {
        const q = url.searchParams.get("q") ?? "";
        const name = /name contains '([^']*)'/.exec(q)?.[1];
        const files = (tables.drive_files ?? []).filter((f) => !name || String(f.name).includes(name));
        return send(res, 200, { files: files.map(({ content, ...f }) => ({ mimeType: "text/markdown", ...f })) });
      }
      if (/^\/drive\/v3\/files\/[^/]+$/.test(p) && req.method === "GET") {
        const file = (tables.drive_files ?? []).find((f) => f.id === p.split("/").pop());
        if (url.searchParams.get("alt") === "media") return reply(res, { __raw: file?.content ?? "", type: "text/markdown" });
        return send(res, 200, { id: p.split("/").pop(), name: file?.name ?? "file.md", mimeType: "text/markdown" });
      }
      if (p.startsWith("/upload/drive/v3/files")) {
        const id = `file_${++seq}`;
        (tables.drive_uploads ??= []).push({ id, body: typeof body === "string" ? body.slice(0, 4000) : body });
        res.writeHead(200, { "content-type": "application/json", location: `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=resumable&upload_id=${id}` });
        return res.end(JSON.stringify({ id, name: "uploaded" }));
      }
      // Supabase's vector search is a stored function; it returns the seeded `documents`.
      if (host.endsWith(".supabase.co") && p.startsWith("/rest/v1/rpc/")) {
        return send(res, 200, (tables.documents ?? []).slice(0, body?.match_count ?? 4).map((d, i) => ({ id: d.id ?? i + 1, content: d.content, metadata: d.metadata ?? {}, similarity: 0.92 - i * 0.05 })));
      }
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
