/**
 * The reliability kit: the workflows every other workflow in the library leans
 * on. Import these first.
 *
 * State lives in Supabase, alerts go to Slack, and SendGrid is the fallback when
 * Slack is down.
 */
import { schedule, called, onError, http, code, iff, set, batches, noop, fail, define } from "../lib/wf.mjs";
import { db, slack, sendgrid } from "../lib/nodes.mjs";

const base = { folder: "shared", tier: "flagship", system: "reliability-kit", category: "Reliability" };
export const ALERTS = "'#ops-alerts'";

/** True when a failed insert failed because the row was already there. */
export const isDuplicate = "/duplicate key|23505/.test(String($json.error ?? ''))";

export default [
  define({
    ...base,
    id: "error-handler",
    name: "Reliability · Error handler",
    summary: "Catches a failure in any workflow, logs it to Supabase, and alerts Slack once per distinct error per hour so a broken loop cannot flood the channel.",
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
      db.insert("Log the error", "workflow_errors", { workflow: "$json.workflow", node: "$json.node", message: "$json.message", execution_id: "$json.execution_id", fingerprint: "$json.fingerprint", at: "$json.at" }, { onFail: "branch", retry: false }),
      slack.post("Alert the team", ALERTS, "':rotating_light: ' + $('Describe the failure').first().json.workflow + ' failed at \"' + $('Describe the failure').first().json.node + '\": ' + $('Describe the failure').first().json.message"),
      iff("Seen this hour?", isDuplicate),
      noop("Already alerted"),
      slack.post("Alert anyway", ALERTS, "':rotating_light: ' + $('Describe the failure').first().json.workflow + ' failed at \"' + $('Describe the failure').first().json.node + '\": ' + $('Describe the failure').first().json.message + ' (and the error log could not be written)'"),
    ],
    flow: [
      ["On workflow error", "Describe the failure", "Log the error", "Alert the team"],
      ["Log the error:1", "Seen this hour?", "Already alerted"],
      ["Seen this hour?:1", "Alert anyway"],
    ],
    story: [
      { title: "A workflow fails", copy: "Every workflow in the library names this one as its error workflow, so a failure anywhere arrives here.", nodes: ["On workflow error", "Describe the failure"] },
      { title: "It is logged once", copy: "The error is written to Supabase with a fingerprint of workflow, node, message and hour. A unique constraint refuses a repeat inside the hour.", nodes: ["Log the error", "Seen this hour?", "Already alerted"] },
      { title: "Slack hears about it once", copy: "Only a new fingerprint posts an alert, so a loop failing a thousand times is one message. If the log itself is down, the alert still goes.", nodes: ["Alert the team", "Alert anyway"] },
    ],
    tests: [
      {
        name: "a new failure is logged and alerted",
        input: [{ workflow: { name: "Orders" }, execution: { id: "77", lastNodeExecuted: "Create invoice", error: { message: "503 from billing" } } }],
        ran: ["Alert the team"],
        calls: [{ to: "supabase", path: "/rest/v1/workflow_errors", body: [{ workflow: "Orders" }] }, { to: "slack", path: "/api/chat.postMessage", body: { channel: "#ops-alerts" } }],
      },
      { name: "the same failure inside the hour is not alerted twice", input: [{ workflow: { name: "Orders" }, execution: { id: "78", lastNodeExecuted: "Create invoice", error: { message: "503 from billing" } } }], repeat: 2, callCount: { slack: 1 }, ran: ["Already alerted"] },
      { name: "an alert still goes when the log is down", fail: [{ path: "/rest/v1/workflow_errors", times: 1, status: 503 }], input: [{ workflow: { name: "Orders" }, execution: { lastNodeExecuted: "X", error: { message: "boom" } } }], ran: ["Alert anyway"], callCount: { slack: 1 } },
    ],
  }),

  define({
    ...base,
    id: "idempotency-guard",
    name: "Reliability · Idempotency guard",
    summary: "Answers one question for a caller: has this event been handled before? Webhooks are delivered more than once; a unique key in Supabase is what makes that safe.",
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
      db.insert("Claim the key", "idempotency_keys", { idempotency_key: "$json.idempotency_key", claimed_at: "$now.toISO()" }, { onFail: "branch", retry: false }),
      code("First time", `const before = $("Build the key").all();
return $input.all().map((_, i) => ({ json: { ...before[i].json, duplicate: false } }));`),
      iff("Already claimed?", isDuplicate),
      code("Seen before", `return $input.all().map((item) => { const { error, ...rest } = item.json; return { json: { ...rest, duplicate: true } }; });`),
      fail("Could not check", "=String($json.error ?? 'The idempotency key could not be claimed')"),
    ],
    flow: [
      ["When called", "Build the key", "Claim the key", "First time"],
      ["Claim the key:1", "Already claimed?", "Seen before"],
      ["Already claimed?:1", "Could not check"],
    ],
    story: [
      { title: "A caller asks", copy: "It passes a scope and a key: an order id, a payment event id, a lead's email.", nodes: ["When called", "Build the key"] },
      { title: "The key is claimed in Supabase", copy: "One insert against a unique constraint. The database decides, so two runs at the same moment cannot both win.", nodes: ["Claim the key", "First time"] },
      { title: "A refused insert is read carefully", copy: "Refused because the key exists means duplicate. Refused for any other reason stops the caller: an outage is never mistaken for 'already handled'.", nodes: ["Already claimed?", "Seen before", "Could not check"] },
    ],
    tests: [
      { name: "a first event is not a duplicate", input: [{ scope: "order", key: "1001" }], output: { node: "First time", json: { duplicate: false, idempotency_key: "order:1001" } } },
      { name: "a repeat is a duplicate", seed: { idempotency_keys: [{ idempotency_key: "order:1001" }] }, input: [{ scope: "order", key: "1001" }], output: { node: "Seen before", json: { duplicate: true, scope: "order" } } },
      { name: "a database outage stops the caller and is not read as a duplicate", fail: [{ path: "/rest/v1/idempotency_keys", times: 1, status: 503 }], input: [{ scope: "order", key: "1002" }], status: "error", ran: ["Could not check"], notRan: ["Seen before", "First time"] },
    ],
  }),

  define({
    ...base,
    id: "notify",
    name: "Reliability · Notify",
    summary: "The one place alerts leave from. Posts to Slack, and falls back to a SendGrid email when Slack is down, so an outage cannot hide its own alert.",
    nodes: [
      called(),
      set("Compose", { channel: `$json.channel ?? ${ALERTS}`, text: "($json.level === 'critical' ? ':red_circle: ' : $json.level === 'warn' ? ':warning: ' : ':information_source: ') + $json.text", level: "$json.level ?? 'info'" }),
      slack.post("Post to Slack", "$json.channel", "$json.text", { onFail: "branch" }),
      set("Delivered by Slack", { delivered: "'slack'" }),
      sendgrid.text("Email instead", { to: "'ops@example.com'", subject: "'Alert (Slack unavailable)'", text: "$('Compose').item.json.text" }),
      set("Delivered by email", { delivered: "'email'" }),
    ],
    flow: [
      ["When called", "Compose", "Post to Slack", "Delivered by Slack"],
      ["Post to Slack:1", "Email instead", "Delivered by email"],
    ],
    story: [
      { title: "Something needs saying", copy: "Any workflow calls this with a text and a level. No other workflow talks to Slack for alerts.", nodes: ["When called", "Compose"] },
      { title: "Slack first", copy: "Three attempts, a second apart.", nodes: ["Post to Slack", "Delivered by Slack"] },
      { title: "SendGrid if Slack is down", copy: "A failure after the retries takes the second output and the alert still arrives, by email.", nodes: ["Email instead", "Delivered by email"] },
    ],
    tests: [
      { name: "posts to Slack", input: [{ text: "Stock is low", level: "warn" }], ran: ["Delivered by Slack"], notRan: ["Email instead"], calls: [{ to: "slack", path: "/api/chat.postMessage", body: { text: ":warning: Stock is low", channel: "#ops-alerts" } }] },
      { name: "falls back to email when Slack stays down", fail: [{ path: "/api/chat.postMessage", times: 3, status: 503 }], input: [{ text: "Stock is low", level: "critical" }], ran: ["Email instead", "Delivered by email"], calls: [{ to: "sendgrid", path: "/v3/mail/send" }] },
      { name: "recovers when Slack fails once", fail: [{ path: "/api/chat.postMessage", times: 1, status: 503 }], input: [{ text: "Hello" }], ran: ["Delivered by Slack"], notRan: ["Email instead"] },
    ],
  }),

  define({
    ...base,
    id: "dead-letter",
    name: "Reliability · Dead letter",
    summary: "Keeps the payload of work that could not be finished in Supabase, with the reason, so nothing is lost when a platform is down.",
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
      db.insert("Park it", "dead_letters", { source: "$json.source", replay_url: "$json.replay_url", reason: "$json.reason", payload: "$json.payload", status: "$json.status", attempts: "$json.attempts", parked_at: "$json.parked_at" }),
      slack.post("Say so", ALERTS, "':inbox_tray: Parked 1 item from ' + $('Wrap the payload').item.json.source + ': ' + $('Wrap the payload').item.json.reason", { onFail: "continue" }),
    ],
    flow: [["When called", "Wrap the payload", "Park it", "Say so"]],
    story: [
      { title: "Work could not be finished", copy: "A caller hands over the payload, where it came from and why it failed.", nodes: ["When called", "Wrap the payload"] },
      { title: "It is parked, not dropped", copy: "The payload is stored in Supabase as pending, with the address that can replay it.", nodes: ["Park it"] },
      { title: "Slack is told", copy: "The alert is best effort: parking has already succeeded.", nodes: ["Say so"] },
    ],
    tests: [
      { name: "parks the payload as pending", input: [{ source: "orders", reason: "HubSpot 503", replay_url: "http://mocks:4010/replay/orders", payload: { order_id: 9 } }], calls: [{ to: "supabase", path: "/rest/v1/dead_letters", body: [{ status: "pending", source: "orders", payload: { order_id: 9 } }] }, { to: "slack" }] },
      { name: "still parks when Slack cannot be reached", fail: [{ path: "/api/chat.postMessage", times: 3 }], input: [{ source: "orders", reason: "x", payload: {} }], status: "success", table: { dead_letters: [{ source: "orders", status: "pending" }] } },
    ],
  }),

  define({
    ...base,
    id: "dead-letter-replay",
    name: "Reliability · Dead letter replay",
    summary: "Every fifteen minutes, sends parked work back to where it came from. Gives up after five attempts and tells Slack.",
    nodes: [
      schedule("Every 15 minutes", { minutes: 15 }),
      db.find("Fetch pending", "dead_letters", { status: "'pending'" }, { limit: 50 }),
      iff("Anything parked?", "!!$json.id"),
      batches("One at a time", 1),
      http("Replay", "=$json.replay_url", { body: "$json.payload", onFail: "branch", retry: false }),
      db.update("Mark replayed", "dead_letters", { id: "$('One at a time').item.json.id" }, { status: "'replayed'", replayed_at: "$now.toISO()" }),
      code(
        "Count the attempt",
        `const row = $("One at a time").first().json;
const attempts = (row.attempts ?? 0) + 1;
return [{ json: { id: row.id, source: row.source, attempts, status: attempts >= 5 ? "abandoned" : "pending" } }];`,
      ),
      db.update("Record the attempt", "dead_letters", { id: "$json.id" }, { attempts: "$json.attempts", status: "$json.status" }),
      iff("Given up?", "$('Count the attempt').item.json.status === 'abandoned'"),
      slack.post("Escalate", ALERTS, "':red_circle: Gave up replaying an item from ' + $('Count the attempt').item.json.source + ' after 5 attempts. It needs a person.'", { onFail: "continue" }),
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
      { title: "On a timer", copy: "Every fifteen minutes it asks Supabase for parked work.", nodes: ["Every 15 minutes", "Fetch pending", "Anything parked?", "Nothing to do"] },
      { title: "One at a time", copy: "Each item is sent back to the address that can redo it. One slow item does not hold the others.", nodes: ["One at a time", "Replay", "Mark replayed", "All replayed"] },
      { title: "Five attempts, then a person", copy: "A failed replay is counted. At five the item is abandoned and escalated in Slack.", nodes: ["Count the attempt", "Record the attempt", "Given up?", "Escalate"] },
    ],
    tests: [
      { name: "replays pending items and marks them", seed: { dead_letters: [{ id: "a", status: "pending", attempts: 0, source: "orders", replay_url: "http://mocks:4010/replay/orders", payload: { n: 1 } }, { id: "b", status: "pending", attempts: 0, source: "orders", replay_url: "http://mocks:4010/replay/orders", payload: { n: 2 } }] }, input: [{}], ran: ["Mark replayed", "All replayed"], callCount: { "/replay/orders": 2 }, table: { dead_letters: [{ id: "a", status: "replayed" }, { id: "b", status: "replayed" }] } },
      { name: "abandons after the fifth failure and escalates", seed: { dead_letters: [{ id: "a", status: "pending", attempts: 4, source: "orders", replay_url: "http://mocks:4010/replay/orders", payload: {} }] }, fail: [{ path: "/replay/orders", times: 1, status: 500 }], input: [{}], ran: ["Escalate"], table: { dead_letters: [{ id: "a", status: "abandoned", attempts: 5 }] }, callCount: { slack: 1 } },
      { name: "does nothing when nothing is parked", input: [{}], ran: ["Nothing to do"], notRan: ["One at a time"] },
    ],
  }),

  define({
    ...base,
    id: "heartbeat-monitor",
    name: "Reliability · Heartbeat monitor",
    summary: "Notices the failure nobody reports: a scheduled workflow that silently stopped running. Each one checks in to Supabase, and this alerts Slack when a check-in is overdue.",
    nodes: [
      schedule("Every hour", { hours: 1 }),
      db.find("Read heartbeats", "heartbeats"),
      code(
        "Find the overdue",
        `const now = Date.now();
return $input.all()
  .map((i) => i.json)
  .filter((h) => h.name && h.last_seen)
  .filter((h) => now - new Date(h.last_seen).getTime() > (h.max_gap_minutes ?? 90) * 60000)
  .map((h) => ({ json: { name: h.name, last_seen: h.last_seen, hours_silent: Math.round((now - new Date(h.last_seen).getTime()) / 36e5) } }));`,
      ),
      slack.post("Alert", ALERTS, "':zzz: ' + $json.name + ' has not run for ' + $json.hours_silent + 'h (last seen ' + $json.last_seen + ').'"),
    ],
    flow: [["Every hour", "Read heartbeats", "Find the overdue", "Alert"]],
    story: [
      { title: "Workflows check in", copy: "Each scheduled workflow writes a timestamp to Supabase when it finishes.", nodes: ["Every hour", "Read heartbeats"] },
      { title: "Silence is measured", copy: "A check-in older than the workflow's own allowed gap is overdue.", nodes: ["Find the overdue"] },
      { title: "One Slack alert per silent workflow", copy: "Nothing overdue means nothing is sent.", nodes: ["Alert"] },
    ],
    tests: [
      { name: "alerts for a workflow that went quiet", seed: { heartbeats: [{ name: "Daily report", last_seen: "2020-01-01T00:00:00Z", max_gap_minutes: 1500 }, { name: "Fresh", last_seen: "2999-01-01T00:00:00Z" }] }, input: [{}], callCount: { slack: 1 } },
      { name: "stays quiet when everything checked in", seed: { heartbeats: [{ name: "Fresh", last_seen: "2999-01-01T00:00:00Z" }] }, input: [{}], notRan: ["Alert"] },
    ],
  }),
];
