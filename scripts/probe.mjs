/**
 * Runs a few nodes in the test n8n and prints what they did. For finding out
 * how a platform's node really behaves before building on it.
 *
 *   node scripts/probe.mjs spec.json     (or pipe the spec on stdin)
 *
 * spec: { input, nodes: [{ name, type, version, platform?, params, extra? }], routes?, llm?, seed?, links? }
 * Nodes run in a line after the input unless `links` gives [from, to, type?].
 */
import fs from "node:fs";
import { connect, n8n, mock, ensureCredentials, fill, sleep, N8N } from "./n8n.mjs";
import { credentialFor } from "../lib/platforms.mjs";
import { UNIQUE } from "../lib/schema.mjs";

const spec = JSON.parse(fs.readFileSync(process.argv[2] ?? 0, "utf8"));
await connect();
const creds = await ensureCredentials();
const path = `probe-${Date.now()}`;
const nodes = [
  { id: "p0", name: "In", type: "n8n-nodes-base.webhook", typeVersion: 2, position: [0, 0], webhookId: path, parameters: { httpMethod: "POST", path, responseMode: "onReceived", options: {} } },
  { id: "p1", name: "Input", type: "n8n-nodes-base.code", typeVersion: 2, position: [200, 0], parameters: { jsCode: "const b = $input.first().json.body; return (Array.isArray(b) ? b : [b]).map((json) => ({ json }));" } },
  ...spec.nodes.map((n, i) => ({ id: `n${i}`, name: n.name, type: n.type, typeVersion: n.version, position: [400 + i * 200, 0], parameters: n.params ?? {}, ...(n.platform ? { credentials: credentialFor(n.platform) } : {}), ...(n.extra ?? {}) })),
];
const connections = { In: { main: [[{ node: "Input", type: "main", index: 0 }]] } };
const link = (from, to, type = "main") => ((connections[from] ??= {})[type] ??= [[]])[0].push({ node: to, type, index: 0 });
if (spec.links) spec.links.forEach((l) => link(...l));
else ["Input", ...spec.nodes.map((n) => n.name)].forEach((name, i, all) => i && link(all[i - 1], name));
const wf = await n8n("POST", "/workflows", fill({ name: path, nodes, connections, settings: { executionOrder: "v1" } }, {}, creds));
await n8n("POST", `/workflows/${wf.id}/activate`);
await mock("/__reset", {});
await mock("/__unique", UNIQUE);
if (spec.seed) await mock("/__seed", spec.seed);
for (const r of spec.routes ?? []) await mock("/__route", r);
if (spec.llm) await mock("/__llm", { replies: spec.llm });
for (let i = 0; i < 40; i++) {
  const r = await fetch(`${N8N}/webhook/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(spec.input ?? {}) });
  if (r.status !== 404) break;
  await sleep(250);
}
let ex;
for (let i = 0; i < 80; i++) {
  await sleep(300);
  ex = (await n8n("GET", `/executions?workflowId=${wf.id}&limit=1&includeData=true`)).data[0];
  if (ex && !["running", "new", "waiting"].includes(ex.status)) break;
}
console.log(`status: ${ex?.status}${ex?.data?.resultData?.error ? ` | ${ex.data.resultData.error.message} | ${String(ex.data.resultData.error.description ?? "").slice(0, 200)} (at ${ex.data.resultData.lastNodeExecuted})` : ""}`);
for (const n of spec.nodes) {
  const run = ex?.data?.resultData?.runData?.[n.name];
  const outs = (run ?? []).flatMap((r) => Object.values(r.data ?? {}).flat(2)).filter(Boolean).map((i) => i.json);
  console.log(`  ${n.name}: ${run ? JSON.stringify(outs).slice(0, 420) : "did not run"}`);
}
for (const c of await mock("/__calls")) console.log(`  -> ${c.method} ${c.host}${c.path}${Object.keys(c.query ?? {}).length ? "?" + new URLSearchParams(c.query) : ""} ${JSON.stringify(c.body ?? null).slice(0, 300)}`);
await n8n("POST", `/workflows/${wf.id}/deactivate`).catch(() => {});
