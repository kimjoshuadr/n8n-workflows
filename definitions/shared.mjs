/**
 * The reliability kit: the workflows every other workflow in the library leans
 * on. Import these first.
 */
import { define, onError, called, schedule, http, code, iff, set, batches, noop } from "../lib/wf.mjs";

const folder = "shared";
const base = { folder, tier: "flagship", system: "reliability-kit", category: "Reliability" };

export default [
  define({
    ...base,
    id: "error-handler",
    name: "Reliability · Error handler",
    summary: "Catches a failure in any workflow, logs it, and alerts once per distinct error per hour so a broken loop cannot flood the channel.",
    integrations: ["Datastore", "Chat"],
    nodes: [
      onError(),
      code(
        "Describe the failure",
        `const e = $input.first().json;
const workflow = e.workflow?.name ?? "Unknown workflow";
const node = e.execution?.lastNodeExecuted ?? "unknown node";
const message = String(e.execution?.error?.message ?? e.trigger?.error?.message ?? "No message").slice(0, 500);
const hour = new Date().toISOString().slice(0, 13);
return [{ json: {
  workflow, node, message,
  execution_id: e.execution?.id ?? null,
  execution_url: e.execution?.url ?? null,
  fingerprint: [workflow, node, message.slice(0, 80), hour].join("|"),
  at: new Date().toISOString(),
} }];`,
      ),
      http("Log the error", "DB:/workflow_errors", { query: { on_conflict: "'fingerprint'" }, body: "$json", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, alwaysOutput: true }),
      iff("First time this hour?", "!!$json.id"),
      http("Alert the team", "CHAT:/chat.postMessage", {
        body: `{
  channel: $env.ALERT_CHANNEL,
  text: ':rotating_light: ' + $('Describe the failure').first().json.workflow + ' failed at "' + $('Describe the failure').first().json.node + '": ' + $('Describe the failure').first().json.message
}`,
      }),
      noop("Already alerted"),
    ],
    flow: [
      ["On workflow error", "Describe the failure", "Log the error", "First time this hour?", "Alert the team"],
      ["First time this hour?:1", "Already alerted"],
    ],
    story: [
      { title: "A workflow fails", copy: "Every workflow in the library names this one as its error workflow, so a failure anywhere arrives here.", nodes: ["On workflow error", "Describe the failure"] },
      { title: "It is logged once", copy: "The error is written with a fingerprint of workflow, node, message and hour. A repeat inside the hour is ignored by the datastore.", nodes: ["Log the error", "First time this hour?"] },
      { title: "The team hears about it once", copy: "Only a new fingerprint posts an alert, so a loop failing a thousand times is one message.", nodes: ["Alert the team", "Already alerted"] },
    ],
    tests: [
      {
        name: "a new failure is logged and alerted",
        input: [{ workflow: { name: "Orders" }, execution: { id: "77", lastNodeExecuted: "Create invoice", error: { message: "503 from billing" } } }],
        ran: ["Alert the team"],
        calls: [{ path: "/db/workflow_errors" }, { path: "/chat/chat.postMessage", body: { channel: "#ops-alerts" } }],
      },
      {
        name: "the same failure inside the hour is not alerted twice",
        input: [{ workflow: { name: "Orders" }, execution: { id: "78", lastNodeExecuted: "Create invoice", error: { message: "503 from billing" } } }],
        repeat: 2,
        callCount: { "/chat/chat.postMessage": 1 },
      },
    ],
  }),

  define({
    ...base,
    id: "idempotency-guard",
    name: "Reliability · Idempotency guard",
    summary: "Answers one question for a caller: has this event been handled before? Webhooks are delivered more than once; this is what makes that safe.",
    integrations: ["Datastore"],
    nodes: [
      called(),
      code(
        "Build the key",
        `return $input.all().map((item) => {
  const { scope, key } = item.json;
  if (!scope || !key) throw new Error("idempotency-guard needs { scope, key }");
  return { json: { ...item.json, idempotency_key: scope + ":" + key } };
});`,
      ),
      http("Claim the key", "DB:/idempotency_keys", {
        query: { on_conflict: "'idempotency_key'" },
        body: "{ idempotency_key: $json.idempotency_key, claimed_at: $now.toISO() }",
        headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
        fullResponse: true,
      }),
      code(
        "Report",
        `const before = $("Build the key").all();
return $input.all().map((item, i) => {
  const rows = Array.isArray(item.json.body) ? item.json.body : [];
  return { json: { ...before[i].json, duplicate: rows.length === 0 } };
});`,
      ),
    ],
    flow: [["When called", "Build the key", "Claim the key", "Report"]],
    story: [
      { title: "A caller asks", copy: "It passes a scope and a key: an order id, a payment event id, a lead's email.", nodes: ["When called", "Build the key"] },
      { title: "The key is claimed", copy: "One insert with a unique constraint. The database decides, so two runs at the same moment cannot both win.", nodes: ["Claim the key"] },
      { title: "The caller gets an answer", copy: "duplicate: true means stop. The caller decides what stopping looks like.", nodes: ["Report"] },
    ],
    tests: [
      { name: "a first event is not a duplicate", input: [{ scope: "order", key: "1001" }], output: { node: "Report", json: { duplicate: false, idempotency_key: "order:1001" } } },
      { name: "a repeat is a duplicate", seed: { idempotency_keys: [{ idempotency_key: "order:1001" }] }, input: [{ scope: "order", key: "1001" }], output: { node: "Report", json: { duplicate: true } } },
    ],
  }),

  define({
    ...base,
    id: "notify",
    name: "Reliability · Notify",
    summary: "The one place alerts leave from. Posts to chat, and falls back to email when chat is down, so an outage cannot hide its own alert.",
    integrations: ["Chat", "Email"],
    nodes: [
      called(),
      set("Compose", { channel: "$json.channel ?? $env.ALERT_CHANNEL", text: "($json.level === 'critical' ? ':red_circle: ' : $json.level === 'warn' ? ':warning: ' : ':information_source: ') + $json.text", level: "$json.level ?? 'info'" }),
      http("Post to chat", "CHAT:/chat.postMessage", { body: "{ channel: $json.channel, text: $json.text }", onFail: "branch" }),
      set("Delivered by chat", { delivered: "'chat'" }),
      http("Email instead", "EMAIL:/emails", { body: "{ to: 'ops@example.com', subject: 'Alert (chat unavailable)', text: $('Compose').item.json.text }" }),
      set("Delivered by email", { delivered: "'email'" }),
    ],
    flow: [
      ["When called", "Compose", "Post to chat", "Delivered by chat"],
      ["Post to chat:1", "Email instead", "Delivered by email"],
    ],
    story: [
      { title: "Something needs saying", copy: "Any workflow calls this with a text and a level. No workflow talks to the chat tool directly.", nodes: ["When called", "Compose"] },
      { title: "Chat first", copy: "Three attempts, a second apart.", nodes: ["Post to chat", "Delivered by chat"] },
      { title: "Email if chat is down", copy: "A failure after the retries takes the second output and the alert still arrives.", nodes: ["Email instead", "Delivered by email"] },
    ],
    tests: [
      { name: "posts to chat", input: [{ text: "Stock is low", level: "warn" }], ran: ["Delivered by chat"], notRan: ["Email instead"], calls: [{ path: "/chat/chat.postMessage", body: { text: ":warning: Stock is low" } }] },
      { name: "falls back to email when chat stays down", fail: [{ path: "/chat", times: 3, status: 503 }], input: [{ text: "Stock is low", level: "critical" }], ran: ["Email instead", "Delivered by email"], calls: [{ path: "/email/emails" }] },
      { name: "recovers when chat fails once", fail: [{ path: "/chat", times: 1, status: 503 }], input: [{ text: "Hello" }], ran: ["Delivered by chat"], notRan: ["Email instead"] },
    ],
  }),

  define({
    ...base,
    id: "dead-letter",
    name: "Reliability · Dead letter",
    summary: "Keeps the payload of work that could not be finished, with the reason, so nothing is lost when a downstream system is down.",
    integrations: ["Datastore", "Chat"],
    nodes: [
      called(),
      code(
        "Wrap the payload",
        `return $input.all().map((item) => ({ json: {
  source: item.json.source ?? "unknown",
  replay_url: item.json.replay_url ?? null,
  reason: String(item.json.reason ?? "unspecified").slice(0, 300),
  payload: item.json.payload ?? {},
  status: "pending",
  attempts: 0,
  parked_at: new Date().toISOString(),
} }));`,
      ),
      http("Park it", "DB:/dead_letters", { body: "$json" }),
      http("Say so", "CHAT:/chat.postMessage", { body: "{ channel: $env.ALERT_CHANNEL, text: ':inbox_tray: Parked 1 item from ' + $('Wrap the payload').item.json.source + ': ' + $('Wrap the payload').item.json.reason }", onFail: "continue" }),
    ],
    flow: [["When called", "Wrap the payload", "Park it", "Say so"]],
    story: [
      { title: "Work could not be finished", copy: "A caller hands over the payload, where it came from and why it failed.", nodes: ["When called", "Wrap the payload"] },
      { title: "It is parked, not dropped", copy: "The payload is stored as pending with the address that can replay it.", nodes: ["Park it"] },
      { title: "Someone is told", copy: "The alert is best effort: parking has already succeeded.", nodes: ["Say so"] },
    ],
    tests: [
      { name: "parks the payload as pending", input: [{ source: "orders", reason: "CRM 503", replay_url: "http://mocks:4010/replay/orders", payload: { order_id: 9 } }], calls: [{ path: "/db/dead_letters", body: { status: "pending", source: "orders", payload: { order_id: 9 } } }, { path: "/chat/chat.postMessage" }] },
      { name: "still parks when the alert cannot be sent", fail: [{ path: "/chat", times: 3 }], input: [{ source: "orders", reason: "x", payload: {} }], status: "success", calls: [{ path: "/db/dead_letters" }] },
    ],
  }),

  define({
    ...base,
    id: "dead-letter-replay",
    name: "Reliability · Dead letter replay",
    summary: "Every fifteen minutes, sends parked work back to where it came from. Gives up after five attempts and says so.",
    integrations: ["Datastore", "Chat"],
    nodes: [
      schedule("Every 15 minutes", { minutes: 15 }),
      http("Fetch pending", "DB:/dead_letters", { method: "GET", query: { status: "'eq.pending'", limit: "'50'" }, alwaysOutput: true }),
      iff("Anything parked?", "!!$json.id"),
      batches("One at a time", 1),
      http("Replay", "=$json.replay_url", { body: "$json.payload", onFail: "branch", retry: false }),
      http("Mark replayed", "DB:/dead_letters", { method: "PATCH", query: { id: "'eq.' + $('One at a time').item.json.id" }, body: "{ status: 'replayed', replayed_at: $now.toISO() }" }),
      code(
        "Count the attempt",
        `const row = $("One at a time").first().json;
const attempts = (row.attempts ?? 0) + 1;
return [{ json: { id: row.id, source: row.source, attempts, status: attempts >= 5 ? "abandoned" : "pending" } }];`,
      ),
      http("Record the attempt", "DB:/dead_letters", { method: "PATCH", query: { id: "'eq.' + $json.id" }, body: "{ attempts: $json.attempts, status: $json.status }" }),
      iff("Given up?", "$('Count the attempt').item.json.status === 'abandoned'"),
      http("Escalate", "CHAT:/chat.postMessage", { body: "{ channel: $env.ALERT_CHANNEL, text: ':red_circle: Gave up replaying an item from ' + $('Count the attempt').item.json.source + ' after 5 attempts. It needs a person.' }", onFail: "continue" }),
      noop("Nothing to do"),
      noop("All replayed"),
    ],
    flow: [
      ["Every 15 minutes", "Fetch pending", "Anything parked?", "One at a time"],
      ["Anything parked?:1", "Nothing to do"],
      ["One at a time:0", "All replayed"],
      ["One at a time:1", "Replay", "Mark replayed", "One at a time"],
      ["Replay:1", "Count the attempt", "Record the attempt", "Given up?", "Escalate", "One at a time"],
      ["Given up?:1", "One at a time"],
    ],
    story: [
      { title: "On a timer", copy: "Every fifteen minutes it asks the datastore for parked work.", nodes: ["Every 15 minutes", "Fetch pending", "Anything parked?"] },
      { title: "One at a time", copy: "Each item is sent back to the address that can redo it. One slow item does not hold the others.", nodes: ["One at a time", "Replay", "Mark replayed"] },
      { title: "Five attempts, then a person", copy: "A failed replay is counted. At five the item is abandoned and escalated.", nodes: ["Count the attempt", "Record the attempt", "Given up?", "Escalate"] },
    ],
    tests: [
      { name: "replays pending items and marks them", seed: { dead_letters: [{ id: "a", status: "pending", attempts: 0, source: "orders", replay_url: "http://mocks:4010/replay/orders", payload: { n: 1 } }, { id: "b", status: "pending", attempts: 0, source: "orders", replay_url: "http://mocks:4010/replay/orders", payload: { n: 2 } }] }, input: [{}], ran: ["Mark replayed", "All replayed"], callCount: { "/replay/orders": 2 }, table: { dead_letters: [{ id: "a", status: "replayed" }, { id: "b", status: "replayed" }] } },
      { name: "abandons after the fifth failure and escalates", seed: { dead_letters: [{ id: "a", status: "pending", attempts: 4, source: "orders", replay_url: "http://mocks:4010/replay/orders", payload: {} }] }, fail: [{ path: "/replay/orders", times: 1, status: 500 }], input: [{}], ran: ["Escalate"], table: { dead_letters: [{ id: "a", status: "abandoned", attempts: 5 }] } },
      { name: "does nothing when nothing is parked", input: [{}], ran: ["Nothing to do"], notRan: ["One at a time"] },
    ],
  }),

  define({
    ...base,
    id: "heartbeat-monitor",
    name: "Reliability · Heartbeat monitor",
    summary: "Notices the failure nobody reports: a scheduled workflow that silently stopped running. Each one checks in, and this alerts when a check-in is overdue.",
    integrations: ["Datastore", "Chat"],
    nodes: [
      schedule("Every hour", { hours: 1 }),
      http("Read heartbeats", "DB:/heartbeats", { method: "GET" }),
      code(
        "Find the overdue",
        `const now = Date.now();
const overdue = $input.all()
  .map((i) => i.json)
  .filter((h) => h.name && h.last_seen)
  .filter((h) => now - new Date(h.last_seen).getTime() > (h.max_gap_minutes ?? 90) * 60000)
  .map((h) => ({ json: { name: h.name, last_seen: h.last_seen, hours_silent: Math.round((now - new Date(h.last_seen).getTime()) / 36e5) } }));
return overdue;`,
      ),
      http("Alert", "CHAT:/chat.postMessage", { body: "{ channel: $env.ALERT_CHANNEL, text: ':zzz: ' + $json.name + ' has not run for ' + $json.hours_silent + 'h (last seen ' + $json.last_seen + ').' }" }),
    ],
    flow: [["Every hour", "Read heartbeats", "Find the overdue", "Alert"]],
    story: [
      { title: "Workflows check in", copy: "Each scheduled workflow writes a timestamp when it finishes.", nodes: ["Every hour", "Read heartbeats"] },
      { title: "Silence is measured", copy: "A check-in older than the workflow's own allowed gap is overdue.", nodes: ["Find the overdue"] },
      { title: "One alert per silent workflow", copy: "Nothing overdue means nothing is sent.", nodes: ["Alert"] },
    ],
    tests: [
      { name: "alerts for a workflow that went quiet", seed: { heartbeats: [{ name: "Daily report", last_seen: "2020-01-01T00:00:00Z", max_gap_minutes: 1500 }, { name: "Fresh", last_seen: "2999-01-01T00:00:00Z" }] }, input: [{}], callCount: { "/chat/chat.postMessage": 1 }, calls: [{ path: "/chat/chat.postMessage" }] },
      { name: "stays quiet when everything checked in", seed: { heartbeats: [{ name: "Fresh", last_seen: "2999-01-01T00:00:00Z" }] }, input: [{}], notRan: ["Alert"] },
    ],
  }),
];
