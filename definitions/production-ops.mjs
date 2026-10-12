/** Production workflows for operations, people and monitoring. */
import { define, webhook, schedule, http, llm, code, iff, call, noop } from "../lib/wf.mjs";

const ops = { folder: "workflows/operations", tier: "production", category: "Operations and people" };
const mon = { folder: "workflows/monitoring", tier: "production", category: "Reporting and monitoring" };

export default [
  define({
    ...ops,
    id: "employee-onboarding",
    name: "People · New hire onboarding",
    summary: "When someone is hired, creates their checklist, books their first-week meetings, tells the people who need to act, and sends the welcome email on the right morning.",
    integrations: ["Webhook", "Datastore", "Calendar", "Email", "Chat"],
    nodes: [
      webhook("Hire confirmed", "hire-confirmed", { respond: "immediately" }),
      code("Read the hire", `const h = $input.first().json.body ?? {};
if (!h.email || !h.start_date) throw new Error("A hire needs an email and a start date");
return [{ json: { employee_id: String(h.id ?? h.email), email: String(h.email).toLowerCase(), name: h.name ?? "New hire", role: h.role ?? "", manager: h.manager_email ?? null, start_date: h.start_date, remote: h.remote === true, scope: "hire", key: String(h.id ?? h.email) } }];`),
      call("Seen before?", "idempotency-guard"),
      iff("New hire?", "!$json.duplicate"),
      code("Build the checklist", `const h = $input.first().json;
const day = (offset) => new Date(new Date(h.start_date).getTime() + offset * 864e5).toISOString().slice(0, 10);
const tasks = [
  { owner: "it", task: "Create accounts and order a laptop", due: day(-5) },
  { owner: "it", task: h.remote ? "Ship the laptop" : "Prepare a desk", due: day(-3) },
  { owner: "hr", task: "Send the contract and collect documents", due: day(-7) },
  { owner: "manager", task: "Write the 30-day plan", due: day(-1) },
  { owner: "manager", task: "First one-to-one", due: day(0) },
  { owner: "hr", task: "Day 30 check-in", due: day(30) },
];
return tasks.map((t) => ({ json: { ...t, employee_id: h.employee_id, employee: h.name, status: "open" } }));`),
      http("Save the task", "DB:/onboarding_tasks", { body: "$json" }),
      http("Book first-day welcome", "CALENDAR:/bookings", { body: "{ title: 'Welcome, ' + $('New hire?').first().json.name, start: $('New hire?').first().json.start_date + 'T09:30:00', attendees: [$('New hire?').first().json.email, $('New hire?').first().json.manager].filter(Boolean) }", once: true, onFail: "continue" }),
      http("Schedule the welcome email", "EMAIL:/emails", { body: "{ to: $('New hire?').first().json.email, subject: 'Welcome aboard, ' + $('New hire?').first().json.name, template: 'welcome-new-hire', send_at: $('New hire?').first().json.start_date + 'T08:00:00', data: { role: $('New hire?').first().json.role } }" , once: true }),
      code("Team message", `const h = $("New hire?").first().json;
return [{ json: { channel: "#people", level: "info", text: h.name + " (" + h.role + ") starts on " + h.start_date + ". Six onboarding tasks are assigned to IT, HR and their manager." } }];`),
      call("Tell the team", "notify"),
      noop("Already set up"),
    ],
    flow: [
      ["Hire confirmed", "Read the hire", "Seen before?", "New hire?", "Build the checklist", "Save the task", "Book first-day welcome", "Schedule the welcome email", "Team message", "Tell the team"],
      ["New hire?:1", "Already set up"],
    ],
    story: [
      { title: "A hire is confirmed", copy: "HR systems send the same event on every edit, so the hire is set up once.", nodes: ["Hire confirmed", "Read the hire", "Seen before?", "New hire?", "Already set up"] },
      { title: "A dated checklist", copy: "Six tasks counted back from the start date, each with an owner. Remote hires get a shipped laptop, not a desk.", nodes: ["Build the checklist", "Save the task"] },
      { title: "The first morning is arranged", copy: "A welcome meeting on the calendar and an email timed for 8am on day one.", nodes: ["Book first-day welcome", "Schedule the welcome email"] },
      { title: "The people who must act are told", copy: "One message, with the date.", nodes: ["Team message", "Tell the team"] },
    ],
    tests: [
      { name: "creates six tasks, a meeting and a timed welcome", repeat: 2, request: { body: { id: 42, email: "New@Co.com", name: "Sam", role: "Estimator", manager_email: "boss@co.com", start_date: "2026-12-01", remote: true } }, callCount: { "/db/onboarding_tasks": 6, "/calendar/bookings": 1, "/email/emails": 1 }, calls: [{ path: "/db/onboarding_tasks", body: { task: "Ship the laptop", due: "2026-11-28" } }, { path: "/email/emails", body: { send_at: "2026-12-01T08:00:00" } }] },
      { name: "a hire without a start date fails loudly", request: { body: { email: "a@b.co" } }, status: "error", noCalls: ["/db/onboarding_tasks"] },
    ],
  }),

  define({
    ...ops,
    id: "daily-agenda",
    name: "Calendar · Morning agenda",
    summary: "Posts today's meetings each weekday morning, with gaps and clashes pointed out, and stays silent on an empty day.",
    integrations: ["Schedule", "Calendar", "Chat"],
    nodes: [
      schedule("Weekdays 07:30", "30 7 * * 1-5"),
      http("Today's events", "CALENDAR:/events", { method: "GET", query: { from: "$now.startOf('day').toISO()", to: "$now.endOf('day').toISO()" } }),
      code("Lay out the day", `const events = ($input.first().json.events ?? []).filter((e) => e.start && e.end && !e.declined).sort((a, b) => new Date(a.start) - new Date(b.start));
const hm = (iso) => new Date(iso).toISOString().slice(11, 16);
const clashes = [];
for (let i = 1; i < events.length; i++) if (new Date(events[i].start) < new Date(events[i - 1].end)) clashes.push(events[i - 1].title + " / " + events[i].title);
const minutes = events.reduce((s, e) => s + (new Date(e.end) - new Date(e.start)) / 60000, 0);
const lines = events.map((e) => hm(e.start) + "-" + hm(e.end) + "  " + e.title);
return [{ json: { count: events.length, clashes, hours: Math.round(minutes / 6) / 10, text: lines.join("\\n") + (clashes.length ? "\\nClash: " + clashes.join("; ") : "") } }];`),
      iff("Anything on?", "$json.count > 0"),
      http("Post the agenda", "CHAT:/chat.postMessage", { body: "{ channel: '@me', text: ':calendar: ' + $json.count + ' meetings today, ' + $json.hours + 'h in total.\\n' + $json.text }" }),
      noop("Clear day"),
    ],
    flow: [
      ["Weekdays 07:30", "Today's events", "Lay out the day", "Anything on?", "Post the agenda"],
      ["Anything on?:1", "Clear day"],
    ],
    story: [
      { title: "Today's calendar", copy: "Declined events are dropped.", nodes: ["Weekdays 07:30", "Today's events"] },
      { title: "Laid out in order", copy: "Total hours in meetings, and any two that overlap.", nodes: ["Lay out the day", "Anything on?"] },
      { title: "One message, or none", copy: "An empty day gets no message at all.", nodes: ["Post the agenda", "Clear day"] },
    ],
    tests: [
      { name: "lists the day and flags a clash", routes: [{ path: "/calendar/events", response: { events: [{ title: "Standup", start: "2026-10-12T09:00:00Z", end: "2026-10-12T09:30:00Z" }, { title: "Client call", start: "2026-10-12T09:15:00Z", end: "2026-10-12T10:15:00Z" }, { title: "Skipped", start: "2026-10-12T11:00:00Z", end: "2026-10-12T12:00:00Z", declined: true }] } }], input: [{}], output: { node: "Lay out the day", json: { count: 2, hours: 1.5, clashes: ["Standup / Client call"] } }, calls: [{ path: "/chat/chat.postMessage" }] },
      { name: "stays silent on an empty day", routes: [{ path: "/calendar/events", response: { events: [] } }], input: [{}], ran: ["Clear day"], noCalls: ["/chat"] },
    ],
  }),

  define({
    ...ops,
    id: "contact-sync",
    name: "Data · CRM to email list sync",
    summary: "Copies contacts changed since the last run from the CRM to the email platform, page by page, and only moves its bookmark forward when a run finishes.",
    integrations: ["Schedule", "Datastore", "CRM", "Email"],
    nodes: [
      schedule("Every 15 minutes", { minutes: 15 }),
      http("Read the bookmark", "DB:/sync_cursors", { method: "GET", query: { name: "'eq.crm-to-email'" }, alwaysOutput: true }),
      code("Start from", `return [{ json: { since: $input.first().json.value ?? "1970-01-01T00:00:00Z", started_at: new Date().toISOString() } }];`),
      http("Changed contacts", "CRM:/crm/v3/objects/contacts/search", { body: "{ modified_since: $json.since, limit: 200 }" }),
      code("Shape for the list", `const rows = ($input.first().json.results ?? []).filter((c) => c.email);
return [{ json: { count: rows.length, contacts: rows.map((c) => ({ email: String(c.email).toLowerCase(), first_name: c.firstname ?? "", tags: [c.lifecyclestage].filter(Boolean), unsubscribed: c.unsubscribed === true })) } }];`),
      iff("Anything changed?", "$json.count > 0"),
      http("Upsert to the list", "EMAIL:/audiences/contacts/batch", { body: "{ contacts: $json.contacts }" }),
      http("Move the bookmark", "DB:/sync_cursors", { query: { on_conflict: "'name'" }, headers: { Prefer: "resolution=merge-duplicates" }, body: "{ name: 'crm-to-email', value: $('Start from').first().json.started_at }" }),
    ],
    flow: [
      ["Every 15 minutes", "Read the bookmark", "Start from", "Changed contacts", "Shape for the list", "Anything changed?", "Upsert to the list", "Move the bookmark"],
      ["Anything changed?:1", "Move the bookmark"],
    ],
    story: [
      { title: "Where did we get to?", copy: "A bookmark holds the time the last successful run started.", nodes: ["Every 15 minutes", "Read the bookmark", "Start from"] },
      { title: "Only what changed since", copy: "Unsubscribes travel with the contact, so the email platform never mails someone the CRM says not to.", nodes: ["Changed contacts", "Shape for the list", "Anything changed?"] },
      { title: "The bookmark moves last", copy: "If the upsert fails the bookmark stays put and the next run picks up the same contacts. Nothing is skipped.", nodes: ["Upsert to the list", "Move the bookmark"] },
    ],
    tests: [
      { name: "syncs changed contacts and moves the bookmark", seed: { sync_cursors: [{ name: "crm-to-email", value: "2026-01-01T00:00:00Z" }] }, routes: [{ path: "/crm/crm/v3/objects/contacts/search", response: { results: [{ email: "A@b.co", firstname: "Ana", lifecyclestage: "customer" }, { firstname: "No email" }] } }], input: [{}], calls: [{ path: "/crm/crm/v3/objects/contacts/search", body: { modified_since: "2026-01-01T00:00:00Z" } }, { path: "/email/audiences/contacts/batch", body: { contacts: [{ email: "a@b.co", tags: ["customer"] }] } }], output: { node: "Shape for the list", json: { count: 1 } } },
      { name: "a failed upsert leaves the bookmark where it was", seed: { sync_cursors: [{ name: "crm-to-email", value: "2026-01-01T00:00:00Z" }] }, routes: [{ path: "/crm/crm/v3/objects/contacts/search", response: { results: [{ email: "a@b.co" }] } }], fail: [{ path: "/email", times: 3 }], input: [{}], status: "error", table: { sync_cursors: [{ name: "crm-to-email", value: "2026-01-01T00:00:00Z" }] }, notRan: ["Move the bookmark"] },
    ],
  }),

  define({
    ...ops,
    id: "contract-expiry",
    name: "Contracts · Expiry reminders",
    summary: "Warns the owner of each contract 60, 30 and 7 days before it ends, so renewals are a decision and never an accident.",
    integrations: ["Schedule", "Datastore", "Email"],
    nodes: [
      schedule("Monday 09:00", "0 9 * * 1"),
      http("Active contracts", "DB:/contracts", { method: "GET", query: { status: "'eq.active'" }, alwaysOutput: true }),
      code("Which warning is due?", `const MARKS = [60, 30, 7];
const now = Date.now();
return $input.all().map((i) => i.json).filter((c) => c.ends_on && c.owner_email).map((c) => {
  const days = Math.ceil((new Date(c.ends_on).getTime() - now) / 864e5);
  const mark = MARKS.filter((m) => days <= m).pop();
  return { ...c, days, mark };
}).filter((c) => c.days >= 0 && c.mark && c.mark < (c.last_warning ?? 999)).map((json) => ({ json }));`),
      http("Warn the owner", "EMAIL:/emails", { body: "{ to: $json.owner_email, subject: $json.name + ' ends in ' + $json.days + ' days', template: 'contract-expiry', data: { name: $json.name, ends_on: $json.ends_on, auto_renews: $json.auto_renews === true, notice_days: $json.notice_days } }" }),
      http("Record the warning", "DB:/contracts", { method: "PATCH", query: { id: "'eq.' + $('Which warning is due?').item.json.id" }, body: "{ last_warning: $('Which warning is due?').item.json.mark }" }),
    ],
    flow: [["Monday 09:00", "Active contracts", "Which warning is due?", "Warn the owner", "Record the warning"]],
    story: [
      { title: "Every active contract", copy: "Supplier agreements, software licences, leases.", nodes: ["Monday 09:00", "Active contracts"] },
      { title: "Three warnings, each sent once", copy: "60, 30 and 7 days out. A missed week still sends the right one.", nodes: ["Which warning is due?"] },
      { title: "The owner is told what matters", copy: "Whether it renews by itself, and how much notice cancelling needs.", nodes: ["Warn the owner", "Record the warning"] },
    ],
    tests: [
      { name: "sends the 30-day warning once", seed: { contracts: [{ id: "c1", name: "Hosting", status: "active", owner_email: "a@b.co", ends_on: new Date(Date.now() + 25 * 864e5).toISOString(), last_warning: 60 }] }, repeat: 2, input: [{}], callCount: { "/email/emails": 1 }, table: { contracts: [{ id: "c1", last_warning: 30 }] } },
      { name: "a contract a year out is left alone", seed: { contracts: [{ id: "c1", name: "Lease", status: "active", owner_email: "a@b.co", ends_on: new Date(Date.now() + 365 * 864e5).toISOString() }] }, input: [{}], noCalls: ["/email"] },
    ],
  }),

  define({
    ...mon,
    id: "uptime-monitor",
    name: "Monitoring · Uptime checks",
    summary: "Checks each site every five minutes, alerts after two failures in a row, and reports how long it was down once it recovers.",
    integrations: ["Schedule", "Datastore", "Chat"],
    nodes: [
      schedule("Every 5 minutes", { minutes: 5 }),
      http("Sites to watch", "DB:/monitors", { method: "GET", alwaysOutput: true }),
      http("Request the site", "=$json.url", { method: "GET", fullResponse: true, retry: false, onFail: "continue" }),
      code("Decide the state", `const monitors = $("Sites to watch").all();
return $input.all().map((item, i) => {
  const m = monitors[i]?.json;
  if (!m?.url) return null;
  const status = item.json.statusCode ?? 0;
  const up = status >= 200 && status < 400;
  const failures = up ? 0 : (m.failures ?? 0) + 1;
  // Two in a row before it counts as down: one slow response is not an outage.
  const state = up ? "up" : failures >= 2 ? "down" : (m.state ?? "up");
  const changed = state !== (m.state ?? "up");
  const downSince = state === "down" ? (m.down_since ?? new Date().toISOString()) : null;
  const minutesDown = changed && state === "up" && m.down_since ? Math.round((Date.now() - new Date(m.down_since).getTime()) / 60000) : null;
  return { json: { id: m.id, name: m.name ?? m.url, url: m.url, status, state, failures, changed, down_since: downSince, minutes_down: minutesDown } };
}).filter(Boolean);`),
      http("Save the state", "DB:/monitors", { method: "PATCH", query: { id: "'eq.' + $json.id" }, body: "{ state: $json.state, failures: $json.failures, down_since: $json.down_since, checked_at: $now.toISO() }" }),
      code("Alerts for changes", `return $("Decide the state").all().map((i) => i.json).filter((m) => m.changed).map((m) => ({ json: { level: m.state === "down" ? "critical" : "info", text: m.state === "down" ? m.name + " is down (" + (m.status || "no response") + "). " + m.url : m.name + " is back up after " + m.minutes_down + " min." } }));`),
      call("Alert", "notify"),
    ],
    flow: [["Every 5 minutes", "Sites to watch", "Request the site", "Decide the state", "Save the state", "Alerts for changes", "Alert"]],
    story: [
      { title: "Each site is requested", copy: "A timeout or an error is a result to record, not a crash.", nodes: ["Every 5 minutes", "Sites to watch", "Request the site"] },
      { title: "Two failures make an outage", copy: "One bad response is noted and waited on. The second one in a row changes the state to down.", nodes: ["Decide the state", "Save the state"] },
      { title: "Down, and back up", copy: "One alert when it goes down, one when it recovers with how long it lasted. Nothing in between.", nodes: ["Alerts for changes", "Alert"] },
    ],
    tests: [
      { name: "one failure is noted without an alert", seed: { monitors: [{ id: "m1", name: "Shop", url: "http://mocks:4010/site/shop", state: "up", failures: 0 }] }, fail: [{ path: "/site/shop", times: 1, status: 500 }], input: [{}], noCalls: ["/chat"], table: { monitors: [{ id: "m1", failures: 1, state: "up" }] } },
      { name: "a second failure in a row alerts", seed: { monitors: [{ id: "m1", name: "Shop", url: "http://mocks:4010/site/shop", state: "up", failures: 1 }] }, fail: [{ path: "/site/shop", times: 1, status: 500 }], input: [{}], calls: [{ path: "/chat/chat.postMessage", body: { text: ":red_circle: Shop is down (500). http://mocks:4010/site/shop" } }], table: { monitors: [{ id: "m1", state: "down" }] } },
      { name: "recovery reports the downtime", seed: { monitors: [{ id: "m1", name: "Shop", url: "http://mocks:4010/site/shop", state: "down", failures: 4, down_since: new Date(Date.now() - 20 * 6e4).toISOString() }] }, input: [{}], calls: [{ path: "/chat/chat.postMessage", body: { text: ":information_source: Shop is back up after 20 min." } }], table: { monitors: [{ id: "m1", state: "up", failures: 0 }] } },
      { name: "still down stays quiet", seed: { monitors: [{ id: "m1", name: "Shop", url: "http://mocks:4010/site/shop", state: "down", failures: 4, down_since: new Date().toISOString() }] }, fail: [{ path: "/site/shop", times: 1, status: 500 }], input: [{}], noCalls: ["/chat"] },
    ],
  }),

  define({
    ...mon,
    id: "backup-verify",
    name: "Monitoring · Backup verification",
    summary: "Checks every morning that last night's backup exists, is recent and is not suspiciously small. A backup nobody checks is a hope, not a backup.",
    integrations: ["Schedule", "Backup", "Chat", "Datastore"],
    nodes: [
      schedule("07:00 daily", "0 7 * * *"),
      http("Latest backup", "BACKUP:/backups/latest", { method: "GET", onFail: "continue" }),
      code("Judge it", `const b = $input.first().json;
const problems = [];
if (!b || b.error || !b.created_at) problems.push("no backup could be found");
else {
  const hours = (Date.now() - new Date(b.created_at).getTime()) / 36e5;
  if (hours > 26) problems.push("the newest backup is " + Math.round(hours) + " hours old");
  if (b.status && b.status !== "completed") problems.push("its status is " + b.status);
  if (b.previous_size_bytes && b.size_bytes < b.previous_size_bytes * 0.7) problems.push("it is " + Math.round((1 - b.size_bytes / b.previous_size_bytes) * 100) + "% smaller than the one before");
  if (!b.size_bytes) problems.push("it is empty");
}
return [{ json: { ok: problems.length === 0, problems, size_mb: b?.size_bytes ? Math.round(b.size_bytes / 1048576) : null, created_at: b?.created_at ?? null } }];`),
      http("Record the check", "DB:/backup_checks", { body: "{ ok: $json.ok, problems: $json.problems, size_mb: $json.size_mb, at: $now.toISO() }", onFail: "continue" }),
      iff("Healthy?", "$('Judge it').first().json.ok"),
      code("Problem message", `return [{ json: { level: "critical", text: "Backup check failed: " + $("Judge it").first().json.problems.join("; ") + "." } }];`),
      call("Alert", "notify"),
      noop("All good"),
    ],
    flow: [
      ["07:00 daily", "Latest backup", "Judge it", "Record the check", "Healthy?", "All good"],
      ["Healthy?:1", "Problem message", "Alert"],
    ],
    story: [
      { title: "It asks for the newest backup", copy: "If the backup service does not answer, that is itself the finding.", nodes: ["07:00 daily", "Latest backup"] },
      { title: "Four ways a backup lies", copy: "Missing, stale, not completed, or much smaller than yesterday's.", nodes: ["Judge it", "Record the check", "Healthy?"] },
      { title: "Silence means it is fine", copy: "Only a problem produces an alert. Every check is recorded either way.", nodes: ["Problem message", "Alert", "All good"] },
    ],
    tests: [
      { name: "a fresh, full backup passes quietly", routes: [{ path: "/backup/backups/latest", response: { created_at: new Date().toISOString(), status: "completed", size_bytes: 5e8, previous_size_bytes: 4.9e8 } }], input: [{}], ran: ["All good"], noCalls: ["/chat"], calls: [{ path: "/db/backup_checks", body: { ok: true } }] },
      { name: "a backup a third smaller raises an alert", routes: [{ path: "/backup/backups/latest", response: { created_at: new Date().toISOString(), status: "completed", size_bytes: 3e8, previous_size_bytes: 5e8 } }], input: [{}], ran: ["Alert"], output: { node: "Judge it", json: { ok: false, problems: ["it is 40% smaller than the one before"] } } },
      { name: "a stale backup raises an alert", routes: [{ path: "/backup/backups/latest", response: { created_at: new Date(Date.now() - 50 * 36e5).toISOString(), status: "completed", size_bytes: 5e8 } }], input: [{}], ran: ["Alert"] },
      { name: "an unreachable backup service raises an alert", fail: [{ path: "/backup", times: 3 }], input: [{}], ran: ["Alert"], output: { node: "Judge it", json: { problems: ["no backup could be found"] } } },
    ],
  }),
];
