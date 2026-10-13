/**
 * The small vocabulary every workflow in this library is written in.
 *
 * A definition names its nodes, then its wiring as chains of node names. The
 * build turns that into n8n's own JSON (ids, positions, connection maps), so a
 * definition stays short enough to review and the JSON can never disagree with
 * its documentation or its tests.
 *
 * External services are always reached through an HTTP Request node whose base
 * address and key come from the environment (`CRM_BASE_URL`, `CRM_API_KEY`).
 * That is what lets every workflow run end to end against the mock server, and
 * it is one node to swap for a native one where you would rather use it.
 */
import crypto from "node:crypto";
import { PLATFORMS, credentialFor } from "./platforms.mjs";

export const uid = (seed) => {
  const h = crypto.createHash("sha1").update(seed).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const node = (name, type, typeVersion, parameters = {}, extra = {}) => ({ name, type, typeVersion, parameters, ...extra });

/* ---- Triggers ---- */

/** A webhook that answers from a Respond node, unless `respond` is "immediately". */
export const webhook = (name, path, { respond = "node", method = "POST", rawBody = false } = {}) =>
  node(name, "n8n-nodes-base.webhook", 2, {
    httpMethod: method,
    path,
    responseMode: respond === "node" ? "responseNode" : "onReceived",
    options: rawBody ? { rawBody: true } : {},
  }, { webhookId: uid(`webhook:${path}`) });

/** `every` is a cron expression, or { minutes | hours | days: n }. */
export const schedule = (name, every) => {
  const interval =
    typeof every === "string"
      ? { field: "cronExpression", expression: every }
      : "minutes" in every
        ? { field: "minutes", minutesInterval: every.minutes }
        : "hours" in every
          ? { field: "hours", hoursInterval: every.hours }
          : { field: "days", daysInterval: every.days, triggerAtHour: every.at ?? 8 };
  return node(name, "n8n-nodes-base.scheduleTrigger", 1.2, { rule: { interval: [interval] } });
};

export const manual = (name = "Run manually") => node(name, "n8n-nodes-base.manualTrigger", 1);

/** The entry point of a workflow that other workflows call. */
export const called = (name = "When called") =>
  node(name, "n8n-nodes-base.executeWorkflowTrigger", 1.1, { inputSource: "passthrough" });

export const onError = (name = "On workflow error") => node(name, "n8n-nodes-base.errorTrigger", 1);

/* ---- Actions ---- */

/**
 * A call to an external service. `target` is "SERVICE:/path", where SERVICE is
 * the prefix of its env vars. `body` and `query` values are JavaScript
 * expressions evaluated per item.
 *
 * Retries three times by default. `alwaysOutput` keeps the workflow going when
 * the reply is an empty list. `onFail: "branch"` gives the node a second
 * output for the failure instead of stopping the workflow.
 */
export const http = (name, target, { method = "POST", body, query, headers = {}, retry = true, onFail, auth = true, fullResponse = false, alwaysOutput = false, once = false } = {}) => {
  // "=expr" is a full address worked out per item, with no service behind it.
  const raw = target.startsWith("=");
  const [service, ...rest] = target.split(":");
  const path = rest.join(":");
  if (raw) auth = false;
  const parameters = {
    method,
    url: raw ? `={{ ${target.slice(1)} }}` : `={{ $env.${service}_BASE_URL }}${path}`,
    options: { timeout: 15000, ...(fullResponse ? { response: { response: { fullResponse: true, neverError: true } } } : {}) },
  };
  const allHeaders = { ...(auth ? { Authorization: `='Bearer ' + $env.${service}_API_KEY` } : {}), ...headers };
  if (Object.keys(allHeaders).length) {
    parameters.sendHeaders = true;
    parameters.headerParameters = {
      parameters: Object.entries(allHeaders).map(([k, v]) => ({ name: k, value: v.startsWith("=") ? `={{ ${v.slice(1)} }}` : v })),
    };
  }
  if (query) {
    parameters.sendQuery = true;
    parameters.queryParameters = {
      parameters: Object.entries(query).map(([k, v]) => ({ name: k, value: `={{ ${v} }}` })),
    };
  }
  if (body !== undefined) {
    parameters.sendBody = true;
    parameters.specifyBody = "json";
    parameters.jsonBody = `={{ JSON.stringify(${body}) }}`;
  }
  const extra = {};
  if (retry) Object.assign(extra, { retryOnFail: true, maxTries: 3, waitBetweenTries: 1000 });
  // An empty reply is still an answer: without this the workflow stops here.
  if (alwaysOutput) extra.alwaysOutputData = true;
  // One call however many items arrive: a lookup that follows another lookup.
  if (once) extra.executeOnce = true;
  if (onFail === "branch") extra.onError = "continueErrorOutput";
  if (onFail === "continue") extra.onError = "continueRegularOutput";
  return node(name, "n8n-nodes-base.httpRequest", 4.2, parameters, extra);
};

/**
 * A chat completion from any OpenAI-compatible endpoint. `task` is the prompt's
 * id: it is written into the system prompt so a run can be traced to the prompt
 * that produced it. `user` is a JavaScript expression.
 */
export const llm = (name, { task, system, user, json = true, onFail }) =>
  http(name, "LLM:/chat/completions", {
    onFail,
    body: `{
  model: $env.LLM_MODEL,
  temperature: 0.2,${json ? '\n  response_format: { type: "json_object" },' : ""}
  messages: [
    { role: "system", content: ${JSON.stringify(`[task:${task}] ${system}`)} },
    { role: "user", content: ${user} }
  ]
}`,
  });

/**
 * Reads a model's JSON reply without trusting it: a reply that does not parse
 * becomes `fallback` plus `parse_error: true`, so one bad completion is a branch
 * to handle and not a crashed run. `from` names the node whose fields are
 * carried forward, matched to replies by position.
 */
export const parseLlm = (name, { from, fallback = {} }) =>
  code(
    name,
    `const before = $(${JSON.stringify(from)}).all();
const out = [];
for (const [i, item] of $input.all().entries()) {
  let reply = ${JSON.stringify(fallback)};
  let parse_error = false;
  try {
    reply = JSON.parse(item.json.choices[0].message.content);
  } catch (e) {
    parse_error = true;
  }
  out.push({ json: { ...(before[i]?.json ?? {}), ...reply, parse_error } });
}
return out;`,
  );

/** JavaScript over all items. Must return an array of `{ json }`. */
export const code = (name, jsCode) => node(name, "n8n-nodes-base.code", 2, { jsCode });

const condition = (expr, seed) => ({
  options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
  conditions: [
    {
      id: uid(`cond:${seed}`),
      leftValue: `={{ ${expr} }}`,
      rightValue: "",
      operator: { type: "boolean", operation: "true", singleValue: true },
    },
  ],
  combinator: "and",
});

/** Output 0 when the expression is true, output 1 when it is not. */
export const iff = (name, expr) =>
  node(name, "n8n-nodes-base.if", 2.2, { conditions: condition(expr, name), options: {} });

/** One output per rule, in order, then a last output for everything else. */
export const route = (name, rules) =>
  node(name, "n8n-nodes-base.switch", 3.2, {
    rules: {
      values: Object.entries(rules).map(([key, expr]) => ({
        conditions: condition(expr, `${name}:${key}`),
        renameOutput: true,
        outputKey: key,
      })),
    },
    options: { fallbackOutput: "extra" },
  });

/** Sets fields from expressions. `keep: true` carries the incoming fields too. */
export const set = (name, fields, { keep = false } = {}) =>
  node(name, "n8n-nodes-base.set", 3.4, {
    assignments: {
      assignments: Object.entries(fields).map(([k, v]) => ({
        id: uid(`set:${name}:${k}`),
        name: k,
        value: `={{ ${v} }}`,
        type: "string",
      })),
    },
    includeOtherFields: keep,
    options: {},
  });

export const respond = (name, body, { status = 200 } = {}) =>
  node(name, "n8n-nodes-base.respondToWebhook", 1.1, {
    respondWith: "json",
    responseBody: `={{ JSON.stringify(${body}) }}`,
    options: { responseCode: status },
  });

/** Output 0 is "done", output 1 is the loop body, which must chain back here. */
export const batches = (name, size = 10) =>
  node(name, "n8n-nodes-base.splitInBatches", 3, { batchSize: size, options: {} });

export const wait = (name, seconds) => node(name, "n8n-nodes-base.wait", 1.1, { amount: seconds, unit: "seconds" }, { webhookId: uid(`wait:${name}`) });

export const merge = (name, mode = "append") => node(name, "n8n-nodes-base.merge", 3, mode === "append" ? {} : { mode });

export const splitOut = (name, field) => node(name, "n8n-nodes-base.splitOut", 1, { fieldToSplitOut: field, options: {} });

export const noop = (name) => node(name, "n8n-nodes-base.noOp", 1);

export const fail = (name, message) =>
  node(name, "n8n-nodes-base.stopAndError", 1, { errorMessage: message.startsWith("=") ? `={{ ${message.slice(1)} }}` : message });

/** Calls another workflow in this library, by its id. The installer fills in the real id. */
export const call = (name, workflowId, { onFail } = {}) =>
  node(
    name,
    "n8n-nodes-base.executeWorkflow",
    1.1,
    { workflowId: { __rl: true, mode: "id", value: `__WF:${workflowId}__` }, options: {} },
    onFail === "continue" ? { onError: "continueRegularOutput" } : {},
  );

/* ---- Definition ---- */

export const ERROR_HANDLER = "error-handler";
const KIND = {
  webhook: "trigger", scheduleTrigger: "trigger", manualTrigger: "trigger", executeWorkflowTrigger: "trigger", errorTrigger: "trigger",
  httpRequest: "http", code: "code", if: "branch", switch: "branch", set: "set", respondToWebhook: "respond",
  splitInBatches: "loop", wait: "wait", merge: "merge", splitOut: "split", noOp: "end", stopAndError: "fail", executeWorkflow: "call",
  agent: "agent", chainLlm: "agent", informationExtractor: "agent", textClassifier: "agent",
  stripeTrigger: "trigger", shopifyTrigger: "trigger", calendlyTrigger: "trigger", typeformTrigger: "trigger", gmailTrigger: "trigger", zendeskTrigger: "trigger", slackTrigger: "trigger", discordTrigger: "trigger", chatTrigger: "trigger",
};

const parseEnd = (s, names) => {
  // A node may have a colon in its own name ("Monday 08:00").
  if (names.has(s)) return { name: s, out: 0, into: 0 };
  const m = /^(.*?)(?::(\d+))?(?:@(\d+))?$/.exec(s);
  return { name: m[1], out: Number(m[2] ?? 0), into: Number(m[3] ?? 0) };
};

/**
 * Columns by distance from a trigger; a loop's return edge is not followed.
 * A node with AI parts attached (a model, tools, memory) is given the room
 * below it that those parts hang in.
 */
function layoutGroup(nodes, edges, attached) {
  const depth = new Map();
  const mine = new Set(nodes.map((n) => n.name));
  const inside = edges.filter((e) => mine.has(e.from) && mine.has(e.to));
  const outgoing = (n) => inside.filter((e) => e.from === n);
  const roots = nodes.filter((n) => !inside.some((e) => e.to === n.name)).map((n) => n.name);
  const visit = (name, d, trail) => {
    if (trail.has(name)) return;
    if ((depth.get(name) ?? -1) >= d) return;
    depth.set(name, d);
    const next = new Set(trail).add(name);
    for (const e of outgoing(name)) visit(e.to, d + 1, next);
  };
  roots.forEach((r) => visit(r, 0, new Set()));
  nodes.forEach((n) => depth.has(n.name) || depth.set(n.name, 0));
  const columns = new Map();
  for (const n of nodes) {
    const d = depth.get(n.name);
    columns.set(d, [...(columns.get(d) ?? []), n.name]);
  }
  /* A column is as wide as the widest spread of parts under any node in it, so
     parts never reach under a neighbouring column. A part can have a part of
     its own (a knowledge base has its embeddings), which takes one more row. */
  const partsOf = (name) => attached.get(name) ?? [];
  const nested = (name) => partsOf(name).some((p) => partsOf(p).length);
  const position = new Map();
  let top = 0;
  let bottom = 0;
  let x = 0;
  for (const d of [...columns.keys()].sort((p, q) => p - q)) {
    const names = columns.get(d);
    const width = Math.max(260, ...names.map((name) => partsOf(name).length * 200 + 60));
    const heights = names.map((name) => (partsOf(name).length ? (nested(name) ? 620 : 440) : 180));
    const total = heights.reduce((p, q) => p + q, 0);
    let y = -total / 2;
    names.forEach((name, i) => {
      position.set(name, [Math.round(x + (width - 260) / 2), Math.round(y + 90)]);
      y += heights[i];
    });
    top = Math.min(top, -total / 2);
    bottom = Math.max(bottom, total / 2);
    x += width;
  }
  return { position, top, bottom, width: x };
}

const SECTION_COLOURS = [4, 5, 6, 3, 7, 2];

/**
 * @param def.id        unique, kebab-case
 * @param def.folder    where the built files go, e.g. "systems/lead-intake"
 * @param def.tier      "flagship" | "production" | "block"
 * @param def.nodes     nodes made with the helpers above and in nodes.mjs
 * @param def.flow      chains: ["A", "B", "C"]. "If:1" is output 1, "Merge@1" is input 1.
 * @param def.sections  for a large canvas: [{ title, nodes }]. Each section is laid
 *                      out as its own band, one under the other, on a labelled note.
 * @param def.story     the steps a person would be walked through: { title, copy, nodes }
 * @param def.tests     cases the runner executes against a real n8n
 */
export function define(def) {
  const names = new Set(def.nodes.map((n) => n.name));
  if (names.size !== def.nodes.length) throw new Error(`${def.id}: duplicate node name`);
  const edges = [];
  for (const chain of def.flow) {
    for (let i = 0; i < chain.length - 1; i++) {
      const a = parseEnd(chain[i], names);
      const b = parseEnd(chain[i + 1], names);
      for (const end of [a, b]) if (!names.has(end.name)) throw new Error(`${def.id}: flow names unknown node "${end.name}"`);
      edges.push({ from: a.name, out: a.out, to: b.name, into: b.into });
    }
  }
  for (const step of def.story ?? []) {
    for (const n of step.nodes) if (!names.has(n)) throw new Error(`${def.id}: story names unknown node "${n}"`);
  }

  // AI parts hang off the node they serve; they are not in the main flow.
  const parts = def.nodes.filter((n) => n.attach);
  const attached = new Map();
  for (const n of parts) {
    for (const t of [n.attach].flat()) {
      if (!names.has(t.to)) throw new Error(`${def.id}: "${n.name}" attaches to unknown node "${t.to}"`);
      attached.set(t.to, [...(attached.get(t.to) ?? []), n.name]);
    }
  }
  const main = def.nodes.filter((n) => !n.attach);
  const loose = main.filter((n) => !edges.some((e) => e.from === n.name || e.to === n.name));
  if (loose.length && main.length > 1) throw new Error(`${def.id}: not wired into the flow: ${loose.map((n) => n.name).join(", ")}`);

  const position = new Map();
  const notes = [];
  const groups = def.sections ?? [{ title: null, nodes: main.map((n) => n.name) }];
  const sectioned = new Set(groups.flatMap((g) => g.nodes));
  for (const n of main) if (!sectioned.has(n.name)) throw new Error(`${def.id}: "${n.name}" is in no section`);
  let y = 0;
  groups.forEach((g, i) => {
    for (const name of g.nodes) if (!names.has(name)) throw new Error(`${def.id}: section "${g.title}" names unknown node "${name}"`);
    const band = layoutGroup(main.filter((n) => g.nodes.includes(n.name)), edges, attached);
    const offset = y - band.top + (g.title ? 110 : 0);
    for (const [name, [px, py]] of band.position) position.set(name, [px, Math.round(py + offset)]);
    const height = band.bottom - band.top + (g.title ? 110 : 0);
    if (g.title) {
      notes.push({
        id: uid(`${def.id}:section:${g.title}`),
        name: `Section: ${g.title}`,
        type: "n8n-nodes-base.stickyNote",
        typeVersion: 1,
        position: [-80, Math.round(y)],
        parameters: { width: band.width + 120, height: Math.round(height + 40), color: SECTION_COLOURS[i % SECTION_COLOURS.length], content: `## ${i + 1}. ${g.title}${g.note ? `\n${g.note}` : ""}` },
      });
    }
    y += height + (g.title ? 120 : 0);
  });
  // Parts hang under what they serve: first an agent's parts, then any part's own.
  const hang = (parent) => {
    const list = attached.get(parent) ?? [];
    const [px, py] = position.get(parent);
    list.forEach((name, i) => {
      if (!position.has(name)) position.set(name, [Math.round(px + (i - (list.length - 1) / 2) * 200), py + 220]);
      hang(name);
    });
  };
  for (const n of main) hang(n.name);

  const short = (type) => type.split(".").pop();
  const connections = {};
  for (const e of edges) {
    const out = ((connections[e.from] ??= {}).main ??= []);
    while (out.length <= e.out) out.push([]);
    out[e.out].push({ node: e.to, type: "main", index: e.into });
  }
  for (const n of parts) {
    for (const t of [n.attach].flat()) (((connections[n.name] ??= {})[t.as] ??= [[]])[0]).push({ node: t.to, type: t.as, index: 0 });
  }

  const ys = [...position.values()].map((p) => p[1]);
  const env = [...new Set(JSON.stringify(def.nodes).match(/\$env\.([A-Z_]+)/g)?.map((s) => s.slice(5)) ?? [])].sort();
  const platforms = [...new Set(def.nodes.map((n) => n.platform).filter(Boolean))];
  const needs = [platforms.length ? `**Platforms:** ${platforms.map((p) => PLATFORMS[p].name).join(", ")}` : "**Platforms:** none, this is logic only", env.length ? `**Settings:** ${env.join(", ")}` : null].filter(Boolean).join("\n");
  const sticky = {
    id: uid(`${def.id}:note`),
    name: "About this workflow",
    type: "n8n-nodes-base.stickyNote",
    typeVersion: 1,
    position: [-80, Math.min(...ys) - (def.sections ? 420 : 300)],
    parameters: {
      width: 640,
      height: 230,
      content: `## ${def.name}\n${def.summary}\n\n${needs}\n**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`${def.folder}\``,
    },
  };

  const isErrorHandler = def.id === ERROR_HANDLER;
  const json = {
    name: def.name,
    nodes: [
      sticky,
      ...notes,
      ...def.nodes.map(({ platform, attach, ...n }) => ({
        id: uid(`${def.id}:${n.name}`),
        position: position.get(n.name),
        ...n,
        ...(platform && !n.noCredential ? { credentials: credentialFor(platform) } : {}),
      })).map(({ noCredential, ...n }) => n),
    ],
    connections,
    settings: {
      executionOrder: "v1",
      ...(isErrorHandler || def.noErrorHandler ? {} : { errorWorkflow: `__WF:${ERROR_HANDLER}__` }),
    },
  };

  const kindOf = (n) => (n.attach ? "part" : (KIND[short(n.type)] ?? (n.platform ? "app" : "other")));
  const graph = {
    nodes: def.nodes.map((n) => ({
      id: n.name,
      kind: kindOf(n),
      platform: n.platform,
      x: position.get(n.name)[0],
      y: position.get(n.name)[1],
    })),
    edges: [
      ...edges.map((e) => ({ from: e.from, to: e.to, out: e.out })),
      ...parts.flatMap((n) => [n.attach].flat().map((t) => ({ from: n.name, to: t.to, out: 0, part: t.as.replace(/^ai_/, "") }))),
    ],
    sections: (def.sections ?? []).map((g) => ({ title: g.title, nodes: g.nodes })),
  };

  const first = main[0];
  const trigger = /trigger$/i.test(short(first.type)) || short(first.type) === "webhook" ? short(first.type) : "none";
  return { ...def, env, platforms, json, graph, trigger, nodeCount: def.nodes.length };
}
