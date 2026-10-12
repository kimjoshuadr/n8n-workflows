/**
 * Lead intake: an enquiry followed from the form to a booked call, with the
 * follow-up that happens when nobody books.
 */
import { define, webhook, schedule, http, llm, parseLlm, code, iff, route, respond, call, noop, batches } from "../lib/wf.mjs";

const base = { folder: "systems/lead-intake", tier: "flagship", system: "lead-intake", category: "Sales and CRM" };

export default [
  define({
    ...base,
    id: "lead-capture",
    name: "Lead intake · Capture and qualify",
    summary: "Takes an enquiry from any form, rejects junk, ignores repeats, has a model score the fit, then files it in the CRM and sends the right first reply.",
    integrations: ["Webhook", "LLM", "CRM", "Email", "Chat", "Datastore"],
    nodes: [
      webhook("Enquiry form", "lead-intake"),
      code(
        "Validate and normalise",
        `const b = $input.first().json.body ?? {};
const email = String(b.email ?? "").trim().toLowerCase();
const message = String(b.message ?? "").trim();
const errors = [];
if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)) errors.push("email");
if (message.length < 10) errors.push("message");
if (b.website) errors.push("honeypot"); // a field people never see and bots always fill
return [{ json: {
  valid: errors.length === 0, errors,
  email, message: message.slice(0, 4000),
  name: String(b.name ?? "").trim() || email.split("@")[0],
  company: String(b.company ?? "").trim() || null,
  source: String(b.source ?? "website"),
  received_at: new Date().toISOString(),
  scope: "lead", key: email + ":" + new Date().toISOString().slice(0, 10),
} }];`,
      ),
      iff("Valid?", "$json.valid"),
      respond("Reject", "{ ok: false, errors: $json.errors }", { status: 400 }),
      respond("Accept", "{ ok: true }", { status: 202 }),
      call("Seen today?", "idempotency-guard"),
      iff("New enquiry?", "!$json.duplicate"),
      noop("Ignore the repeat"),
      llm("Score the fit", {
        task: "qualify-lead",
        system: "You qualify inbound enquiries for a services business. Reply with JSON: { score: 0-100, fit: boolean, reason: string, missing: string[] }. Judge only what the message says.",
        user: "'From: ' + $json.name + ($json.company ? ' at ' + $json.company : '') + '\\n\\n' + $json.message",
        onFail: "continue",
      }),
      parseLlm("Read the verdict", { from: "New enquiry?", fallback: { score: null, fit: null, reason: "Model reply could not be read" } }),
      http("Save the lead", "DB:/leads", { body: "{ email: $json.email, name: $json.name, company: $json.company, message: $json.message, source: $json.source, score: $json.score, fit: $json.fit, reason: $json.reason, status: $json.fit === true ? 'qualified' : $json.fit === false ? 'nurture' : 'review', follow_ups: 0, booked: false, received_at: $json.received_at }" }),
      route("Which path?", { qualified: "$('Read the verdict').first().json.fit === true", nurture: "$('Read the verdict').first().json.fit === false" }),
      http("Create CRM contact", "CRM:/crm/v3/objects/contacts", { body: "{ properties: { email: $('Read the verdict').first().json.email, firstname: $('Read the verdict').first().json.name, company: $('Read the verdict').first().json.company, lead_score: $('Read the verdict').first().json.score, lifecyclestage: 'salesqualifiedlead' } }", onFail: "branch" }),
      http("Send booking link", "EMAIL:/emails", { body: "{ to: $('Read the verdict').first().json.email, subject: 'Thanks, ' + $('Read the verdict').first().json.name + '. Pick a time', template: 'booking-link', data: { name: $('Read the verdict').first().json.name } }" }),
      call("Tell sales", "notify"),
      call("Park for replay", "dead-letter"),
      http("Send nurture email", "EMAIL:/emails", { body: "{ to: $('Read the verdict').first().json.email, subject: 'Thanks for getting in touch', template: 'nurture-1', data: { name: $('Read the verdict').first().json.name, missing: $('Read the verdict').first().json.missing } }" }),
      call("Ask a person to look", "notify"),
      code("Sales message", `const l = $("Read the verdict").first().json;
return [{ json: { text: "New qualified lead: " + l.name + (l.company ? " (" + l.company + ")" : "") + ", score " + l.score + ". " + l.reason, level: "info" } }];`),
      code("Review message", `const l = $("Read the verdict").first().json;
return [{ json: { text: "A lead needs a human look (" + l.email + "): " + l.reason, level: "warn" } }];`),
      code("Dead letter payload", `const l = $("Read the verdict").first().json;
return [{ json: { source: "lead-capture", reason: "CRM contact could not be created", payload: l } }];`),
    ],
    flow: [
      ["Enquiry form", "Validate and normalise", "Valid?", "Accept", "Seen today?", "New enquiry?", "Score the fit", "Read the verdict", "Save the lead", "Which path?"],
      ["Valid?:1", "Reject"],
      ["New enquiry?:1", "Ignore the repeat"],
      ["Which path?:0", "Create CRM contact", "Send booking link", "Sales message", "Tell sales"],
      ["Create CRM contact:1", "Dead letter payload", "Park for replay"],
      ["Which path?:1", "Send nurture email"],
      ["Which path?:2", "Review message", "Ask a person to look"],
    ],
    story: [
      { title: "An enquiry arrives", copy: "Any form can post here. Bad emails, empty messages and bots that fill the hidden field are turned away with a 400.", nodes: ["Enquiry form", "Validate and normalise", "Valid?", "Reject"] },
      { title: "The form gets its answer first", copy: "The visitor sees success in milliseconds. Everything slower happens after the response.", nodes: ["Accept"] },
      { title: "Repeats are ignored", copy: "The same email on the same day is one enquiry, however many times the button was pressed.", nodes: ["Seen today?", "New enquiry?", "Ignore the repeat"] },
      { title: "A model scores the fit", copy: "It returns a score and a reason. If its reply cannot be read, the lead goes to a person rather than being guessed at.", nodes: ["Score the fit", "Read the verdict", "Save the lead"] },
      { title: "Three paths", copy: "A fit goes to the CRM and gets a booking link. A poor fit gets a helpful email. Anything unclear is flagged for review.", nodes: ["Which path?", "Create CRM contact", "Send booking link", "Send nurture email", "Review message", "Ask a person to look"] },
      { title: "Sales is told, and nothing is lost", copy: "If the CRM is down after three tries, the lead is parked for replay instead of disappearing.", nodes: ["Sales message", "Tell sales", "Dead letter payload", "Park for replay"] },
    ],
    tests: [
      {
        name: "a good enquiry reaches the CRM and gets a booking link",
        request: { body: { email: "Maria@NorthClinic.co", name: "Maria", company: "North Clinic", message: "We run three clinics and need a new site. Budget is set and timeline is spring." } },
        response: { status: 202, body: { ok: true } },
        ran: ["Tell sales"], notRan: ["Send nurture email", "Park for replay"],
        calls: [
          { path: "/crm/crm/v3/objects/contacts", body: { properties: { email: "maria@northclinic.co", lifecyclestage: "salesqualifiedlead" } } },
          { path: "/email/emails", body: { template: "booking-link" } },
          { path: "/db/leads", body: { status: "qualified", fit: true } },
        ],
      },
      { name: "a poor fit gets the nurture email and no CRM record", request: { body: { email: "sam@example.com", message: "hello there, just looking around really" } }, ran: ["Send nurture email"], noCalls: ["/crm"], calls: [{ path: "/db/leads", body: { status: "nurture" } }] },
      { name: "a bad email is rejected with a 400", request: { body: { email: "nope", message: "long enough message here" } }, response: { status: 400, body: { ok: false, errors: ["email"] } }, notRan: ["Seen today?"], noCalls: ["/llm", "/db"] },
      { name: "a bot filling the hidden field is rejected", request: { body: { email: "a@b.co", message: "long enough message here", website: "http://spam" } }, response: { status: 400 }, noCalls: ["/llm"] },
      { name: "the same enquiry twice is handled once", repeat: 2, request: { body: { email: "maria@northclinic.co", message: "We need a site, budget set, timeline spring." } }, callCount: { "/crm/crm/v3/objects/contacts": 1 }, ran: ["Ignore the repeat"] },
      { name: "an unreadable model reply goes to a person", routes: [{ path: "/llm/chat/completions", response: { choices: [{ message: { content: "Sure! Here you go" } }] } }], request: { body: { email: "x@y.co", message: "We need a site, budget set." } }, ran: ["Ask a person to look"], noCalls: ["/crm"], calls: [{ path: "/db/leads", body: { status: "review" } }] },
      { name: "a CRM outage parks the lead", fail: [{ path: "/crm", times: 3 }], request: { body: { email: "maria@northclinic.co", message: "We need a site, budget set, timeline spring." } }, ran: ["Park for replay"], notRan: ["Send booking link"], calls: [{ path: "/db/dead_letters", body: { source: "lead-capture" } }] },
    ],
  }),

  define({
    ...base,
    id: "lead-follow-up",
    name: "Lead intake · Follow up the unbooked",
    summary: "Each morning, writes to qualified leads who have not booked. Three nudges, two days apart, then the lead is marked cold and left alone.",
    integrations: ["Schedule", "Datastore", "Email"],
    nodes: [
      schedule("Every morning", "0 9 * * 1-5"),
      http("Unbooked leads", "DB:/leads", { method: "GET", query: { status: "'eq.qualified'", booked: "'eq.false'" }, alwaysOutput: true }),
      code(
        "Who is due?",
        `const now = Date.now();
const TWO_DAYS = 2 * 864e5;
return $input.all().map((i) => i.json).filter((l) => l.email)
  .filter((l) => now - new Date(l.last_contact_at ?? l.received_at).getTime() >= TWO_DAYS)
  .map((l) => ({ json: { ...l, next: (l.follow_ups ?? 0) + 1, give_up: (l.follow_ups ?? 0) >= 3 } }));`,
      ),
      iff("Nudges left?", "!$json.give_up"),
      http("Send the nudge", "EMAIL:/emails", { body: "{ to: $json.email, subject: ['Still thinking it over?', 'A quick question', 'Closing the loop'][$json.next - 1], template: 'follow-up-' + $json.next, data: { name: $json.name } }" }),
      http("Record the nudge", "DB:/leads", { method: "PATCH", query: { email: "'eq.' + $('Nudges left?').item.json.email" }, body: "{ follow_ups: $('Nudges left?').item.json.next, last_contact_at: $now.toISO() }" }),
      http("Mark cold", "DB:/leads", { method: "PATCH", query: { email: "'eq.' + $json.email" }, body: "{ status: 'cold' }" }),
      http("Check in", "DB:/heartbeats", { method: "PATCH", query: { name: "'eq.lead-follow-up'" }, body: "{ last_seen: $now.toISO() }", onFail: "continue" }),
    ],
    flow: [
      ["Every morning", "Unbooked leads", "Who is due?", "Nudges left?", "Send the nudge", "Record the nudge"],
      ["Nudges left?:1", "Mark cold"],
      ["Every morning", "Check in"],
    ],
    story: [
      { title: "Every weekday morning", copy: "It reads the qualified leads who have not booked, and checks in with the heartbeat monitor.", nodes: ["Every morning", "Unbooked leads", "Check in"] },
      { title: "Only the ones that are due", copy: "Two days since the last contact. State lives in the datastore, so no workflow sits waiting for days.", nodes: ["Who is due?", "Nudges left?"] },
      { title: "A nudge, then it is recorded", copy: "Each of the three emails is different. The count is written back straight away.", nodes: ["Send the nudge", "Record the nudge"] },
      { title: "It knows when to stop", copy: "After three, the lead is marked cold and never written to again.", nodes: ["Mark cold"] },
    ],
    tests: [
      { name: "nudges a lead that is due and counts it", seed: { leads: [{ email: "a@b.co", name: "A", status: "qualified", booked: false, follow_ups: 1, received_at: "2020-01-01T00:00:00Z" }] }, input: [{}], calls: [{ path: "/email/emails", body: { to: "a@b.co", template: "follow-up-2" } }], table: { leads: [{ email: "a@b.co", follow_ups: 2 }] } },
      { name: "leaves a lead contacted yesterday alone", seed: { leads: [{ email: "a@b.co", status: "qualified", booked: false, follow_ups: 0, received_at: new Date().toISOString() }] }, input: [{}], noCalls: ["/email"] },
      { name: "marks a lead cold after three nudges", seed: { leads: [{ email: "a@b.co", status: "qualified", booked: false, follow_ups: 3, received_at: "2020-01-01T00:00:00Z" }] }, input: [{}], noCalls: ["/email"], table: { leads: [{ email: "a@b.co", status: "cold" }] } },
      { name: "skips leads that already booked", seed: { leads: [{ email: "a@b.co", status: "qualified", booked: true, follow_ups: 0, received_at: "2020-01-01T00:00:00Z" }] }, input: [{}], noCalls: ["/email"] },
    ],
  }),

  define({
    ...base,
    id: "lead-booking-sync",
    name: "Lead intake · Booking sync",
    summary: "When a call is booked, moves the lead forward everywhere at once: the lead record, the CRM deal and the sales channel.",
    integrations: ["Webhook", "Calendar", "Datastore", "CRM", "Chat"],
    nodes: [
      webhook("Booking created", "booking-created", { respond: "immediately" }),
      code(
        "Read the booking",
        `const b = $input.first().json.body ?? {};
const p = b.payload ?? b;
const email = String(p.attendees?.[0]?.email ?? p.email ?? "").toLowerCase();
if (!email) throw new Error("Booking has no attendee email");
return [{ json: { email, starts_at: p.startTime ?? p.start_time, booking_id: String(p.uid ?? p.id), scope: "booking", key: String(p.uid ?? p.id) } }];`,
      ),
      call("Seen before?", "idempotency-guard"),
      iff("New booking?", "!$json.duplicate"),
      http("Mark lead booked", "DB:/leads", { method: "PATCH", query: { email: "'eq.' + $json.email" }, body: "{ booked: true, status: 'booked', call_at: $json.starts_at }", alwaysOutput: true }),
      iff("Known lead?", "!!$json.email"),
      http("Open CRM deal", "CRM:/crm/v3/objects/deals", { body: "{ properties: { dealname: 'Intro call: ' + $json.name, dealstage: 'appointmentscheduled', closedate: $json.call_at }, contact_email: $json.email }" }),
      code("Booked message", `const l = $("Known lead?").first().json;
return [{ json: { text: l.name + " booked a call for " + l.call_at + ".", level: "info" } }];`),
      call("Tell sales", "notify"),
      code("Unknown message", `return [{ json: { text: "A call was booked by " + $("New booking?").first().json.email + ", who is not in the leads table.", level: "warn" } }];`),
      call("Flag it", "notify"),
      noop("Already handled"),
    ],
    flow: [
      ["Booking created", "Read the booking", "Seen before?", "New booking?", "Mark lead booked", "Known lead?", "Open CRM deal", "Booked message", "Tell sales"],
      ["New booking?:1", "Already handled"],
      ["Known lead?:1", "Unknown message", "Flag it"],
    ],
    story: [
      { title: "The calendar reports a booking", copy: "Calendar tools resend webhooks, so the booking id is checked first.", nodes: ["Booking created", "Read the booking", "Seen before?", "New booking?", "Already handled"] },
      { title: "The lead moves forward", copy: "The lead is marked booked, which is also what stops the follow-up emails.", nodes: ["Mark lead booked", "Known lead?"] },
      { title: "The CRM and the team catch up", copy: "A deal opens at the right stage and sales sees it in the channel.", nodes: ["Open CRM deal", "Booked message", "Tell sales"] },
      { title: "Strangers are flagged", copy: "A booking from someone who never enquired still gets noticed.", nodes: ["Unknown message", "Flag it"] },
    ],
    tests: [
      { name: "a booking marks the lead and opens a deal", seed: { leads: [{ email: "a@b.co", name: "Ana", status: "qualified", booked: false }] }, request: { body: { payload: { uid: "bk1", startTime: "2026-11-02T10:00:00Z", attendees: [{ email: "A@b.co" }] } } }, calls: [{ path: "/crm/crm/v3/objects/deals", body: { properties: { dealstage: "appointmentscheduled" } } }], table: { leads: [{ email: "a@b.co", booked: true, status: "booked" }] }, ran: ["Tell sales"] },
      { name: "a booking from a stranger is flagged", request: { body: { payload: { uid: "bk2", attendees: [{ email: "new@x.co" }] } } }, ran: ["Flag it"], noCalls: ["/crm"] },
      { name: "a resent webhook is handled once", seed: { leads: [{ email: "a@b.co", name: "Ana", booked: false }] }, repeat: 2, request: { body: { payload: { uid: "bk3", attendees: [{ email: "a@b.co" }] } } }, callCount: { "/crm/crm/v3/objects/deals": 1 } },
    ],
  }),
];
