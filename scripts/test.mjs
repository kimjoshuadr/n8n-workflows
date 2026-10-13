/**
 * Runs every workflow's test cases against a real n8n.
 *
 *   node scripts/test.mjs            all of them
 *   node scripts/test.mjs notify     only ids containing "notify"
 *
 * For each workflow it imports the built JSON, sends the case's input, waits
 * for the execution to finish and checks what n8n actually did: which nodes
 * ran, what the mock services were sent, what the datastore holds afterwards.
 *
 * A workflow that starts from a webhook is called as it is. One that starts
 * from a schedule, a manual run or another workflow gets a test copy whose
 * trigger is replaced by a webhook feeding the same items, so everything after
 * the trigger is the code that ships.
 */
import fs from "node:fs";
import path from "node:path";
import { loadAll, refsOf, root } from "./load.mjs";
import { connect, n8n, mock, ensureCredentials, fill as fillAll, sleep, N8N } from "./n8n.mjs";
import { PLATFORMS } from "../lib/platforms.mjs";
import { UNIQUE } from "../lib/schema.mjs";

const isWebhook = (def) => def.trigger === "webhook";

const isTrigger = (n) => /trigger$/i.test(n.type.split(".").pop());

/**
 * The same workflow, entered through a webhook that hands over `body.items`.
 * `entry` names the trigger to enter by when a workflow has several; the others
 * are swapped for manual triggers so a schedule cannot fire mid-test.
 */
function testCopy(def, entry) {
  const json = structuredClone(def.json);
  const triggers = json.nodes.filter(isTrigger);
  const chosen = entry ? triggers.find((n) => n.name === entry) : triggers[0];
  if (!chosen) throw new Error(`${def.id}: no trigger named "${entry}"`);
  const tag = `${def.id}${entry ? `-${entry.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : ""}`;
  json.nodes = json.nodes.map((n) => {
    if (n === chosen) return { id: n.id, name: n.name, type: "n8n-nodes-base.code", typeVersion: 2, position: n.position, parameters: { jsCode: "return ($input.first().json.body.items ?? [{}]).map((json) => ({ json }));" } };
    if (isTrigger(n)) return { id: n.id, name: n.name, type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: n.position, parameters: {} };
    // Waits are part of the design, not of the test.
    if (n.type.endsWith(".wait")) return { ...n, parameters: { amount: 1, unit: "seconds" } };
    return n;
  });
  json.nodes.push({
    id: `${chosen.id.slice(0, -4)}0000`,
    name: "Test entry",
    type: "n8n-nodes-base.webhook",
    typeVersion: 2,
    position: [chosen.position[0] - 260, chosen.position[1]],
    webhookId: `test-${tag}`,
    parameters: { httpMethod: "POST", path: `test-${tag}`, responseMode: "onReceived", options: {} },
  });
  json.connections["Test entry"] = { main: [[{ node: chosen.name, type: "main", index: 0 }]] };
  json.name = `[test] ${json.name}${entry ? ` (${entry})` : ""}`;
  return { json, path: `test-${tag}` };
}

let CREDS = {};
const fill = (json, ids) => fillAll(json, ids, CREDS);

/** "slack" means any of Slack's hostnames; anything else is a path prefix. */
const hostsOf = (to) => PLATFORMS[to]?.hosts ?? null;
const sentTo = (call, to) => (hostsOf(to) ? hostsOf(to).includes(call.host) : call.path.startsWith(to));
const matches = (k, w) =>
  (!w.to || sentTo(k, w.to)) &&
  (!w.path || k.path === w.path || (w.path.endsWith("*") && k.path.startsWith(w.path.slice(0, -1)))) &&
  (!w.method || k.method === w.method) &&
  (w.body === undefined || contains(k.body, w.body)) &&
  (w.query === undefined || contains(k.query, w.query));

/** True when every key in `want` is in `got` with the same value, at any depth. */
function contains(got, want) {
  if (want === null || typeof want !== "object") return got === want;
  if (got === null || typeof got !== "object") return false;
  if (Array.isArray(want)) return want.every((w, i) => contains(got[i], w));
  return Object.entries(want).every(([k, v]) => contains(got[k], v));
}

async function waitForExecution(workflowId, after) {
  for (let i = 0; i < 120; i++) {
    const list = (await n8n("GET", `/executions?workflowId=${workflowId}&limit=5`)).data.filter((e) => Number(e.id) > after);
    const done = list.find((e) => ["success", "error", "crashed", "canceled"].includes(e.status));
    if (done && list.every((e) => e.status !== "running" && e.status !== "new" && e.status !== "waiting")) {
      return n8n("GET", `/executions/${done.id}?includeData=true`);
    }
    await sleep(250);
  }
  throw new Error("execution did not finish in 30s");
}

async function runCase(def, wf, c) {
  const problems = [];
  await mock("/__reset", {});
  await mock("/__unique", UNIQUE);
  if (c.llm) await mock("/__llm", { replies: c.llm });
  if (c.seed) await mock("/__seed", c.seed);
  for (const r of c.routes ?? []) await mock("/__route", r);
  for (const f of c.fail ?? []) await mock("/__fail", f);

  let exec, response;
  for (let n = 0; n < (c.repeat ?? 1); n++) {
    const before = Math.max(0, ...(await n8n("GET", `/executions?workflowId=${wf.id}&limit=1`)).data.map((e) => Number(e.id)));
    const req = wf.direct ? (c.request ?? {}) : { body: { items: c.input ?? [{}] } };
    const qs = req.query ? `?${new URLSearchParams(req.query)}` : "";
    let res, text;
    // A webhook takes a moment to register after its workflow is published.
    for (let tries = 0; tries < 40; tries++) {
      const get = wf.method === "GET";
      res = await fetch(`${N8N}/webhook/${wf.path}${qs}`, { method: get ? "GET" : "POST", headers: { ...(get ? {} : { "content-type": "application/json" }), ...(req.headers ?? {}) }, body: get ? undefined : typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {}) });
      text = await res.text();
      if (res.status !== 404 || !/not registered/.test(text)) break;
      await sleep(250);
    }
    let body = text;
    try { body = JSON.parse(text); } catch {}
    response = { status: res.status, body };
    exec = await waitForExecution(wf.id, before);
  }

  const run = exec.data?.resultData?.runData ?? {};
  const want = c.status ?? "success";
  if (exec.status !== want) problems.push(`status ${exec.status}, wanted ${want}${exec.data?.resultData?.error ? `: ${exec.data.resultData.error.message} (at ${exec.data.resultData.lastNodeExecuted})` : ""}`);
  for (const name of c.ran ?? []) if (!run[name]) problems.push(`"${name}" did not run`);
  for (const name of c.notRan ?? []) if (run[name]) problems.push(`"${name}" ran`);
  if (c.response && !contains(response, c.response)) problems.push(`response was ${JSON.stringify(response).slice(0, 300)}`);
  if (c.output) {
    for (const o of [c.output].flat()) {
      const items = (run[o.node] ?? []).flatMap((r) => (r.data?.main ?? []).flat()).filter(Boolean).map((i) => i.json);
      if (!items.some((j) => contains(j, o.json))) problems.push(`"${o.node}" output ${JSON.stringify(items).slice(0, 300)} lacks ${JSON.stringify(o.json)}`);
    }
  }

  // Calls made after the run ended (an error workflow's alert) need a moment.
  let calls = [];
  const callsOk = () => (c.calls ?? []).every((w) => calls.some((k) => matches(k, w)));
  for (let i = 0; i < (c.settle ? 40 : 1); i++) {
    calls = await mock("/__calls");
    if (callsOk()) break;
    await sleep(250);
  }
  const show = (w) => `${w.to ?? ""} ${w.method ?? ""} ${w.path ?? ""}`.replace(/\s+/g, " ").trim();
  for (const w of c.calls ?? []) {
    if (calls.some((k) => matches(k, w))) continue;
    const near = calls.filter((k) => matches(k, { to: w.to, path: w.path })).map((k) => k.body);
    problems.push(`no call to ${show(w)}${w.body ? ` with ${JSON.stringify(w.body)}` : ""}; saw ${JSON.stringify(near).slice(0, 400)}`);
  }
  for (const to of c.noCalls ?? []) if (calls.some((k) => sentTo(k, to))) problems.push(`unexpected call to ${to}`);
  // "slack" counts every call to Slack; "slack /api/chat.postMessage" only that path.
  for (const [what, n] of Object.entries(c.callCount ?? {})) {
    const [to, path] = what.includes(" ") ? what.split(" ") : hostsOf(what) ? [what, undefined] : [undefined, what];
    const got = calls.filter((k) => matches(k, { to, path })).length;
    if (got !== n) problems.push(`${got} calls to ${what}, wanted ${n}`);
  }
  // DEBUG=1 lists every call a failing case made, which is usually the whole answer.
  if (process.env.DEBUG && problems.length) problems.push("calls: " + calls.map((k) => `${k.method} ${k.host}${k.path}${k.body?.tools ? ` [tools: ${k.body.tools.map((t) => t.name ?? t.function?.name).join(", ")}]` : ""}`).join(" | "));
  for (const [table, rows] of Object.entries(c.table ?? {})) {
    const got = await mock(`/db/${table}`);
    const real = got.filter((r) => r && typeof r === "object");
    await mock("/__calls");
    for (const want of rows) if (!real.some((r) => contains(r, want))) problems.push(`table ${table} has no row like ${JSON.stringify(want)}; has ${JSON.stringify(real).slice(0, 300)}`);
  }
  return problems;
}

/** The version of the n8n the tests ran on, read from the page it serves. */
async function n8nVersion() {
  const html = await (await fetch(`${N8N}/`)).text();
  const meta = /name="n8n:config:sentry" content="([^"]+)"/.exec(html)?.[1];
  try {
    return JSON.parse(Buffer.from(meta, "base64").toString()).release?.replace(/^n8n@/, "") ?? null;
  } catch {
    return process.env.N8N_VERSION ?? null;
  }
}

const filter = process.argv[2];
const defs = await loadAll();
await connect();
CREDS = await ensureCredentials();

// Start clean: this instance exists only for these tests.
for (;;) {
  const page = (await n8n("GET", "/workflows?limit=100")).data;
  if (!page.length) break;
  for (const w of page) {
    if (w.active) await n8n("POST", `/workflows/${w.id}/deactivate`).catch(() => {});
    for (let tries = 0; ; tries++) {
      try {
        await n8n("DELETE", `/workflows/${w.id}`);
        break;
      } catch (e) {
        if (tries > 40 || !/409/.test(e.message)) throw e;
        await sleep(250);
      }
    }
  }
}

// Install in dependency order, so each reference can be filled with a real id.
const ids = {};
const pending = [...defs];
while (pending.length) {
  const ready = pending.filter((d) => refsOf(d).every((r) => r in ids));
  if (!ready.length) throw new Error(`unresolvable references in: ${pending.map((d) => d.id).join(", ")}`);
  for (const def of ready) {
    const made = await n8n("POST", "/workflows", fill(def.json, ids));
    ids[def.id] = made.id;
    // Published so callers and error handling can reach it. Schedules stay off.
    if (["webhook", "executeWorkflowTrigger", "errorTrigger"].includes(def.trigger)) await n8n("POST", `/workflows/${made.id}/activate`);
    pending.splice(pending.indexOf(def), 1);
  }
}
console.log(`installed ${defs.length} workflows`);

let failed = 0;
let passed = 0;
const results = [];
for (const def of defs.filter((d) => !filter || d.id.includes(filter))) {
  if (!def.tests?.length) {
    console.log(`  –  ${def.id}: no tests`);
    failed++;
    continue;
  }
  const copies = {};
  /** The installed workflow a case runs against: the real one, or a test copy per entry point. */
  const target = async (c) => {
    if (isWebhook(def) && !c.entry) {
      const hook = def.json.nodes.find((n) => n.type.endsWith(".webhook")).parameters;
      return { id: ids[def.id], path: hook.path, method: hook.httpMethod, direct: true };
    }
    const key = c.entry ?? "";
    if (!copies[key]) {
      const copy = testCopy(def, c.entry);
      const made = await n8n("POST", "/workflows", fill(copy.json, ids));
      await n8n("POST", `/workflows/${made.id}/activate`);
      copies[key] = { id: made.id, path: copy.path };
    }
    return copies[key];
  };
  // Test data is written relative to "now"; a long run must not let it go stale.
  const cases = (await loadAll({ fresh: true })).find((d) => d.id === def.id).tests;
  for (const c of cases) {
    let problems;
    try {
      problems = await runCase(def, await target(c), c);
    } catch (e) {
      problems = [e.message];
    }
    results.push({ id: def.id, name: c.name, ok: !problems.length });
    if (problems.length) {
      failed++;
      console.log(`  ✗  ${def.id}: ${c.name}\n       ${problems.join("\n       ")}`);
    } else {
      passed++;
      console.log(`  ✓  ${def.id}: ${c.name}`);
    }
  }
}
if (!filter) fs.writeFileSync(path.join(root, "test-results.json"), JSON.stringify({ n8n: await n8nVersion(), passed, failed, cases: results }, null, 2) + "\n");
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
