/** Production workflows for sales, CRM and support. One job each. */
import { define, webhook, schedule, http, llm, parseLlm, code, iff, route, call, respond, noop } from "../lib/wf.mjs";

const sales = { folder: "workflows/sales", tier: "production", category: "Sales and CRM" };
const support = { folder: "workflows/support", tier: "production", category: "Support and AI agents" };

export default [
  define({
    ...sales,
    id: "contact-enrichment",
    name: "CRM · Enrich new contacts",
    summary: "Fills in company, role and size for a new CRM contact from an enrichment service, and never overwrites what a person already typed.",
    integrations: ["Webhook", "Enrichment", "CRM"],
    nodes: [
      webhook("Contact created", "contact-created", { respond: "immediately" }),
      code("Read the contact", `const c = $input.first().json.body ?? {};
const email = String(c.email ?? "").toLowerCase();
const free = /@(gmail|yahoo|hotmail|outlook|icloud|proton)\\./.test(email);
return [{ json: { id: String(c.id), email, existing: c.properties ?? {}, skip: !email || free } }];`),
      iff("Work email?", "!$json.skip"),
      http("Look them up", "ENRICH:/people/match", { body: "{ email: $json.email }", onFail: "branch" }),
      code("Only the blanks", `const c = $("Work email?").first().json;
const found = $input.first().json.person ?? {};
const candidate = { company: found.organization?.name, jobtitle: found.title, company_size: found.organization?.estimated_num_employees, linkedin: found.linkedin_url };
const updates = Object.fromEntries(Object.entries(candidate).filter(([k, v]) => v != null && v !== "" && !c.existing[k]));
return [{ json: { id: c.id, updates, changed: Object.keys(updates).length > 0 } }];`),
      iff("Anything to add?", "$json.changed"),
      http("Update the contact", "CRM:/crm/v3/objects/contacts/update", { body: "{ id: $json.id, properties: $json.updates }" }),
      noop("Personal email, skipped"),
      noop("Nothing new"),
      noop("Lookup failed, left as is"),
    ],
    flow: [
      ["Contact created", "Read the contact", "Work email?", "Look them up", "Only the blanks", "Anything to add?", "Update the contact"],
      ["Work email?:1", "Personal email, skipped"],
      ["Look them up:1", "Lookup failed, left as is"],
      ["Anything to add?:1", "Nothing new"],
    ],
    story: [
      { title: "A contact is created", copy: "Personal email addresses are skipped: there is no company to find and the lookup costs money.", nodes: ["Contact created", "Read the contact", "Work email?", "Personal email, skipped"] },
      { title: "They are looked up", copy: "A failed lookup leaves the contact exactly as it was.", nodes: ["Look them up", "Lookup failed, left as is"] },
      { title: "Only blank fields are filled", copy: "Anything a person already entered wins over the enrichment service.", nodes: ["Only the blanks", "Anything to add?", "Update the contact", "Nothing new"] },
    ],
    tests: [
      { name: "fills blanks and keeps what was typed", routes: [{ path: "/enrich/people/match", response: { person: { title: "COO", organization: { name: "North Clinic", estimated_num_employees: 40 } } } }], request: { body: { id: 7, email: "maria@northclinic.co", properties: { jobtitle: "Operations lead" } } }, calls: [{ path: "/crm/crm/v3/objects/contacts/update", body: { id: "7", properties: { company: "North Clinic", company_size: 40 } } }], output: { node: "Only the blanks", json: { changed: true } } },
      { name: "skips a personal address without a lookup", request: { body: { id: 8, email: "someone@gmail.com" } }, noCalls: ["/enrich", "/crm"] },
      { name: "a failed lookup changes nothing", fail: [{ path: "/enrich", times: 3 }], request: { body: { id: 9, email: "a@firm.co" } }, ran: ["Lookup failed, left as is"], noCalls: ["/crm"] },
    ],
  }),

  define({
    ...sales,
    id: "meeting-notes-to-crm",
    name: "CRM · Meeting notes and next steps",
    summary: "Turns a call transcript into a CRM note and dated follow-up tasks, and asks a person when it cannot tell who owns a task.",
    integrations: ["Webhook", "LLM", "CRM", "Chat"],
    nodes: [
      webhook("Transcript ready", "transcript-ready", { respond: "immediately" }),
      code("Read the transcript", `const b = $input.first().json.body ?? {};
const text = String(b.transcript ?? "");
return [{ json: { deal_id: String(b.deal_id ?? ""), title: b.title ?? "Call", transcript: text.slice(0, 24000), too_short: text.split(/\\s+/).length < 40 } }];`),
      iff("Enough to summarise?", "!$json.too_short"),
      llm("Extract", { task: "meeting-notes", system: "From this call transcript reply with JSON: { summary: string (max 120 words), decisions: string[], actions: [{ task: string, owner: string|null, due: 'YYYY-MM-DD'|null }] }. Only include what was actually said.", user: "$json.transcript" }),
      parseLlm("Read the notes", { from: "Read the transcript", fallback: { summary: "", decisions: [], actions: [] } }),
      iff("Readable?", "!$json.parse_error && $json.summary.length > 0"),
      http("Add the CRM note", "CRM:/crm/v3/objects/notes", { body: "{ deal_id: $json.deal_id, body: $json.summary + '\\n\\nDecisions:\\n' + ($json.decisions ?? []).map(d => '- ' + d).join('\\n') }" }),
      code("One item per action", `const n = $("Readable?").first().json;
return (n.actions ?? []).filter((a) => a && a.task).map((a) => ({ json: { deal_id: n.deal_id, task: a.task, owner: a.owner ?? null, due: a.due ?? null } }));`),
      iff("Has an owner?", "!!$json.owner"),
      http("Create the task", "CRM:/crm/v3/objects/tasks", { body: "{ deal_id: $json.deal_id, subject: $json.task, owner: $json.owner, due: $json.due }" }),
      code("Unowned message", `return [{ json: { level: "warn", text: $input.all().length + " action(s) from the call have no clear owner: " + $input.all().map((i) => i.json.task).join("; ") } }];`),
      call("Ask who owns them", "notify"),
      code("Unreadable message", `return [{ json: { level: "warn", text: "Notes could not be extracted from \\"" + $("Read the transcript").first().json.title + "\\". The transcript is attached to the deal for a manual read." } }];`),
      call("Flag for a manual read", "notify"),
      noop("Too short to summarise"),
    ],
    flow: [
      ["Transcript ready", "Read the transcript", "Enough to summarise?", "Extract", "Read the notes", "Readable?", "Add the CRM note", "One item per action", "Has an owner?", "Create the task"],
      ["Enough to summarise?:1", "Too short to summarise"],
      ["Readable?:1", "Unreadable message", "Flag for a manual read"],
      ["Has an owner?:1", "Unowned message", "Ask who owns them"],
    ],
    story: [
      { title: "A call ends", copy: "A transcript of a few words is a missed call, not a meeting, and is left alone.", nodes: ["Transcript ready", "Read the transcript", "Enough to summarise?", "Too short to summarise"] },
      { title: "Summary, decisions, actions", copy: "Extracted as structured data. An unreadable reply is flagged for a manual read.", nodes: ["Extract", "Read the notes", "Readable?", "Unreadable message", "Flag for a manual read"] },
      { title: "The deal gets its note", copy: "The summary and decisions are attached to the deal.", nodes: ["Add the CRM note"] },
      { title: "Actions become tasks", copy: "Owned actions become dated tasks. Unowned ones are sent to the team to assign, in one message.", nodes: ["One item per action", "Has an owner?", "Create the task", "Unowned message", "Ask who owns them"] },
    ],
    tests: [
      { name: "writes the note, creates owned tasks and asks about unowned ones", routes: [{ path: "/llm/chat/completions", response: { choices: [{ message: { content: JSON.stringify({ summary: "Agreed scope.", decisions: ["Go ahead"], actions: [{ task: "Send proposal", owner: "kim", due: "2026-11-01" }, { task: "Check budget", owner: null }] }) } }] } }], request: { body: { deal_id: "d1", title: "Intro", transcript: Array(60).fill("word").join(" ") } }, callCount: { "/crm/crm/v3/objects/tasks": 1, "/crm/crm/v3/objects/notes": 1 }, calls: [{ path: "/crm/crm/v3/objects/tasks", body: { subject: "Send proposal", owner: "kim" } }], ran: ["Ask who owns them"] },
      { name: "a near-empty transcript is left alone", request: { body: { deal_id: "d1", transcript: "hello? hello?" } }, ran: ["Too short to summarise"], noCalls: ["/llm"] },
      { name: "an unreadable reply is flagged", routes: [{ path: "/llm/chat/completions", response: { choices: [{ message: { content: "sorry" } }] } }], request: { body: { deal_id: "d1", transcript: Array(60).fill("word").join(" ") } }, ran: ["Flag for a manual read"], noCalls: ["/crm"] },
    ],
  }),

  define({
    ...sales,
    id: "review-request",
    name: "Reviews · Ask after delivery",
    summary: "A week after an order is delivered, asks for a review once. Customers with an open support conversation are not asked.",
    integrations: ["Schedule", "Datastore", "Email"],
    nodes: [
      schedule("10:00 daily", "0 10 * * *"),
      http("Delivered orders", "DB:/orders", { method: "GET", query: { status: "'eq.delivered'", review_requested: "'is.null'" }, alwaysOutput: true }),
      code("Delivered a week ago", `const now = Date.now();
return $input.all().map((i) => i.json).filter((o) => o.email && o.delivered_at)
  .filter((o) => { const d = (now - new Date(o.delivered_at).getTime()) / 864e5; return d >= 7 && d < 30; })
  .map((json) => ({ json }));`),
      http("Open conversation?", "DB:/support_conversations", { method: "GET", query: { email: "'eq.' + $json.email", status: "'eq.open'", limit: "'1'" }, alwaysOutput: true }),
      code("Happy customers only", `const orders = $("Delivered a week ago").all();
return $input.all().map((item, i) => ({ order: orders[i]?.json, open: !!item.json.email })).filter((x) => x.order && !x.open).map((x) => ({ json: x.order }));`),
      http("Ask for a review", "EMAIL:/emails", { body: "{ to: $json.email, subject: 'How was your order?', template: 'review-request', data: { order_id: $json.order_id } }" }),
      http("Mark asked", "DB:/orders", { method: "PATCH", query: { order_id: "'eq.' + $('Happy customers only').item.json.order_id" }, body: "{ review_requested: true }" }),
    ],
    flow: [["10:00 daily", "Delivered orders", "Delivered a week ago", "Open conversation?", "Happy customers only", "Ask for a review", "Mark asked"]],
    story: [
      { title: "A week after delivery", copy: "Long enough to have used it, recent enough to remember.", nodes: ["10:00 daily", "Delivered orders", "Delivered a week ago"] },
      { title: "Not while there is a complaint open", copy: "Asking someone with an unresolved problem for a review is how bad reviews happen.", nodes: ["Open conversation?", "Happy customers only"] },
      { title: "Asked once", copy: "The order is marked as soon as the email goes.", nodes: ["Ask for a review", "Mark asked"] },
    ],
    tests: [
      { name: "asks once for a week-old delivery", seed: { orders: [{ order_id: "1", email: "a@b.co", status: "delivered", review_requested: null, delivered_at: new Date(Date.now() - 8 * 864e5).toISOString() }] }, input: [{}], calls: [{ path: "/email/emails", body: { template: "review-request" } }], table: { orders: [{ order_id: "1", review_requested: true }] } },
      { name: "does not ask a customer with an open conversation", seed: { orders: [{ order_id: "1", email: "a@b.co", status: "delivered", review_requested: null, delivered_at: new Date(Date.now() - 8 * 864e5).toISOString() }], support_conversations: [{ email: "a@b.co", status: "open" }] }, input: [{}], noCalls: ["/email"] },
      { name: "waits for the week to pass", seed: { orders: [{ order_id: "1", email: "a@b.co", status: "delivered", review_requested: null, delivered_at: new Date(Date.now() - 2 * 864e5).toISOString() }] }, input: [{}], noCalls: ["/email"] },
    ],
  }),

  define({
    ...sales,
    id: "nps-router",
    name: "Feedback · Route survey scores",
    summary: "Sends each survey score where it is useful: unhappy customers to a person today, happy ones to a review request, and every score to the record.",
    integrations: ["Webhook", "Datastore", "Helpdesk", "Email", "Chat"],
    nodes: [
      webhook("Survey answered", "survey-answered", { respond: "immediately" }),
      code("Read the score", `const b = $input.first().json.body ?? {};
const score = Number(b.score);
if (!Number.isInteger(score) || score < 0 || score > 10) throw new Error("Score must be an integer from 0 to 10");
return [{ json: { email: String(b.email ?? "").toLowerCase(), score, comment: String(b.comment ?? "").slice(0, 1000), group: score <= 6 ? "detractor" : score >= 9 ? "promoter" : "passive" } }];`),
      http("Record it", "DB:/nps_responses", { body: "{ email: $json.email, score: $json.score, comment: $json.comment, group: $json.group, at: $now.toISO() }" }),
      route("Which group?", { detractor: "$('Read the score').first().json.group === 'detractor'", promoter: "$('Read the score').first().json.group === 'promoter'" }),
      http("Open a ticket", "HELPDESK:/tickets", { body: "{ subject: 'Unhappy customer (score ' + $('Read the score').first().json.score + ')', from: $('Read the score').first().json.email, body: $('Read the score').first().json.comment, priority: 'high', team: 'success' }" }),
      code("Detractor message", `const s = $("Read the score").first().json;
return [{ json: { level: "warn", text: s.email + " scored us " + s.score + "/10" + (s.comment ? ": \\"" + s.comment.slice(0, 200) + "\\"" : " with no comment") + ". A ticket is open." } }];`),
      call("Tell customer success", "notify"),
      http("Invite a public review", "EMAIL:/emails", { body: "{ to: $('Read the score').first().json.email, subject: 'Thank you. Would you share that?', template: 'review-invite' }" }),
      noop("Recorded only"),
    ],
    flow: [
      ["Survey answered", "Read the score", "Record it", "Which group?"],
      ["Which group?:0", "Open a ticket", "Detractor message", "Tell customer success"],
      ["Which group?:1", "Invite a public review"],
      ["Which group?:2", "Recorded only"],
    ],
    story: [
      { title: "A score comes in", copy: "0 to 10, with an optional comment. Every one is recorded before anything else.", nodes: ["Survey answered", "Read the score", "Record it", "Which group?"] },
      { title: "6 or under: a person, today", copy: "A high-priority ticket and a message with the customer's own words.", nodes: ["Open a ticket", "Detractor message", "Tell customer success"] },
      { title: "9 or 10: ask them to say it publicly", copy: "The best moment to ask for a review is right after someone volunteers that they are happy.", nodes: ["Invite a public review"] },
      { title: "7 or 8: just the record", copy: "No email, no ticket.", nodes: ["Recorded only"] },
    ],
    tests: [
      { name: "a low score opens a ticket and tells the team", request: { body: { email: "a@b.co", score: 3, comment: "Late delivery" } }, calls: [{ path: "/helpdesk/tickets", body: { priority: "high" } }, { path: "/db/nps_responses", body: { group: "detractor" } }, { path: "/chat/chat.postMessage" }], noCalls: ["/email"] },
      { name: "a top score gets a review invite", request: { body: { email: "a@b.co", score: 10 } }, calls: [{ path: "/email/emails", body: { template: "review-invite" } }], noCalls: ["/helpdesk"] },
      { name: "a middling score is only recorded", request: { body: { email: "a@b.co", score: 8 } }, ran: ["Recorded only"], noCalls: ["/email", "/helpdesk"] },
      { name: "an impossible score fails loudly", request: { body: { email: "a@b.co", score: 14 } }, status: "error", noCalls: ["/db/nps_responses"] },
    ],
  }),

  define({
    ...sales,
    id: "webinar-registration",
    name: "Events · Webinar registration and reminders",
    summary: "Registers someone for a webinar, sends the calendar invite, and reminds them a day and an hour before. Full sessions get a waitlist reply.",
    integrations: ["Webhook", "Datastore", "Email"],
    nodes: [
      webhook("Registration", "webinar-register"),
      code("Read the form", `const b = $input.first().json.body ?? {};
const email = String(b.email ?? "").trim().toLowerCase();
return [{ json: { valid: /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email) && !!b.webinar_id, email, name: String(b.name ?? "").trim(), webinar_id: String(b.webinar_id ?? "") } }];`),
      iff("Valid?", "$json.valid"),
      respond("Invalid", "{ ok: false, error: 'A valid email and a webinar are required' }", { status: 400 }),
      http("Load the webinar", "DB:/webinars", { method: "GET", query: { id: "'eq.' + $json.webinar_id" }, alwaysOutput: true }),
      iff("Seats left?", "!!$json.id && ($json.registered ?? 0) < $json.capacity"),
      http("Register", "DB:/registrations", { query: { on_conflict: "'key'" }, body: "{ key: $('Read the form').first().json.webinar_id + ':' + $('Read the form').first().json.email, webinar_id: $('Read the form').first().json.webinar_id, email: $('Read the form').first().json.email, name: $('Read the form').first().json.name, reminded_day: false, reminded_hour: false }", alwaysOutput: true }),
      iff("Newly registered?", "!!$json.id"),
      http("Count the seat", "DB:/webinars", { method: "PATCH", query: { id: "'eq.' + $('Load the webinar').first().json.id" }, body: "{ registered: ($('Load the webinar').first().json.registered ?? 0) + 1 }" }),
      http("Send the invite", "EMAIL:/emails", { body: "{ to: $('Read the form').first().json.email, subject: 'You are in: ' + $('Load the webinar').first().json.title, template: 'webinar-confirmed', data: { starts_at: $('Load the webinar').first().json.starts_at, join_url: $('Load the webinar').first().json.join_url }, calendar_invite: true }" }),
      respond("Confirmed", "{ ok: true, status: 'registered' }"),
      respond("Already registered", "{ ok: true, status: 'already_registered' }"),
      http("Add to waitlist", "DB:/waitlist", { body: "{ webinar_id: $('Read the form').first().json.webinar_id, email: $('Read the form').first().json.email, at: $now.toISO() }" }),
      respond("Waitlisted", "{ ok: true, status: 'waitlisted' }"),
    ],
    flow: [
      ["Registration", "Read the form", "Valid?", "Load the webinar", "Seats left?", "Register", "Newly registered?", "Count the seat", "Send the invite", "Confirmed"],
      ["Valid?:1", "Invalid"],
      ["Seats left?:1", "Add to waitlist", "Waitlisted"],
      ["Newly registered?:1", "Already registered"],
    ],
    story: [
      { title: "Someone registers", copy: "The form gets a real answer: registered, already registered, waitlisted, or what was wrong.", nodes: ["Registration", "Read the form", "Valid?", "Invalid"] },
      { title: "Seats are checked", copy: "A full session puts the person on the waitlist instead of turning them away.", nodes: ["Load the webinar", "Seats left?", "Add to waitlist", "Waitlisted"] },
      { title: "One seat per person", copy: "Registering twice takes one seat and sends one invite.", nodes: ["Register", "Newly registered?", "Already registered"] },
      { title: "The invite goes out", copy: "With the calendar file, so it lands in their diary.", nodes: ["Count the seat", "Send the invite", "Confirmed"] },
    ],
    tests: [
      { name: "registers, counts the seat and sends the invite", seed: { webinars: [{ id: "w1", title: "Automation 101", capacity: 2, registered: 0 }] }, request: { body: { email: "A@b.co", name: "Ana", webinar_id: "w1" } }, response: { body: { status: "registered" } }, calls: [{ path: "/email/emails", body: { template: "webinar-confirmed", calendar_invite: true } }], table: { webinars: [{ id: "w1", registered: 1 }] } },
      { name: "registering twice takes one seat", seed: { webinars: [{ id: "w1", title: "T", capacity: 5, registered: 0 }] }, repeat: 2, request: { body: { email: "a@b.co", webinar_id: "w1" } }, response: { body: { status: "already_registered" } }, callCount: { "/email/emails": 1 }, table: { webinars: [{ id: "w1", registered: 1 }] } },
      { name: "a full session waitlists", seed: { webinars: [{ id: "w1", title: "T", capacity: 1, registered: 1 }] }, request: { body: { email: "a@b.co", webinar_id: "w1" } }, response: { body: { status: "waitlisted" } }, noCalls: ["/email"] },
      { name: "a bad email is a 400", request: { body: { email: "x", webinar_id: "w1" } }, response: { status: 400 }, noCalls: ["/db"] },
    ],
  }),

  define({
    ...support,
    id: "sla-watch",
    name: "Support · SLA breach watch",
    summary: "Every ten minutes, finds tickets about to miss their first-response time, warns the owner, and escalates the ones that already have. Each ticket is raised once per stage.",
    integrations: ["Schedule", "Helpdesk", "Chat"],
    nodes: [
      schedule("Every 10 minutes", { minutes: 10 }),
      http("Unanswered tickets", "HELPDESK:/tickets/search", { method: "GET", query: { status: "'open'", first_response: "'none'" } }),
      code("Measure against the SLA", `const SLA = { urgent: 30, high: 120, normal: 480, low: 1440 }; // minutes to first response
const now = Date.now();
return ($input.first().json.tickets ?? []).map((t) => {
  const limit = SLA[t.priority] ?? SLA.normal;
  const waited = Math.floor((now - new Date(t.created_at).getTime()) / 60000);
  const stage = waited >= limit ? "breached" : waited >= limit * 0.75 ? "at_risk" : "ok";
  return { id: String(t.id), subject: t.subject, owner: t.owner ?? "unassigned", priority: t.priority ?? "normal", waited, limit, stage, last: t.sla_stage ?? "ok" };
}).filter((t) => t.stage !== "ok" && t.stage !== t.last).map((json) => ({ json }));`),
      http("Remember the stage", "HELPDESK:/tickets/update", { body: "{ ticket_id: $json.id, sla_stage: $json.stage }" }),
      code("Write the alert", `const before = $("Measure against the SLA").all();
return $input.all().map((_, i) => { const t = before[i].json; return { json: { channel: "#support", level: t.stage === "breached" ? "critical" : "warn", text: t.stage === "breached" ? "SLA missed: #" + t.id + " \\"" + t.subject + "\\" has waited " + t.waited + " min (limit " + t.limit + "). Owner: " + t.owner : "SLA at risk: #" + t.id + " has " + (t.limit - t.waited) + " min left. Owner: " + t.owner } }; });`),
      call("Raise it", "notify"),
    ],
    flow: [["Every 10 minutes", "Unanswered tickets", "Measure against the SLA", "Remember the stage", "Write the alert", "Raise it"]],
    story: [
      { title: "Tickets with no reply yet", copy: "Checked every ten minutes.", nodes: ["Every 10 minutes", "Unanswered tickets"] },
      { title: "Measured against their own limit", copy: "Urgent tickets have 30 minutes, low ones a day. Three quarters of the way there is 'at risk'.", nodes: ["Measure against the SLA"] },
      { title: "Raised once per stage", copy: "The stage is written on the ticket, so the next run stays quiet until it gets worse.", nodes: ["Remember the stage", "Write the alert", "Raise it"] },
    ],
    tests: [
      { name: "warns at three quarters and escalates a miss", routes: [{ path: "/helpdesk/tickets/search", response: { tickets: [{ id: 1, subject: "Down", priority: "urgent", created_at: new Date(Date.now() - 25 * 6e4).toISOString() }, { id: 2, subject: "Late", priority: "urgent", created_at: new Date(Date.now() - 90 * 6e4).toISOString() }, { id: 3, subject: "Fine", priority: "low", created_at: new Date().toISOString() }] } }], input: [{}], callCount: { "/chat/chat.postMessage": 2 }, calls: [{ path: "/helpdesk/tickets/update", body: { ticket_id: "1", sla_stage: "at_risk" } }, { path: "/helpdesk/tickets/update", body: { ticket_id: "2", sla_stage: "breached" } }] },
      { name: "does not repeat a stage already raised", routes: [{ path: "/helpdesk/tickets/search", response: { tickets: [{ id: 2, subject: "Late", priority: "urgent", sla_stage: "breached", created_at: new Date(Date.now() - 90 * 6e4).toISOString() }] } }], input: [{}], noCalls: ["/chat"] },
    ],
  }),

  define({
    ...support,
    id: "email-autoresponder",
    name: "Support · Inbox triage and first reply",
    summary: "Sorts the shared inbox: answers the handful of questions that have a fixed answer, files newsletters and receipts, and leaves everything else for a person.",
    integrations: ["Webhook", "LLM", "Email", "Helpdesk"],
    nodes: [
      webhook("Email received", "email-received", { respond: "immediately" }),
      code("Read the email", `const m = $input.first().json.body ?? {};
const from = String(m.from ?? "").toLowerCase();
const auto = /no-?reply|mailer-daemon|notifications?@|newsletter/.test(from) || !!m.headers?.["auto-submitted"] || !!m.headers?.["list-unsubscribe"];
return [{ json: { id: String(m.id), from, subject: String(m.subject ?? ""), text: String(m.text ?? "").slice(0, 3000), auto } }];`),
      iff("From a person?", "!$json.auto"),
      http("Archive it", "EMAIL:/messages/archive", { body: "{ id: $json.id, label: 'automated' }" }),
      llm("What is it asking?", { task: "classify-intent", system: "Classify this email. Reply with JSON: { intent: 'opening_hours'|'pricing'|'reset_password'|'other', confident: boolean }. Use 'other' unless the email is plainly and only asking that one thing.", user: "$json.subject + '\\n\\n' + $json.text", onFail: "continue" }),
      parseLlm("Read the intent", { from: "From a person?", fallback: { intent: "other", confident: false } }),
      iff("A fixed-answer question?", "$json.confident === true && ['opening_hours', 'pricing', 'reset_password'].includes($json.intent)"),
      http("Send the standard reply", "EMAIL:/emails", { body: "{ to: $json.from, subject: 'Re: ' + $json.subject, template: 'faq-' + $json.intent, in_reply_to: $json.id }" }),
      http("Label as answered", "EMAIL:/messages/label", { body: "{ id: $('A fixed-answer question?').first().json.id, label: 'auto-answered' }" }),
      http("Leave for a person", "HELPDESK:/tickets", { body: "{ subject: $json.subject, from: $json.from, body: $json.text, source: 'email' }" }),
    ],
    flow: [
      ["Email received", "Read the email", "From a person?", "What is it asking?", "Read the intent", "A fixed-answer question?", "Send the standard reply", "Label as answered"],
      ["From a person?:1", "Archive it"],
      ["A fixed-answer question?:1", "Leave for a person"],
    ],
    story: [
      { title: "Mail arrives in the shared inbox", copy: "Newsletters, receipts and bounces are spotted from their headers and archived without a model call.", nodes: ["Email received", "Read the email", "From a person?", "Archive it"] },
      { title: "A model reads the rest", copy: "It may pick one of three fixed-answer questions, and only when the email is plainly asking that.", nodes: ["What is it asking?", "Read the intent", "A fixed-answer question?"] },
      { title: "Fixed questions get the fixed answer", copy: "The reply is a template a person wrote. The model chooses it and never writes it.", nodes: ["Send the standard reply", "Label as answered"] },
      { title: "Everything else becomes a ticket", copy: "Including anything the model was unsure about, and everything when the model is down.", nodes: ["Leave for a person"] },
    ],
    tests: [
      { name: "a plain opening-hours question gets the template", routes: [{ path: "/llm/chat/completions", response: { choices: [{ message: { content: "{\"intent\":\"opening_hours\",\"confident\":true}" } }] } }], request: { body: { id: "e1", from: "ana@b.co", subject: "Hours?", text: "When are you open on Saturday?" } }, calls: [{ path: "/email/emails", body: { template: "faq-opening_hours", to: "ana@b.co" } }], noCalls: ["/helpdesk"] },
      { name: "an unsure classification goes to a person", routes: [{ path: "/llm/chat/completions", response: { choices: [{ message: { content: "{\"intent\":\"pricing\",\"confident\":false}" } }] } }], request: { body: { id: "e2", from: "ana@b.co", subject: "Quote and a complaint", text: "..." } }, calls: [{ path: "/helpdesk/tickets", body: { source: "email" } }], noCalls: ["/email/emails"] },
      { name: "a newsletter is archived without a model call", request: { body: { id: "e3", from: "newsletter@shop.com", subject: "Sale", text: "..." } }, ran: ["Archive it"], noCalls: ["/llm", "/helpdesk"] },
      { name: "everything goes to a person while the model is down", fail: [{ path: "/llm", times: 3 }], request: { body: { id: "e4", from: "ana@b.co", subject: "Hours?", text: "When are you open?" } }, calls: [{ path: "/helpdesk/tickets" }], noCalls: ["/email/emails"] },
    ],
  }),
];
