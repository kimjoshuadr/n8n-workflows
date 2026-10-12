/**
 * Payments: every payment event recorded exactly once, a daily check that the
 * books agree with the processor, and reminders for what is still owed.
 */
import { define, webhook, schedule, http, code, iff, route, call, respond, noop } from "../lib/wf.mjs";

const base = { folder: "systems/payments", tier: "flagship", system: "payments", category: "E-commerce and payments" };

export default [
  define({
    ...base,
    id: "payment-events",
    name: "Payments · Event ledger",
    summary: "Records each payment, failure and refund from the processor exactly once, updates the invoice, and sends the receipt or the retry notice.",
    integrations: ["Webhook", "Datastore", "Email", "Chat"],
    nodes: [
      webhook("Payment event", "payment-event"),
      iff("Signed?", "$json.headers['x-webhook-secret'] === $env.PAYMENTS_WEBHOOK_SECRET"),
      respond("Unauthorised", "{ ok: false }", { status: 401 }),
      code("Read the event", `const e = $("Payment event").first().json.body ?? {};
const o = e.data?.object ?? {};
if (!e.id || !e.type) throw new Error("Event has no id or type");
return [{ json: { event_id: String(e.id), type: e.type, amount: Number(o.amount ?? 0) / 100, currency: String(o.currency ?? "usd").toUpperCase(), invoice_id: o.metadata?.invoice_id ?? null, email: o.receipt_email ?? o.billing_details?.email ?? null, charge_id: o.id ?? null, scope: "payment-event", key: String(e.id) } }];`),
      call("Seen before?", "idempotency-guard"),
      iff("New event?", "!$json.duplicate"),
      respond("Already recorded", "{ ok: true, duplicate: true }"),
      route("Which event?", { paid: "$json.type === 'payment_intent.succeeded'", failed: "$json.type === 'payment_intent.payment_failed'", refunded: "$json.type === 'charge.refunded'" }),
      http("Ledger: credit", "DB:/ledger", { body: "{ event_id: $json.event_id, charge_id: $json.charge_id, kind: 'payment', amount: $json.amount, currency: $json.currency, invoice_id: $json.invoice_id, at: $now.toISO() }" }),
      http("Mark invoice paid", "DB:/invoices", { method: "PATCH", query: { id: "'eq.' + $('New event?').first().json.invoice_id" }, body: "{ status: 'paid', paid_at: $now.toISO() }", alwaysOutput: true }),
      http("Send receipt", "EMAIL:/emails", { body: "{ to: $('New event?').first().json.email, subject: 'Receipt for your payment', template: 'receipt', data: { amount: $('New event?').first().json.amount, currency: $('New event?').first().json.currency } }", onFail: "continue" }),
      http("Mark invoice failed", "DB:/invoices", { method: "PATCH", query: { id: "'eq.' + $json.invoice_id" }, body: "{ status: 'payment_failed', last_failure_at: $now.toISO() }", alwaysOutput: true }),
      http("Ask to update card", "EMAIL:/emails", { body: "{ to: $('New event?').first().json.email, subject: 'Your payment did not go through', template: 'payment-failed', data: { amount: $('New event?').first().json.amount } }", onFail: "continue" }),
      http("Ledger: debit", "DB:/ledger", { body: "{ event_id: $json.event_id, charge_id: $json.charge_id, kind: 'refund', amount: -$json.amount, currency: $json.currency, invoice_id: $json.invoice_id, at: $now.toISO() }" }),
      code("Refund message", `const e = $("New event?").first().json;
return [{ json: { text: "Refund of " + e.amount + " " + e.currency + " recorded for " + (e.email ?? "an unknown customer") + ".", level: "info" } }];`),
      call("Tell finance", "notify"),
      respond("Recorded", "{ ok: true }"),
      respond("Not handled", "{ ok: true, ignored: true }"),
    ],
    flow: [
      ["Payment event", "Signed?", "Read the event", "Seen before?", "New event?", "Which event?"],
      ["Signed?:1", "Unauthorised"],
      ["New event?:1", "Already recorded"],
      ["Which event?:0", "Ledger: credit", "Mark invoice paid", "Send receipt", "Recorded"],
      ["Which event?:1", "Mark invoice failed", "Ask to update card", "Recorded"],
      ["Which event?:2", "Ledger: debit", "Refund message", "Tell finance", "Recorded"],
      ["Which event?:3", "Not handled"],
    ],
    story: [
      { title: "The processor reports an event", copy: "Unsigned requests are refused. The reply is only sent once the event is safely recorded, so the processor retries anything that was not.", nodes: ["Payment event", "Signed?", "Unauthorised", "Read the event"] },
      { title: "Exactly once", copy: "Processors promise at-least-once delivery. The event id is claimed first, so a repeat changes nothing.", nodes: ["Seen before?", "New event?", "Already recorded"] },
      { title: "A payment", copy: "Credited to the ledger, the invoice marked paid, a receipt sent.", nodes: ["Which event?", "Ledger: credit", "Mark invoice paid", "Send receipt"] },
      { title: "A failure", copy: "The invoice is marked and the customer is asked to update their card.", nodes: ["Mark invoice failed", "Ask to update card"] },
      { title: "A refund", copy: "A negative ledger line, and finance is told.", nodes: ["Ledger: debit", "Refund message", "Tell finance"] },
      { title: "The processor gets its answer", copy: "Events the business does not act on are acknowledged and ignored.", nodes: ["Recorded", "Not handled"] },
    ],
    tests: [
      { name: "a payment is credited, the invoice paid and a receipt sent", seed: { invoices: [{ id: "inv1", status: "open" }] }, request: { headers: { "x-webhook-secret": "whsec_test" }, body: { id: "evt_1", type: "payment_intent.succeeded", data: { object: { id: "pi_1", amount: 12050, currency: "usd", receipt_email: "a@b.co", metadata: { invoice_id: "inv1" } } } } }, response: { status: 200, body: { ok: true } }, calls: [{ path: "/db/ledger", body: { kind: "payment", amount: 120.5, currency: "USD" } }, { path: "/email/emails", body: { template: "receipt" } }], table: { invoices: [{ id: "inv1", status: "paid" }] } },
      { name: "the same event twice is one ledger line", repeat: 2, request: { headers: { "x-webhook-secret": "whsec_test" }, body: { id: "evt_2", type: "payment_intent.succeeded", data: { object: { id: "pi_2", amount: 500, currency: "usd" } } } }, response: { body: { duplicate: true } }, callCount: { "/db/ledger": 1 } },
      { name: "a refund is a negative line and finance is told", request: { headers: { "x-webhook-secret": "whsec_test" }, body: { id: "evt_3", type: "charge.refunded", data: { object: { id: "ch_3", amount: 2000, currency: "usd" } } } }, calls: [{ path: "/db/ledger", body: { kind: "refund", amount: -20 } }], ran: ["Tell finance"] },
      { name: "a failed payment marks the invoice and asks for a new card", seed: { invoices: [{ id: "inv2", status: "open" }] }, request: { headers: { "x-webhook-secret": "whsec_test" }, body: { id: "evt_4", type: "payment_intent.payment_failed", data: { object: { id: "pi_4", amount: 900, receipt_email: "a@b.co", metadata: { invoice_id: "inv2" } } } } }, calls: [{ path: "/email/emails", body: { template: "payment-failed" } }], table: { invoices: [{ id: "inv2", status: "payment_failed" }] }, noCalls: ["/db/ledger"] },
      { name: "an unsigned request is refused", request: { body: { id: "evt_5", type: "payment_intent.succeeded" } }, response: { status: 401 }, noCalls: ["/db"] },
      { name: "an event we do not act on is acknowledged", request: { headers: { "x-webhook-secret": "whsec_test" }, body: { id: "evt_6", type: "customer.created", data: { object: {} } } }, response: { body: { ignored: true } }, noCalls: ["/db/ledger"] },
    ],
  }),

  define({
    ...base,
    id: "payment-reconcile",
    name: "Payments · Daily reconciliation",
    summary: "Each morning, compares yesterday's charges at the processor with the ledger and reports anything on one side and not the other.",
    integrations: ["Schedule", "Payments", "Datastore", "Chat"],
    nodes: [
      schedule("06:00 daily", "0 6 * * *"),
      http("Processor charges", "PAYMENTS:/charges", { method: "GET", query: { created_gte: "$now.minus({ days: 1 }).startOf('day').toSeconds()", created_lt: "$now.startOf('day').toSeconds()" } }),
      http("Ledger lines", "DB:/ledger", { method: "GET", query: { kind: "'eq.payment'", at: "'gte.' + $now.minus({ days: 1 }).startOf('day').toISO()" }, alwaysOutput: true, once: true }),
      code("Compare", `const charges = ($("Processor charges").first().json.data ?? []).filter((c) => c.paid !== false);
const ledger = $input.all().map((i) => i.json).filter((l) => l.charge_id);
const byCharge = new Map(ledger.map((l) => [l.charge_id, l]));
const seen = new Set();
const issues = [];
for (const c of charges) {
  const l = byCharge.get(c.id);
  seen.add(c.id);
  if (!l) issues.push({ charge_id: c.id, kind: "missing_in_ledger", processor_amount: c.amount / 100 });
  else if (Math.round(l.amount * 100) !== c.amount) issues.push({ charge_id: c.id, kind: "amount_mismatch", processor_amount: c.amount / 100, ledger_amount: l.amount });
}
for (const l of ledger) if (!seen.has(l.charge_id)) issues.push({ charge_id: l.charge_id, kind: "missing_at_processor", ledger_amount: l.amount });
return [{ json: { checked: charges.length, issues, clean: issues.length === 0, total: charges.reduce((s, c) => s + c.amount, 0) / 100 } }];`),
      iff("Books agree?", "$json.clean"),
      http("Post all clear", "CHAT:/chat.postMessage", { body: "{ channel: '#finance', text: ':white_check_mark: Reconciled ' + $json.checked + ' charges, ' + $json.total + ' total. Ledger matches.' }" }),
      code("One item per issue", `return $input.first().json.issues.map((json) => ({ json: { ...json, found_at: new Date().toISOString(), status: "open" } }));`),
      http("Record the issue", "DB:/reconciliation_issues", { body: "$json" }),
      code("Mismatch message", `const r = $("Compare").first().json;
return [{ json: { channel: "#finance", level: "critical", text: r.issues.length + " of " + r.checked + " charges do not match the ledger: " + r.issues.map((i) => i.charge_id + " (" + i.kind + ")").join(", ") } }];`),
      call("Alert finance", "notify"),
      http("Check in", "DB:/heartbeats", { method: "PATCH", query: { name: "'eq.payment-reconcile'" }, body: "{ last_seen: $now.toISO() }", onFail: "continue" }),
    ],
    flow: [
      ["06:00 daily", "Processor charges", "Ledger lines", "Compare", "Books agree?", "Post all clear", "Check in"],
      ["Books agree?:1", "One item per issue", "Record the issue", "Mismatch message", "Alert finance", "Check in"],
    ],
    story: [
      { title: "Two lists of yesterday", copy: "What the processor says it charged, and what the ledger says was recorded.", nodes: ["06:00 daily", "Processor charges", "Ledger lines"] },
      { title: "Compared line by line", copy: "Three things can be wrong: missing from the ledger, missing at the processor, or a different amount.", nodes: ["Compare", "Books agree?"] },
      { title: "A clean day says so", copy: "Finance gets a one-line confirmation, which is also proof the check ran.", nodes: ["Post all clear"] },
      { title: "A mismatch is recorded and raised", copy: "Each issue is stored as open, then finance gets one critical alert naming them.", nodes: ["One item per issue", "Record the issue", "Mismatch message", "Alert finance"] },
      { title: "It checks in", copy: "If this ever stops running, the heartbeat monitor notices.", nodes: ["Check in"] },
    ],
    tests: [
      { name: "matching books post an all clear", routes: [{ path: "/payments/charges", response: { data: [{ id: "ch_1", amount: 5000 }, { id: "ch_2", amount: 1250 }] } }], seed: { ledger: [{ charge_id: "ch_1", kind: "payment", amount: 50, at: "2999-01-01T00:00:00Z" }, { charge_id: "ch_2", kind: "payment", amount: 12.5, at: "2999-01-01T00:00:00Z" }] }, input: [{}], ran: ["Post all clear"], notRan: ["Alert finance"], output: { node: "Compare", json: { checked: 2, clean: true, total: 62.5 } } },
      { name: "a charge missing from the ledger is raised", routes: [{ path: "/payments/charges", response: { data: [{ id: "ch_1", amount: 5000 }, { id: "ch_9", amount: 700 }] } }], seed: { ledger: [{ charge_id: "ch_1", kind: "payment", amount: 50, at: "2999-01-01T00:00:00Z" }] }, input: [{}], ran: ["Alert finance"], calls: [{ path: "/db/reconciliation_issues", body: { charge_id: "ch_9", kind: "missing_in_ledger" } }] },
      { name: "a different amount is raised", routes: [{ path: "/payments/charges", response: { data: [{ id: "ch_1", amount: 5000 }] } }], seed: { ledger: [{ charge_id: "ch_1", kind: "payment", amount: 45, at: "2999-01-01T00:00:00Z" }] }, input: [{}], calls: [{ path: "/db/reconciliation_issues", body: { kind: "amount_mismatch", ledger_amount: 45, processor_amount: 50 } }] },
      { name: "a ledger line with no charge is raised", routes: [{ path: "/payments/charges", response: { data: [] } }], seed: { ledger: [{ charge_id: "ch_7", kind: "payment", amount: 9, at: "2999-01-01T00:00:00Z" }] }, input: [{}], calls: [{ path: "/db/reconciliation_issues", body: { kind: "missing_at_processor" } }] },
    ],
  }),

  define({
    ...base,
    id: "invoice-dunning",
    name: "Payments · Overdue reminders",
    summary: "Each morning, reminds customers with overdue invoices at 3, 7 and 14 days, then hands the invoice to a person at 21.",
    integrations: ["Schedule", "Datastore", "Email", "Chat"],
    nodes: [
      schedule("09:00 daily", "0 9 * * *"),
      http("Open invoices", "DB:/invoices", { method: "GET", query: { status: "'eq.open'" }, alwaysOutput: true }),
      code("Which step is due?", `const STEPS = [3, 7, 14, 21];
const today = Math.floor(Date.now() / 864e5);
return $input.all().map((i) => i.json).filter((inv) => inv.due_date && inv.email).map((inv) => {
  const overdue = today - Math.floor(new Date(inv.due_date).getTime() / 864e5);
  const step = STEPS.filter((s) => overdue >= s).pop() ?? 0;
  return { ...inv, overdue, step };
}).filter((inv) => inv.step > (inv.last_reminder_step ?? 0)).map((json) => ({ json }));`),
      iff("Still a reminder?", "$json.step < 21"),
      http("Send the reminder", "EMAIL:/emails", { body: "{ to: $json.email, subject: 'Invoice ' + $json.number + ' is ' + $json.overdue + ' days overdue', template: 'overdue-' + $json.step, data: { number: $json.number, amount: $json.amount, pay_url: $json.pay_url } }" }),
      http("Record the step", "DB:/invoices", { method: "PATCH", query: { id: "'eq.' + $('Which step is due?').item.json.id" }, body: "{ last_reminder_step: $('Which step is due?').item.json.step, last_reminder_at: $now.toISO() }" }),
      code("Escalation message", `return $input.all().map((i) => ({ json: { id: i.json.id, channel: "#finance", level: "warn", text: "Invoice " + i.json.number + " (" + i.json.email + ", " + i.json.amount + ") is " + i.json.overdue + " days overdue after three reminders. It needs a call." } }));`),
      call("Hand to a person", "notify"),
      http("Mark escalated", "DB:/invoices", { method: "PATCH", query: { id: "'eq.' + $('Escalation message').item.json.id" }, body: "{ last_reminder_step: 21, status: 'escalated' }" }),
    ],
    flow: [
      ["09:00 daily", "Open invoices", "Which step is due?", "Still a reminder?", "Send the reminder", "Record the step"],
      ["Still a reminder?:1", "Escalation message", "Hand to a person", "Mark escalated"],
    ],
    story: [
      { title: "It reads the open invoices", copy: "Paid invoices never appear here, because the payment workflow marks them the moment money arrives.", nodes: ["09:00 daily", "Open invoices"] },
      { title: "It works out the step", copy: "3, 7, 14 or 21 days overdue. A step already sent is never sent again, even if a day's run was missed.", nodes: ["Which step is due?", "Still a reminder?"] },
      { title: "A reminder, recorded", copy: "Each step has its own wording, and the step is written back.", nodes: ["Send the reminder", "Record the step"] },
      { title: "At 21 days a person takes over", copy: "Automation stops and finance is asked to call.", nodes: ["Escalation message", "Hand to a person", "Mark escalated"] },
    ],
    tests: [
      { name: "an invoice 8 days overdue gets the 7-day reminder", seed: { invoices: [{ id: "i1", number: "INV-1", email: "a@b.co", amount: 100, status: "open", due_date: new Date(Date.now() - 8 * 864e5).toISOString(), last_reminder_step: 3 }] }, input: [{}], calls: [{ path: "/email/emails", body: { template: "overdue-7" } }], table: { invoices: [{ id: "i1", last_reminder_step: 7 }] } },
      { name: "a step already sent is not sent again", seed: { invoices: [{ id: "i1", number: "INV-1", email: "a@b.co", status: "open", due_date: new Date(Date.now() - 8 * 864e5).toISOString(), last_reminder_step: 7 }] }, input: [{}], noCalls: ["/email"] },
      { name: "an invoice not yet due is left alone", seed: { invoices: [{ id: "i1", email: "a@b.co", status: "open", due_date: new Date(Date.now() + 5 * 864e5).toISOString() }] }, input: [{}], noCalls: ["/email"] },
      { name: "at 21 days it is handed to a person", seed: { invoices: [{ id: "i1", number: "INV-1", email: "a@b.co", amount: 100, status: "open", due_date: new Date(Date.now() - 22 * 864e5).toISOString(), last_reminder_step: 14 }] }, input: [{}], ran: ["Hand to a person"], noCalls: ["/email"], table: { invoices: [{ id: "i1", status: "escalated" }] } },
    ],
  }),
];
