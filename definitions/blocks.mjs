/**
 * Building blocks: one idea each. Most are meant to be called from another
 * workflow, or copied into one.
 */
import { webhook, schedule, manual, called, http, llm, code, iff, route, set, respond, batches, wait, noop, call, define } from "../lib/wf.mjs";
import { db, slack, sendgrid, ask } from "../lib/nodes.mjs";

const b = (kind) => ({ folder: `blocks/${kind}`, tier: "block", category: "Building blocks", kind });

export default [
  /* ---- Intake ---- */
  define({
    ...b("intake"), id: "block-webhook-to-table", name: "Block · Webhook to a table",
    summary: "The smallest useful workflow: receive a form post, keep the fields you named, store a row, answer the sender.",
    integrations: ["Webhook", "Datastore"],
    nodes: [
      webhook("Form posted", "block-form"),
      code("Keep known fields", `const body = $input.first().json.body ?? {};
const row = Object.fromEntries(["name", "email", "message"].map((k) => [k, typeof body[k] === "string" ? body[k].trim().slice(0, 2000) : null]));
return [{ json: { ...row, received_at: new Date().toISOString() } }];`),
      http("Store the row", "DB:/form_submissions", { body: "$json" }),
      respond("Thanks", "{ ok: true, id: $json.id }"),
    ],
    flow: [["Form posted", "Keep known fields", "Store the row", "Thanks"]],
    tests: [{ name: "stores named fields and drops the rest", request: { body: { name: " Ana ", email: "a@b.co", message: "Hi", admin: true } }, response: { status: 200, body: { ok: true } }, calls: [{ to: "supabase", path: "/rest/v1/form_submissions", body: { name: "Ana", email: "a@b.co" } }], output: { node: "Keep known fields", json: { name: "Ana" } } }],
  }),
  define({
    ...b("intake"), id: "block-webhook-secret", name: "Block · Webhook with a shared secret",
    summary: "Refuses any request that does not carry the secret header, before doing anything else.",
    integrations: ["Webhook"],
    nodes: [
      webhook("Incoming", "block-secret"),
      iff("Has the secret?", "$json.headers['x-webhook-secret'] === $env.SHOP_API_KEY"),
      respond("OK", "{ ok: true }"),
      respond("Refused", "{ ok: false }", { status: 401 }),
    ],
    flow: [["Incoming", "Has the secret?", "OK"], ["Has the secret?:1", "Refused"]],
    tests: [
      { name: "accepts the right secret", request: { headers: { "x-webhook-secret": "test-key" }, body: {} }, response: { status: 200 } },
      { name: "refuses a wrong one", request: { headers: { "x-webhook-secret": "nope" }, body: {} }, response: { status: 401 } },
    ],
  }),
  define({
    ...b("intake"), id: "block-validate-respond", name: "Block · Validate and answer with field errors",
    summary: "Checks a payload against simple rules and answers with exactly which fields were wrong, so the form can show it.",
    integrations: ["Webhook"],
    nodes: [
      webhook("Submitted", "block-validate"),
      code("Check the fields", `const v = $input.first().json.body ?? {};
const errors = {};
if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(String(v.email ?? ""))) errors.email = "Enter a valid email address";
if (String(v.name ?? "").trim().length < 2) errors.name = "Enter your name";
if (v.phone && !/^\\+?[0-9 ()-]{7,20}$/.test(String(v.phone))) errors.phone = "Enter a valid phone number";
return [{ json: { valid: Object.keys(errors).length === 0, errors } }];`),
      iff("Valid?", "$json.valid"),
      respond("Accepted", "{ ok: true }"),
      respond("Field errors", "{ ok: false, errors: $json.errors }", { status: 422 }),
    ],
    flow: [["Submitted", "Check the fields", "Valid?", "Accepted"], ["Valid?:1", "Field errors"]],
    tests: [
      { name: "names each wrong field", request: { body: { email: "x", name: "A", phone: "abc" } }, response: { status: 422, body: { errors: { email: "Enter a valid email address", name: "Enter your name", phone: "Enter a valid phone number" } } } },
      { name: "accepts a good payload", request: { body: { email: "a@b.co", name: "Ana" } }, response: { status: 200 } },
    ],
  }),

  /* ---- Notify ---- */
  define({
    ...b("notify"), id: "block-webhook-to-chat", name: "Block · Event to a chat message",
    summary: "Turns any event into one readable chat message.",
    integrations: ["Webhook", "Chat"],
    nodes: [
      webhook("Event", "block-to-chat", { respond: "immediately" }),
      slack.post("Post it", "$json.body.channel ?? '#general'", "($json.body.title ? '*' + $json.body.title + '*\\n' : '') + String($json.body.text ?? '').slice(0, 3000)"),
    ],
    flow: [["Event", "Post it"]],
    tests: [{ name: "posts the title and text", request: { body: { title: "Deploy", text: "v1.2 is live" } }, calls: [{ to: "slack", path: "/api/chat.postMessage", body: { channel: "#general", text: "*Deploy*\nv1.2 is live" } }] }],
  }),
  define({
    ...b("notify"), id: "block-fan-out", name: "Block · One event, three channels",
    summary: "Sends the same message by chat, email and SMS, where each channel failing leaves the other two untouched.",
    integrations: ["Chat", "Email", "SMS"],
    nodes: [
      called(),
      slack.post("Chat", "'#general'", "$json.text", { onFail: "continue" }),
      sendgrid.text("Email", { to: "$('When called').item.json.email", subject: "'Notice'", text: "$('When called').item.json.text" }, { onFail: "continue" }),
      http("SMS", "SMS:/Messages", { body: "{ To: $('When called').item.json.phone, Body: $('When called').item.json.text.slice(0, 160) }", onFail: "continue" }),
      code("Report", `const sent = (name) => { const j = $(name).first().json; return !!j && !j.error; };
return [{ json: { chat: sent("Chat"), email: sent("Email"), sms: sent("SMS") } }];`),
    ],
    flow: [["When called", "Chat", "Email", "SMS", "Report"]],
    tests: [
      { name: "sends all three", input: [{ text: "Hi", email: "a@b.co", phone: "+15550100" }], output: { node: "Report", json: { chat: true, email: true, sms: true } } },
      { name: "an email outage does not stop chat or SMS", fail: [{ path: "/v3/mail/send", times: 3 }], input: [{ text: "Hi", email: "a@b.co", phone: "+15550100" }], output: { node: "Report", json: { chat: true, email: false, sms: true } }, calls: [{ path: "/sms/Messages" }] },
    ],
  }),
  define({
    ...b("notify"), id: "block-template-email", name: "Block · Templated email",
    summary: "One place to send an email from: fills a template, refuses to send with a placeholder left unfilled.",
    integrations: ["Email"],
    nodes: [
      called(),
      code("Fill the template", `return $input.all().map((item) => {
  const { to, subject, body, data = {} } = item.json;
  const fill = (s) => String(s ?? "").replace(/{{\\s*(\\w+)\\s*}}/g, (m, k) => (data[k] === undefined || data[k] === null ? m : String(data[k])));
  const out = { to, subject: fill(subject), text: fill(body) };
  const unfilled = [...(out.subject + out.text).matchAll(/{{\\s*(\\w+)\\s*}}/g)].map((m) => m[1]);
  return { json: { ...out, unfilled, ready: unfilled.length === 0 && !!to } };
});`),
      iff("Ready to send?", "$json.ready"),
      sendgrid.text("Send", { to: "$json.to", subject: "$json.subject", text: "$json.text" }),
      set("Sent", { sent: "true" }),
      set("Held back", { sent: "false", reason: "'Unfilled placeholders: ' + $json.unfilled.join(', ')" }),
    ],
    flow: [["When called", "Fill the template", "Ready to send?", "Send", "Sent"], ["Ready to send?:1", "Held back"]],
    tests: [
      { name: "fills and sends", input: [{ to: "a@b.co", subject: "Hi {{name}}", body: "Order {{id}} shipped", data: { name: "Ana", id: 7 } }], calls: [{ to: "sendgrid", path: "/v3/mail/send", body: { subject: "Hi Ana", text: "Order 7 shipped" } }] },
      { name: "holds back an email with a blank placeholder", input: [{ to: "a@b.co", subject: "Hi {{name}}", body: "x", data: {} }], ran: ["Held back"], noCalls: ["sendgrid"] },
    ],
  }),

  /* ---- Schedule ---- */
  define({
    ...b("schedule"), id: "block-scheduled-report", name: "Block · Scheduled count to chat",
    summary: "Every morning, counts yesterday's rows in a table and posts the number.",
    integrations: ["Schedule", "Datastore", "Chat"],
    nodes: [
      schedule("08:00 daily", "0 8 * * *"),
      db.find("Yesterday's rows", "form_submissions", { received_at: ["gte", "$now.minus({ days: 1 }).startOf('day').toISO()"] }),
      code("Count", `return [{ json: { count: $input.all().filter((i) => i.json.id).length } }];`),
      slack.post("Post", "'#general'", "$json.count + ' form submissions since yesterday morning.'"),
    ],
    flow: [["08:00 daily", "Yesterday's rows", "Count", "Post"]],
    tests: [
      { name: "counts rows", seed: { form_submissions: [{ id: "1", received_at: "2999-01-01T00:00:00Z" }, { id: "2", received_at: "2999-01-01T00:00:00Z" }] }, input: [{}], calls: [{ to: "slack", path: "/api/chat.postMessage", body: { text: "2 form submissions since yesterday morning." } }] },
      { name: "reports zero and does not go silent", input: [{}], calls: [{ to: "slack", path: "/api/chat.postMessage", body: { text: "0 form submissions since yesterday morning." } }] },
    ],
  }),
  define({
    ...b("schedule"), id: "block-heartbeat", name: "Block · Check in with the heartbeat monitor",
    summary: "The two nodes a scheduled workflow adds so the heartbeat monitor can tell when it stops running.",
    integrations: ["Datastore"],
    nodes: [
      called(),
      http("Check in", "DB:/heartbeats", { query: { on_conflict: "'name'" }, headers: { Prefer: "resolution=merge-duplicates" }, body: "{ name: $json.name, last_seen: $now.toISO(), max_gap_minutes: $json.max_gap_minutes ?? 90 }" }),
    ],
    flow: [["When called", "Check in"]],
    tests: [{ name: "writes a heartbeat row", input: [{ name: "nightly-sync", max_gap_minutes: 1500 }], table: { heartbeats: [{ name: "nightly-sync", max_gap_minutes: 1500 }] } }],
  }),
  define({
    ...b("schedule"), id: "block-working-hours", name: "Block · Working hours gate",
    summary: "Tells a caller whether now is inside working hours in a given time zone, so messages to people wait for the morning.",
    integrations: [],
    nodes: [
      called(),
      code("Is it working hours?", `return $input.all().map((item) => {
  const { timezone = "UTC", start = 9, end = 18, at } = item.json;
  const when = at ? new Date(at) : new Date();
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, weekday: "short", hour: "numeric", hour12: false }).formatToParts(when).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour) % 24;
  const weekday = !["Sat", "Sun"].includes(parts.weekday);
  return { json: { ...item.json, local_hour: hour, weekday, open: weekday && hour >= start && hour < end } };
});`),
    ],
    flow: [["When called", "Is it working hours?"]],
    tests: [
      { name: "Tuesday 10:00 in Manila is open", input: [{ timezone: "Asia/Manila", at: "2026-10-13T02:00:00Z" }], output: { node: "Is it working hours?", json: { open: true, local_hour: 10 } } },
      { name: "the same instant in New York is closed", input: [{ timezone: "America/New_York", at: "2026-10-13T02:00:00Z" }], output: { node: "Is it working hours?", json: { open: false, local_hour: 22 } } },
      { name: "a Saturday is closed", input: [{ timezone: "UTC", at: "2026-10-17T10:00:00Z" }], output: { node: "Is it working hours?", json: { open: false, weekday: false } } },
    ],
  }),

  /* ---- Lists and loops ---- */
  define({
    ...b("lists"), id: "block-dedupe", name: "Block · Remove duplicates by key",
    summary: "Keeps the first of each item sharing a key, after normalising it, so 'A@B.co ' and 'a@b.co' count as one.",
    integrations: [],
    nodes: [
      called(),
      code("Dedupe", `const seen = new Set();
const out = [];
for (const item of $input.all()) {
  const key = String(item.json.email ?? item.json.key ?? "").trim().toLowerCase();
  if (!key || seen.has(key)) continue;
  seen.add(key);
  out.push({ json: { ...item.json, email: item.json.email ? key : undefined } });
}
return out;`),
    ],
    flow: [["When called", "Dedupe"]],
    tests: [{ name: "treats differently-cased emails as one", input: [{ email: "A@B.co " }, { email: "a@b.co" }, { email: "c@d.co" }, { email: "" }], output: [{ node: "Dedupe", json: { email: "a@b.co" } }, { node: "Dedupe", json: { email: "c@d.co" } }] }],
  }),
  define({
    ...b("lists"), id: "block-paginate", name: "Block · Read every page of an API",
    summary: "Follows a cursor until the API says there is no more, with a hard stop so a broken API cannot loop forever.",
    integrations: ["CRM"],
    nodes: [
      manual(),
      set("Start", { cursor: "''", page: "0" }),
      http("Fetch a page", "CRM:/contacts", { method: "GET", query: { after: "$json.cursor", limit: "'100'" } }),
      code("Keep going?", `const res = $input.first().json;
const page = Number($("Start").first().json.page) + $runIndex + 1;
return [{ json: { items: res.results ?? [], cursor: res.next ?? "", page, more: !!res.next && page < 50 } }];`),
      iff("More pages?", "$json.more"),
      code("All pages", `const all = [];
for (let i = 0; ; i++) { try { all.push(...$("Keep going?").first(0, i).json.items); } catch (e) { break; } }
return [{ json: { total: all.length, items: all } }];`),
    ],
    flow: [["Run manually", "Start", "Fetch a page", "Keep going?", "More pages?", "Fetch a page"], ["More pages?:1", "All pages"]],
    tests: [{ name: "stops when there is no next cursor", routes: [{ path: "/crm/contacts", response: { results: [{ id: 1 }, { id: 2 }] } }], input: [{}], output: { node: "All pages", json: { total: 2 } }, callCount: { "/crm/contacts": 1 } }],
  }),
  define({
    ...b("lists"), id: "block-rate-limited-loop", name: "Block · Loop that respects a rate limit",
    summary: "Sends items in small batches with a pause between them, for APIs that reject bursts.",
    integrations: ["Email"],
    nodes: [
      called(),
      batches("Five at a time", 5),
      http("Send", "EMAIL:/emails", { body: "{ to: $json.email, template: 'bulk' }", onFail: "continue" }),
      wait("Pause", 2),
      noop("Finished"),
    ],
    flow: [["When called", "Five at a time"], ["Five at a time:0", "Finished"], ["Five at a time:1", "Send", "Pause", "Five at a time"]],
    tests: [{ name: "sends every item across batches", input: Array.from({ length: 7 }, (_, i) => ({ email: `u${i}@b.co` })), callCount: { "sendgrid /v3/mail/send": 7 }, ran: ["Finished"] }],
  }),
  define({
    ...b("lists"), id: "block-batch-upsert", name: "Block · Upsert in chunks",
    summary: "Groups a long list into chunks of 100 and upserts each chunk in one request.",
    integrations: ["Datastore"],
    nodes: [
      called(),
      code("Chunk", `const rows = $input.all().map((i) => i.json);
const out = [];
for (let i = 0; i < rows.length; i += 100) out.push({ json: { rows: rows.slice(i, i + 100) } });
return out;`),
      http("Upsert the chunk", "DB:/records", { query: { on_conflict: "'key'" }, headers: { Prefer: "resolution=merge-duplicates" }, body: "$json.rows" }),
    ],
    flow: [["When called", "Chunk", "Upsert the chunk"]],
    tests: [{ name: "250 rows become three requests and update on repeat", repeat: 2, input: Array.from({ length: 250 }, (_, i) => ({ key: `k${i}`, v: i })), callCount: { "supabase /rest/v1/records": 6 }, table: { records: [{ key: "k249", v: 249 }] } }],
  }),

  /* ---- Reliability ---- */
  define({
    ...b("reliability"), id: "block-retry-backoff", name: "Block · Retry with growing waits",
    summary: "Calls an address up to four times, waiting longer each time, and reports clearly whether it finally worked.",
    integrations: [],
    nodes: [
      called(),
      set("Begin", { url: "$json.url", payload: "JSON.stringify($json.payload ?? {})", attempt: "1" }),
      http("Try", "=$json.url", { body: "JSON.parse($json.payload)", retry: false, onFail: "branch" }),
      set("Worked", { ok: "true", attempts: "$('Again?').isExecuted ? $('Again?').last().json.attempt : 1" }),
      code("Again?", `const prev = $("Begin").first().json;
const attempt = $runIndex + 2;
return [{ json: { url: prev.url, payload: prev.payload, attempt, give_up: attempt > 4, wait_seconds: Math.min(2 ** (attempt - 1), 30) } }];`),
      iff("Attempts left?", "!$json.give_up"),
      wait("Back off", 2),
      set("Gave up", { ok: "false", attempts: "4" }),
    ],
    flow: [
      ["When called", "Begin", "Try", "Worked"],
      ["Try:1", "Again?", "Attempts left?", "Back off", "Try"],
      ["Attempts left?:1", "Gave up"],
    ],
    tests: [
      { name: "succeeds on the third attempt", fail: [{ path: "/flaky/a", times: 2, status: 503 }], input: [{ url: "http://mocks:4010/flaky/a", payload: { n: 1 } }], ran: ["Worked"], notRan: ["Gave up"], callCount: { "/flaky/a": 3 } },
      { name: "gives up after four", fail: [{ path: "/flaky/b", times: 9, status: 503 }], input: [{ url: "http://mocks:4010/flaky/b" }], ran: ["Gave up"], callCount: { "/flaky/b": 4 } },
    ],
  }),
  define({
    ...b("reliability"), id: "block-error-to-dead-letter", name: "Block · Failed call to dead letter",
    summary: "The pattern for any write that must not be lost: try, and if it still fails after retries, park the payload.",
    integrations: ["CRM"],
    nodes: [
      called(),
      http("Write", "CRM:/records", { body: "$json", onFail: "branch" }),
      set("Written", { written: "true" }),
      code("Wrap", `return [{ json: { source: "block-error-to-dead-letter", reason: "CRM write failed after retries", payload: $("When called").first().json } }];`),
      call("Park it", "dead-letter"),
    ],
    flow: [["When called", "Write", "Written"], ["Write:1", "Wrap", "Park it"]],
    tests: [
      { name: "writes when the service is up", input: [{ a: 1 }], ran: ["Written"], notRan: ["Park it"] },
      { name: "parks the payload when it stays down", fail: [{ path: "/crm", times: 3 }], input: [{ a: 1 }], calls: [{ to: "supabase", path: "/rest/v1/dead_letters", body: { payload: { a: 1 } } }] },
    ],
  }),
  define({
    ...b("reliability"), id: "block-throttle", name: "Block · Limit actions per key per hour",
    summary: "Answers whether a key (a user, an IP, a customer) is still under its hourly limit, and counts the attempt.",
    integrations: ["Datastore"],
    nodes: [
      called(),
      code("This hour's bucket", `return $input.all().map((i) => ({ json: { ...i.json, limit: i.json.limit ?? 5, bucket: i.json.key + ":" + new Date().toISOString().slice(0, 13) } }));`),
      db.find("Read the count", "throttle", { bucket: "$json.bucket" }),
      code("Decide", `const req = $("This hour's bucket").first().json;
const count = Number($input.first().json.count ?? 0);
return [{ json: { ...req, count: count + 1, allowed: count < req.limit } }];`),
      http("Count the attempt", "DB:/throttle", { query: { on_conflict: "'bucket'" }, headers: { Prefer: "resolution=merge-duplicates" }, body: "{ bucket: $json.bucket, count: $json.count }" }),
      set("Answer", { allowed: "$('Decide').first().json.allowed", count: "$('Decide').first().json.count" }),
    ],
    flow: [["When called", "This hour's bucket", "Read the count", "Decide", "Count the attempt", "Answer"]],
    tests: [{ name: "allows up to the limit, then refuses", repeat: 3, input: [{ key: "user-1", limit: 2 }], output: { node: "Decide", json: { allowed: false, count: 3 } } }],
  }),
  define({
    ...b("reliability"), id: "block-approval-gate", name: "Block · Wait for a person's yes",
    summary: "Records a pending decision and gives back approve and reject links. Nothing proceeds until one is pressed, and each link works once.",
    integrations: ["Webhook", "Datastore"],
    nodes: [
      webhook("Decision link", "block-approval", { method: "GET" }),
      code("Read the link", `const q = $input.first().json.query ?? {};
return [{ json: { token: String(q.token ?? ""), decision: q.decision === "approve" ? "approved" : q.decision === "reject" ? "rejected" : null } }];`),
      db.update("Resolve if still pending", "approvals", { token: "$json.token", status: "'pending'" }, { status: "$json.decision", decided_at: "$now.toISO()" }),
      iff("Resolved now?", "!!$json.token && !!$('Read the link').first().json.decision"),
      respond("Thanks", "{ ok: true, status: $json.status }"),
      respond("Link no longer valid", "{ ok: false, error: 'This link was already used or does not exist' }", { status: 410 }),
    ],
    flow: [["Decision link", "Read the link", "Resolve if still pending", "Resolved now?", "Thanks"], ["Resolved now?:1", "Link no longer valid"]],
    tests: [
      { name: "a link works once", seed: { approvals: [{ token: "t1", status: "pending" }] }, repeat: 2, request: { query: { token: "t1", decision: "approve" } }, response: { status: 410 }, table: { approvals: [{ token: "t1", status: "approved" }] } },
      { name: "an unknown token is refused", request: { query: { token: "nope", decision: "approve" } }, response: { status: 410 } },
    ],
  }),

  /* ---- Data ---- */
  define({
    ...b("data"), id: "block-csv-to-rows", name: "Block · CSV text to rows",
    summary: "Parses CSV text properly, including quoted commas and blank lines, into one item per row.",
    integrations: [],
    nodes: [
      called(),
      code("Parse", `const text = String($input.first().json.csv ?? "").replace(/^\\uFEFF/, "");
const rows = [];
let row = [], cell = "", quoted = false;
for (let i = 0; i < text.length; i++) {
  const c = text[i];
  if (quoted) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c; }
  else if (c === '"') quoted = true;
  else if (c === ",") { row.push(cell); cell = ""; }
  else if (c === "\\n" || c === "\\r") { if (c === "\\r" && text[i + 1] === "\\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
  else cell += c;
}
if (cell.length || row.length) { row.push(cell); rows.push(row); }
const [header, ...body] = rows.filter((r) => r.some((v) => v.trim() !== ""));
if (!header) return [];
return body.map((r) => ({ json: Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])) }));`),
    ],
    flow: [["When called", "Parse"]],
    tests: [{ name: "handles quoted commas, escaped quotes and blank lines", input: [{ csv: 'name,note\n"Rivera, Ana","said ""hi"""\n\nSam,ok\n' }], output: [{ node: "Parse", json: { name: "Rivera, Ana", note: 'said "hi"' } }, { node: "Parse", json: { name: "Sam", note: "ok" } }] }],
  }),
  define({
    ...b("data"), id: "block-change-detect", name: "Block · Has this changed since last time?",
    summary: "Compares a record with the copy stored last run and reports which fields changed, so downstream work only happens on a real change.",
    integrations: ["Datastore"],
    nodes: [
      called(),
      db.find("Last copy", "snapshots", { key: "$json.key" }),
      code("Compare", `const now = $("When called").first().json;
const before = $input.first().json.data ?? null;
const fields = Object.keys({ ...(before ?? {}), ...now.data });
const changed = before === null ? fields : fields.filter((f) => JSON.stringify(before[f]) !== JSON.stringify(now.data[f]));
return [{ json: { key: now.key, data: now.data, first_seen: before === null, changed, has_changes: changed.length > 0 } }];`),
      http("Store this copy", "DB:/snapshots", { query: { on_conflict: "'key'" }, headers: { Prefer: "resolution=merge-duplicates" }, body: "{ key: $json.key, data: $json.data }" }),
      set("Answer", { has_changes: "$('Compare').first().json.has_changes", changed: "$('Compare').first().json.changed.join(',')" }),
    ],
    flow: [["When called", "Last copy", "Compare", "Store this copy", "Answer"]],
    tests: [
      { name: "names the field that changed", seed: { snapshots: [{ key: "p1", data: { price: 10, title: "A" } }] }, input: [{ key: "p1", data: { price: 12, title: "A" } }], output: { node: "Compare", json: { has_changes: true, changed: ["price"], first_seen: false } } },
      { name: "an identical record is no change", seed: { snapshots: [{ key: "p1", data: { price: 10 } }] }, input: [{ key: "p1", data: { price: 10 } }], output: { node: "Compare", json: { has_changes: false } } },
    ],
  }),
  define({
    ...b("data"), id: "block-currency-convert", name: "Block · Convert a currency amount",
    summary: "Converts an amount with today's rate, rounds like money, and says so when the rate could not be fetched instead of returning a wrong number.",
    integrations: ["Rates"],
    nodes: [
      called(),
      http("Today's rate", "RATES:/latest", { method: "GET", query: { from: "$json.from", to: "$json.to" }, auth: false, onFail: "continue" }),
      code("Convert", `const req = $("When called").first().json;
const rate = $input.first().json.rates?.[req.to];
if (typeof rate !== "number") return [{ json: { ...req, converted: null, ok: false, reason: "No rate available for " + req.from + " to " + req.to } }];
return [{ json: { ...req, rate, converted: Math.round(req.amount * rate * 100) / 100, ok: true } }];`),
    ],
    flow: [["When called", "Today's rate", "Convert"]],
    tests: [
      { name: "converts and rounds to cents", routes: [{ path: "/rates/latest", response: { rates: { PHP: 58.1234 } } }], input: [{ amount: 19.99, from: "USD", to: "PHP" }], output: { node: "Convert", json: { converted: 1161.89, ok: true } } },
      { name: "admits when there is no rate", fail: [{ path: "/rates", times: 3 }], input: [{ amount: 10, from: "USD", to: "PHP" }], output: { node: "Convert", json: { converted: null, ok: false } } },
    ],
  }),
  define({
    ...b("data"), id: "block-slugify", name: "Block · Clean text into a URL slug",
    summary: "Turns any title into a safe, readable URL slug, including accented and non-Latin titles.",
    integrations: [],
    nodes: [
      called(),
      code("Slugify", `return $input.all().map((item) => {
  const slug = String(item.json.title ?? "").normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/, "");
  return { json: { ...item.json, slug: slug || "untitled-" + Math.abs([...String(item.json.title ?? "")].reduce((h, c) => (h * 31 + c.codePointAt(0)) | 0, 7)).toString(36) } };
});`),
    ],
    flow: [["When called", "Slugify"]],
    tests: [{ name: "handles accents, symbols and empty results", input: [{ title: "  Crème Brûlée & Co.: 10% Off!  " }, { title: "日本語" }], output: [{ node: "Slugify", json: { slug: "creme-brulee-and-co-10-off" } }] }],
  }),
  define({
    ...b("data"), id: "block-date-window", name: "Block · Yesterday, in the business's time zone",
    summary: "Works out the start and end of 'yesterday' or 'last week' in a named time zone, which is where most reporting bugs come from.",
    integrations: [],
    nodes: [
      called(),
      code("Window", `return $input.all().map((item) => {
  const { timezone = "UTC", period = "yesterday", at } = item.json;
  const now = at ? DateTime.fromISO(at, { zone: "utc" }).setZone(timezone) : DateTime.now().setZone(timezone);
  const start = period === "last_week" ? now.startOf("week").minus({ weeks: 1 }) : now.startOf("day").minus({ days: 1 });
  const end = period === "last_week" ? start.plus({ weeks: 1 }) : start.plus({ days: 1 });
  return { json: { ...item.json, from: start.toUTC().toISO(), to: end.toUTC().toISO(), label: start.toFormat("yyyy-LL-dd") } };
});`),
    ],
    flow: [["When called", "Window"]],
    tests: [{ name: "Manila's yesterday is not UTC's yesterday", input: [{ timezone: "Asia/Manila", at: "2026-10-12T20:00:00Z" }], output: { node: "Window", json: { label: "2026-10-12", from: "2026-10-11T16:00:00.000Z", to: "2026-10-12T16:00:00.000Z" } } }],
  }),
  define({
    ...b("data"), id: "block-cursor-sync", name: "Block · Incremental sync with a bookmark",
    summary: "The skeleton of every reliable sync: read the bookmark, fetch what is newer, write it, and only then move the bookmark.",
    integrations: ["Datastore", "CRM"],
    nodes: [
      manual(),
      db.find("Read bookmark", "sync_cursors", { name: "'block-sync'" }),
      http("Fetch newer", "CRM:/changes", { method: "GET", query: { since: "$json.value ?? '0'" } }),
      code("Newest id", `const rows = $input.first().json.results ?? [];
return [{ json: { rows, count: rows.length, newest: rows.length ? String(Math.max(...rows.map((r) => Number(r.id)))) : null } }];`),
      iff("Anything new?", "$json.count > 0"),
      http("Write rows", "DB:/synced", { body: "$json.rows" }),
      http("Move bookmark", "DB:/sync_cursors", { query: { on_conflict: "'name'" }, headers: { Prefer: "resolution=merge-duplicates" }, body: "{ name: 'block-sync', value: $('Newest id').first().json.newest }" }),
      noop("Up to date"),
    ],
    flow: [["Run manually", "Read bookmark", "Fetch newer", "Newest id", "Anything new?", "Write rows", "Move bookmark"], ["Anything new?:1", "Up to date"]],
    tests: [
      { name: "moves the bookmark to the newest id", seed: { sync_cursors: [{ name: "block-sync", value: "10" }] }, routes: [{ path: "/crm/changes", response: { results: [{ id: 11 }, { id: 14 }] } }], input: [{}], calls: [{ path: "/crm/changes", query: { since: "10" } }], table: { sync_cursors: [{ name: "block-sync", value: "14" }] } },
      { name: "leaves the bookmark when nothing is new", seed: { sync_cursors: [{ name: "block-sync", value: "10" }] }, routes: [{ path: "/crm/changes", response: { results: [] } }], input: [{}], ran: ["Up to date"], table: { sync_cursors: [{ name: "block-sync", value: "10" }] } },
    ],
  }),
  define({
    ...b("data"), id: "block-file-to-storage", name: "Block · Save a remote file to storage",
    summary: "Records a file under a name derived from its own address, so the same file fetched twice is stored once.",
    integrations: ["Storage", "Datastore"],
    nodes: [
      called(),
      code("Name it", `return $input.all().map((item) => {
  const url = String(item.json.url ?? "");
  let h = 0; for (const c of url) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const ext = (/\\.([a-z0-9]{2,5})(?:\\?|$)/i.exec(url)?.[1] ?? "bin").toLowerCase();
  return { json: { url, key: "files/" + h.toString(16).padStart(8, "0") + "." + ext } };
});`),
      http("Claim the name", "DB:/stored_files", { query: { on_conflict: "'key'" }, body: "{ key: $json.key, source: $json.url }", alwaysOutput: true }),
      iff("New file?", "!!$json.key"),
      http("Copy to storage", "STORAGE:/copy", { body: "{ source_url: $json.source, key: $json.key }" }),
      noop("Already stored"),
    ],
    flow: [["When called", "Name it", "Claim the name", "New file?", "Copy to storage"], ["New file?:1", "Already stored"]],
    tests: [{ name: "the same address is copied once", repeat: 2, input: [{ url: "https://cdn.example/a/report.PDF?x=1" }], callCount: { "/storage/copy": 1 }, output: { node: "Name it", json: { key: "files/" + (() => { let h = 0; for (const c of "https://cdn.example/a/report.PDF?x=1") h = (h * 31 + c.charCodeAt(0)) >>> 0; return h.toString(16).padStart(8, "0"); })() + ".pdf" } } }],
  }),

  /* ---- AI ---- */
  define({
    ...b("ai"), id: "block-llm-json-guard", name: "Block · A model reply you can rely on",
    summary: "Asks a model for JSON, checks the reply has the fields you need, asks once more if it does not, and then gives up honestly.",
    integrations: ["LLM"],
    nodes: [
      called(),
      llm("Ask", { task: "guarded", system: "Reply with JSON only.", user: "$json.prompt", onFail: "continue" }),
      code("Check the reply", `const req = $("When called").first().json;
const required = req.required ?? [];
let data = null;
try { data = JSON.parse($input.first().json.output); } catch (e) {}
const missing = data ? required.filter((k) => data[k] === undefined || data[k] === null) : required;
return [{ json: { ok: !!data && missing.length === 0, data, missing, attempt: $runIndex + 1, prompt: req.prompt + (missing.length ? "\\n\\nYour last reply was missing: " + missing.join(", ") + ". Reply again with every field." : "") } }];`),
      iff("Good?", "$json.ok"),
      iff("Try once more?", "$json.attempt < 2"),
      set("Usable", { ok: "true", data: "JSON.stringify($json.data)" }),
      set("Not usable", { ok: "false", missing: "$json.missing.join(',')" }),
    ],
    flow: [["When called", "Ask", "Check the reply", "Good?", "Usable"], ["Good?:1", "Try once more?", "Ask"], ["Try once more?:1", "Not usable"]],
    tests: [
      { name: "accepts a complete reply first time", llm: [{ final: JSON.parse("{\"city\":\"Cebu\",\"country\":\"PH\"}") }], input: [{ prompt: "Where?", required: ["city", "country"] }], ran: ["Usable"], callCount: { "/llm/chat/completions": 1 } },
      { name: "asks once more, then gives up", llm: [{ final: JSON.parse("{\"city\":\"Cebu\"}") }], input: [{ prompt: "Where?", required: ["city", "country"] }], ran: ["Not usable"], callCount: { "/llm/chat/completions": 2 } },
    ],
  }),
  define({
    ...b("ai"), id: "block-pii-redact", name: "Block · Mask personal data before a model sees it",
    summary: "Replaces emails, phone numbers and card numbers with placeholders, and hands back the map to restore them afterwards.",
    integrations: [],
    nodes: [
      called(),
      code("Redact", `return $input.all().map((item) => {
  const map = {};
  let n = 0;
  const swap = (kind) => (match) => { const token = "[" + kind + "_" + ++n + "]"; map[token] = match; return token; };
  const text = String(item.json.text ?? "")
    .replace(/[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+/g, swap("EMAIL"))
    .replace(/\\b(?:\\d[ -]?){13,19}\\b/g, swap("CARD"))
    .replace(/\\+?\\d[\\d ()-]{7,}\\d/g, swap("PHONE"));
  return { json: { text, map, redactions: n } };
});`),
    ],
    flow: [["When called", "Redact"]],
    tests: [{ name: "masks an email, a card and a phone", input: [{ text: "Mail ana@b.co or call +63 917 555 0100, card 4242 4242 4242 4242." }], output: { node: "Redact", json: { text: "Mail [EMAIL_1] or call [PHONE_3], card [CARD_2].", redactions: 3 } } }],
  }),
  define({
    ...b("ai"), id: "block-chunk-text", name: "Block · Split a document into overlapping chunks",
    summary: "Cuts long text into chunks that end on sentence boundaries and overlap by whole sentences, ready for embedding or a model's context window.",
    integrations: [],
    nodes: [
      called(),
      code("Chunk", `const { text = "", size = 800, overlap = 100, id = "doc" } = $input.first().json;
const sentences = (String(text).replace(/\\s+/g, " ").trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? []).map((s) => s.trim());
const chunks = [];
let current = [];
const length = (list) => list.join(" ").length;
for (const s of sentences) {
  if (current.length && length([...current, s]) > size) {
    chunks.push(current.join(" "));
    // Carry whole sentences into the next chunk, never half a word.
    const carry = [];
    for (const prev of [...current].reverse()) { if (length([prev, ...carry]) > overlap) break; carry.unshift(prev); }
    current = carry;
  }
  current.push(s);
}
if (current.length) chunks.push(current.join(" "));
return chunks.map((c, i) => ({ json: { id: id + "#" + i, index: i, of: chunks.length, text: c, chars: c.length } }));`),
    ],
    flow: [["When called", "Chunk"]],
    tests: [{ name: "splits on sentences and overlaps by a whole sentence", input: [{ id: "kb-1", size: 60, overlap: 30, text: "First sentence is here. Second sentence follows it. Third one closes the text." }], output: [{ node: "Chunk", json: { id: "kb-1#0", of: 2, text: "First sentence is here. Second sentence follows it." } }, { node: "Chunk", json: { id: "kb-1#1", text: "Second sentence follows it. Third one closes the text." } }] }],
  }),
  define({
    ...b("ai"), id: "block-classify-route", name: "Block · Classify, then route",
    summary: "Has a model put a message into one of a fixed set of labels and routes on it, with a default route for anything unexpected.",
    integrations: ["LLM"],
    nodes: [
      called(),
      ...ask("Classify", { task: "classify", system: "Classify the message. Reply with JSON: { label: 'billing'|'technical'|'general' }.", prompt: "$json.text", example: { label: "billing", urgent: false, sentiment: "neutral" } }),
      code("Read the label", `let label = "general";
try { const l = JSON.parse($input.first().json.output).label; if (["billing", "technical", "general"].includes(l)) label = l; } catch (e) {}
return [{ json: { ...$("When called").first().json, label } }];`),
      route("By label", { billing: "$json.label === 'billing'", technical: "$json.label === 'technical'" }),
      set("Billing", { queue: "'billing'" }),
      set("Technical", { queue: "'engineering'" }),
      set("General", { queue: "'support'" }),
    ],
    flow: [["When called", "Classify", "Read the label", "By label"], ["By label:0", "Billing"], ["By label:1", "Technical"], ["By label:2", "General"]],
    tests: [
      { name: "routes a billing message", input: [{ text: "My invoice is wrong" }], ran: ["Billing"], notRan: ["General"] },
      { name: "an unexpected label takes the default route", llm: [{ final: JSON.parse("{\"label\":\"sales\"}") }], input: [{ text: "x" }], ran: ["General"] },
      { name: "a model outage takes the default route", fail: [{ path: "/v1/chat/completions", times: 20 }, { path: "/v1/messages", times: 20 }], input: [{ text: "My invoice is wrong" }], ran: ["General"] },
    ],
  }),
];
