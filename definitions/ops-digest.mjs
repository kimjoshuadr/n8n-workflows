/**
 * Ops digest: what the business did this week, on one screen, and an alert the
 * moment a number crosses a line.
 */
import { define, schedule, http, llm, code, iff, call, noop } from "../lib/wf.mjs";

const base = { folder: "systems/ops-digest", tier: "flagship", system: "ops-digest", category: "Reporting and monitoring" };

export default [
  define({
    ...base,
    id: "weekly-digest",
    name: "Ops digest · Weekly summary",
    summary: "Every Monday, gathers the week's numbers from sales, orders, support and the site, compares them with the week before, and sends one readable summary.",
    integrations: ["Schedule", "Datastore", "Analytics", "LLM", "Chat", "Email"],
    nodes: [
      schedule("Monday 08:30", "30 8 * * 1"),
      http("Leads", "DB:/leads", { method: "GET", query: { received_at: "'gte.' + $now.minus({ days: 14 }).toISO()" }, onFail: "continue", alwaysOutput: true }),
      http("Orders", "DB:/orders", { method: "GET", query: { created_at: "'gte.' + $now.minus({ days: 14 }).toISO()" }, onFail: "continue", alwaysOutput: true, once: true }),
      http("Support", "DB:/support_log", { method: "GET", query: { at: "'gte.' + $now.minus({ days: 14 }).toISO()" }, onFail: "continue", alwaysOutput: true, once: true }),
      http("Site traffic", "ANALYTICS:/insights/trend", { method: "GET", query: { event: "'$pageview'", date_from: "'-14d'" }, onFail: "continue", alwaysOutput: true, once: true }),
      code("Work out the week", `const weekAgo = Date.now() - 7 * 864e5;
const rows = (name) => { try { return $(name).all().map((i) => i.json).filter((r) => r && !r.error); } catch (e) { return null; } };
const split = (list, field) => {
  const cur = list.filter((r) => new Date(r[field]).getTime() >= weekAgo);
  return [cur, list.filter((r) => new Date(r[field]).getTime() < weekAgo)];
};
const change = (now, before) => (before ? Math.round(((now - before) / before) * 100) : null);
const metric = (label, now, before, unit = "") => ({ label, now, before, change: change(now, before), unit });
const out = [];
const unavailable = [];

const leads = rows("Leads")?.filter((r) => r.received_at);
if (leads) { const [c, p] = split(leads, "received_at"); out.push(metric("New leads", c.length, p.length)); out.push(metric("Qualified leads", c.filter((l) => l.fit === true).length, p.filter((l) => l.fit === true).length)); } else unavailable.push("leads");

const orders = rows("Orders")?.filter((r) => r.created_at);
if (orders) { const [c, p] = split(orders, "created_at"); const sum = (l) => Math.round(l.reduce((s, o) => s + Number(o.total ?? 0), 0)); out.push(metric("Orders", c.length, p.length)); out.push(metric("Revenue", sum(c), sum(p))); } else unavailable.push("orders");

const support = rows("Support")?.filter((r) => r.at);
if (support) { const [c, p] = split(support, "at"); const rate = (l) => (l.length ? Math.round((l.filter((s) => s.answered).length / l.length) * 100) : 0); out.push(metric("Support conversations", c.length, p.length)); out.push(metric("Answered by the agent", rate(c), rate(p), "%")); } else unavailable.push("support");

const traffic = $("Site traffic").first()?.json?.result?.[0]?.data;
if (Array.isArray(traffic) && traffic.length >= 14) { const s = (a) => a.reduce((x, y) => x + y, 0); out.push(metric("Site visits", s(traffic.slice(-7)), s(traffic.slice(-14, -7)))); } else unavailable.push("site traffic");

const lines = out.map((m) => m.label + ": " + m.now + m.unit + (m.change === null ? "" : " (" + (m.change >= 0 ? "+" : "") + m.change + "% on last week)"));
return [{ json: { metrics: out, unavailable, table: lines.join("\\n"), week_of: new Date(weekAgo).toISOString().slice(0, 10) } }];`),
      llm("Write the summary", { task: "summarise", json: false, system: "Write a four-sentence summary of this week's numbers for a business owner. Say what moved most and what deserves attention. Use only the numbers given. Do not invent causes.", user: "$json.table + ($json.unavailable.length ? '\\nUnavailable this week: ' + $json.unavailable.join(', ') : '')", onFail: "continue" }),
      code("Compose", `const w = $("Work out the week").first().json;
const summary = $input.first().json.choices?.[0]?.message?.content ?? "(The written summary is unavailable this week. The numbers are below.)";
const note = w.unavailable.length ? "\\n\\nNot included, because the source did not answer: " + w.unavailable.join(", ") + "." : "";
return [{ json: { subject: "Week of " + w.week_of, text: summary + "\\n\\n" + w.table + note } }];`),
      http("Post to the channel", "CHAT:/chat.postMessage", { body: "{ channel: '#weekly', text: '*' + $json.subject + '*\\n' + $json.text }", onFail: "continue" }),
      http("Email the owner", "EMAIL:/emails", { body: "{ to: 'owner@example.com', subject: $('Compose').first().json.subject, text: $('Compose').first().json.text }" }),
      http("Check in", "DB:/heartbeats", { method: "PATCH", query: { name: "'eq.weekly-digest'" }, body: "{ last_seen: $now.toISO() }", onFail: "continue" }),
    ],
    flow: [["Monday 08:30", "Leads", "Orders", "Support", "Site traffic", "Work out the week", "Write the summary", "Compose", "Post to the channel", "Email the owner", "Check in"]],
    story: [
      { title: "Four sources, two weeks", copy: "Leads, orders, support and site traffic. Each is allowed to fail on its own.", nodes: ["Monday 08:30", "Leads", "Orders", "Support", "Site traffic"] },
      { title: "The arithmetic is done in code", copy: "This week against last week, per number. The model is never asked to count.", nodes: ["Work out the week"] },
      { title: "A model writes four sentences", copy: "It sees only the finished numbers and is told not to invent causes.", nodes: ["Write the summary", "Compose"] },
      { title: "It says what is missing", copy: "A source that did not answer is named in the digest, not silently left out.", nodes: ["Compose"] },
      { title: "Channel, inbox, heartbeat", copy: "Posted, emailed, and checked in so a missed Monday is noticed.", nodes: ["Post to the channel", "Email the owner", "Check in"] },
    ],
    tests: [
      { name: "compares this week with last and sends both ways", seed: { leads: [{ received_at: new Date(Date.now() - 864e5).toISOString(), fit: true }, { received_at: new Date(Date.now() - 2 * 864e5).toISOString(), fit: false }, { received_at: new Date(Date.now() - 9 * 864e5).toISOString(), fit: true }], orders: [{ created_at: new Date(Date.now() - 864e5).toISOString(), total: 100 }, { created_at: new Date(Date.now() - 10 * 864e5).toISOString(), total: 50 }], support_log: [{ at: new Date(Date.now() - 864e5).toISOString(), answered: true }] }, routes: [{ path: "/analytics/insights/trend", response: { result: [{ data: [10, 10, 10, 10, 10, 10, 10, 20, 20, 20, 20, 20, 20, 20] }] } }], input: [{}], output: { node: "Work out the week", json: { unavailable: [], metrics: [{ label: "New leads", now: 2, before: 1, change: 100 }, { label: "Qualified leads", now: 1, before: 1 }, { label: "Orders", now: 1, before: 1 }, { label: "Revenue", now: 100, before: 50, change: 100 }] } }, calls: [{ path: "/chat/chat.postMessage", body: { channel: "#weekly" } }, { path: "/email/emails" }] },
      { name: "names a source that did not answer and still sends", fail: [{ path: "/analytics", times: 3 }], seed: { leads: [{ received_at: new Date().toISOString(), fit: true }] }, input: [{}], output: { node: "Work out the week", json: { unavailable: ["site traffic"] } }, calls: [{ path: "/email/emails" }] },
      { name: "sends the numbers even when the model is down", fail: [{ path: "/llm", times: 3 }], seed: { leads: [{ received_at: new Date().toISOString(), fit: true }] }, input: [{}], calls: [{ path: "/email/emails" }], status: "success" },
    ],
  }),

  define({
    ...base,
    id: "threshold-alerts",
    name: "Ops digest · Threshold alerts",
    summary: "Checks each watched number hourly and alerts when it crosses its line, and again when it recovers. It does not repeat itself in between.",
    integrations: ["Schedule", "Datastore", "Chat"],
    nodes: [
      schedule("Hourly", { hours: 1 }),
      http("Watched metrics", "DB:/watched_metrics", { method: "GET", alwaysOutput: true }),
      code("Which changed state?", `return $input.all().map((i) => i.json).filter((m) => m.name && typeof m.value === "number").map((m) => {
  const breached = m.direction === "below" ? m.value < m.threshold : m.value > m.threshold;
  const state = breached ? "breached" : "ok";
  return { ...m, state, changed: state !== (m.last_state ?? "ok") };
}).filter((m) => m.changed).map((json) => ({ json }));`),
      http("Remember the state", "DB:/watched_metrics", { method: "PATCH", query: { name: "'eq.' + $json.name" }, body: "{ last_state: $json.state, state_changed_at: $now.toISO() }" }),
      code("Alert text", `const before = $("Which changed state?").all();
return $input.all().map((item, i) => { const m = before[i].json; return { json: { level: m.state === "breached" ? "critical" : "info", text: m.state === "breached" ? m.name + " is " + m.value + ", " + m.direction + " its line of " + m.threshold + "." : m.name + " is back to normal at " + m.value + "." } }; });`),
      call("Alert", "notify"),
    ],
    flow: [["Hourly", "Watched metrics", "Which changed state?", "Remember the state", "Alert text", "Alert"]],
    story: [
      { title: "Each number has a line", copy: "A value, a threshold and a direction, kept in one table anyone can edit.", nodes: ["Hourly", "Watched metrics"] },
      { title: "Only a change of state matters", copy: "Breached an hour ago and still breached is not news.", nodes: ["Which changed state?", "Remember the state"] },
      { title: "One alert in, one alert out", copy: "The team hears when it breaks and when it recovers, and nothing in between.", nodes: ["Alert text", "Alert"] },
    ],
    tests: [
      { name: "alerts when a number crosses its line", seed: { watched_metrics: [{ name: "Checkout conversion", value: 0.8, threshold: 1.5, direction: "below", last_state: "ok" }] }, input: [{}], calls: [{ path: "/chat/chat.postMessage", body: { text: ":red_circle: Checkout conversion is 0.8, below its line of 1.5." } }], table: { watched_metrics: [{ name: "Checkout conversion", last_state: "breached" }] } },
      { name: "stays quiet while it is still breached", seed: { watched_metrics: [{ name: "Checkout conversion", value: 0.8, threshold: 1.5, direction: "below", last_state: "breached" }] }, input: [{}], noCalls: ["/chat"] },
      { name: "says when it recovers", seed: { watched_metrics: [{ name: "Queue length", value: 3, threshold: 50, direction: "above", last_state: "breached" }] }, input: [{}], calls: [{ path: "/chat/chat.postMessage", body: { text: ":information_source: Queue length is back to normal at 3." } }] },
    ],
  }),
];
