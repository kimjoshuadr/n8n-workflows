/**
 * Payments: every payment event recorded exactly once, a daily check that the
 * books agree with the processor, and reminders for what is still owed.
 */
import { schedule, code, iff, route, noop, call, define } from "../lib/wf.mjs";
import { db, slack, sendgrid, stripe, triggers } from "../lib/nodes.mjs";

const base = { folder: "systems/payments", tier: "flagship", system: "payments", category: "E-commerce and payments" };

export default [
  define({
    ...base,
    id: "payment-events",
    name: "Payments · Event ledger",
    summary: "Records each payment, failure and refund from the processor exactly once, updates the invoice, and sends the receipt or the retry notice.",
    nodes: [
      triggers.stripe("Payment event", ["payment_intent.succeeded", "payment_intent.payment_failed", "charge.refunded"]),
      code("Read the event", `const e = $("Payment event").first().json ?? {};
const o = e.data?.object ?? {};
if (!e.id || !e.type) throw new Error("Event has no id or type");
return [{ json: { event_id: String(e.id), type: e.type, amount: Number(o.amount ?? 0) / 100, currency: String(o.currency ?? "usd").toUpperCase(), invoice_id: o.metadata?.invoice_id ?? null, email: o.receipt_email ?? o.billing_details?.email ?? null, charge_id: o.id ?? null, scope: "payment-event", key: String(e.id) } }];`),
      call("Seen before?", "idempotency-guard"),
      iff("New event?", "!$json.duplicate"),
      noop("Already recorded"),
      route("Which event?", { paid: "$json.type === 'payment_intent.succeeded'", failed: "$json.type === 'payment_intent.payment_failed'", refunded: "$json.type === 'charge.refunded'" }),
      db.insert("Ledger: credit", "ledger", { event_id: "$json.event_id", charge_id: "$json.charge_id", kind: "'payment'", amount: "$json.amount", currency: "$json.currency", invoice_id: "$json.invoice_id", at: "$now.toISO()" }),
      db.update("Mark invoice paid", "invoices", { id: "$('New event?').first().json.invoice_id" }, { status: "'paid'", paid_at: "$now.toISO()" }),
      sendgrid.send("Send receipt", { to: "$('New event?').first().json.email", template: "'d-receipt'", data: { amount: "$('New event?').first().json.amount", currency: "$('New event?').first().json.currency" } }, { onFail: "continue" }),
      db.update("Mark invoice failed", "invoices", { id: "$json.invoice_id" }, { status: "'payment_failed'", last_failure_at: "$now.toISO()" }),
      sendgrid.send("Ask to update card", { to: "$('New event?').first().json.email", template: "'d-payment-failed'", data: { amount: "$('New event?').first().json.amount" } }, { onFail: "continue" }),
      db.insert("Ledger: debit", "ledger", { event_id: "$json.event_id", charge_id: "$json.charge_id", kind: "'refund'", amount: "-$json.amount", currency: "$json.currency", invoice_id: "$json.invoice_id", at: "$now.toISO()" }),
      code("Refund message", `const e = $("New event?").first().json;
return [{ json: { text: "Refund of " + e.amount + " " + e.currency + " recorded for " + (e.email ?? "an unknown customer") + ".", level: "info" } }];`),
      call("Tell finance", "notify"),
      noop("Recorded"),
      noop("Not handled"),
    ],
    flow: [
      ["Payment event", "Read the event", "Seen before?", "New event?", "Which event?"],
      ["New event?:1", "Already recorded"],
      ["Which event?:0", "Ledger: credit", "Mark invoice paid", "Send receipt", "Recorded"],
      ["Which event?:1", "Mark invoice failed", "Ask to update card", "Recorded"],
      ["Which event?:2", "Ledger: debit", "Refund message", "Tell finance", "Recorded"],
      ["Which event?:3", "Not handled"],
    ],
    story: [
      { title: "Stripe reports an event", copy: "The Stripe trigger verifies each event's signature before the workflow sees it.", nodes: ["Payment event", "Read the event"] },
      { title: "Exactly once", copy: "Processors promise at-least-once delivery. The event id is claimed first, so a repeat changes nothing.", nodes: ["Seen before?", "New event?", "Already recorded"] },
      { title: "A payment", copy: "Credited to the ledger, the invoice marked paid, a receipt sent.", nodes: ["Which event?", "Ledger: credit", "Mark invoice paid", "Send receipt"] },
      { title: "A failure", copy: "The invoice is marked and the customer is asked to update their card.", nodes: ["Mark invoice failed", "Ask to update card"] },
      { title: "A refund", copy: "A negative ledger line, and finance is told.", nodes: ["Ledger: debit", "Refund message", "Tell finance"] },
      { title: "Everything else is left alone", copy: "Events the business does not act on end here, recorded as seen.", nodes: ["Recorded", "Not handled"] },
    ],
    tests: [
      { name: "a payment is credited, the invoice paid and a receipt sent", seed: { invoices: [{ id: "inv1", status: "open" }] }, input: [{ id: "evt_1", type: "payment_intent.succeeded", data: { object: { id: "pi_1", amount: 12050, currency: "usd", receipt_email: "a@b.co", metadata: { invoice_id: "inv1" } } } }], calls: [{ to: "supabase", path: "/rest/v1/ledger", body: { kind: "payment", amount: 120.5, currency: "USD" } }, { to: "sendgrid", path: "/v3/mail/send", body: { template_id: "d-receipt" } }], table: { invoices: [{ id: "inv1", status: "paid" }] } },
      { name: "the same event twice is one ledger line", repeat: 2, input: [{ id: "evt_2", type: "payment_intent.succeeded", data: { object: { id: "pi_2", amount: 500, currency: "usd" } } }], callCount: { "supabase /rest/v1/ledger": 1 } },
      { name: "a refund is a negative line and finance is told", input: [{ id: "evt_3", type: "charge.refunded", data: { object: { id: "ch_3", amount: 2000, currency: "usd" } } }], calls: [{ to: "supabase", path: "/rest/v1/ledger", body: { kind: "refund", amount: -20 } }], ran: ["Tell finance"] },
      { name: "a failed payment marks the invoice and asks for a new card", seed: { invoices: [{ id: "inv2", status: "open" }] }, input: [{ id: "evt_4", type: "payment_intent.payment_failed", data: { object: { id: "pi_4", amount: 900, receipt_email: "a@b.co", metadata: { invoice_id: "inv2" } } } }], calls: [{ to: "sendgrid", path: "/v3/mail/send", body: { template_id: "d-payment-failed" } }], table: { invoices: [{ id: "inv2", status: "payment_failed" }] }, noCalls: ["/rest/v1/ledger"] },
      { name: "an event we do not act on is left alone", input: [{ id: "evt_6", type: "customer.created", data: { object: {} } }], noCalls: ["/rest/v1/ledger"] },
    ],
  }),

  define({
    ...base,
    id: "payment-reconcile",
    name: "Payments · Daily reconciliation",
    summary: "Each morning, compares yesterday's charges at the processor with the ledger and reports anything on one side and not the other.",
    nodes: [
      schedule("06:00 daily", "0 6 * * *"),
      stripe.charges("Processor charges", { from: "$now.minus({ days: 1 }).startOf('day').toSeconds()", to: "$now.startOf('day').toSeconds()" }),
      db.find("Ledger lines", "ledger", { kind: "'payment'", at: ["gte", "$now.minus({ days: 1 }).startOf('day').toISO()"] }, { once: true }),
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
      slack.post("Post all clear", "'#finance'", "':white_check_mark: Reconciled ' + $json.checked + ' charges, ' + $json.total + ' total. Ledger matches.'"),
      code("One item per issue", `return $input.first().json.issues.map((json) => ({ json: { ...json, found_at: new Date().toISOString(), status: "open" } }));`),
      db.insert("Record the issue", "reconciliation_issues", { charge_id: "$json.charge_id", kind: "$json.kind", processor_amount: "$json.processor_amount ?? null", ledger_amount: "$json.ledger_amount ?? null", found_at: "$json.found_at", status: "$json.status" }),
      code("Mismatch message", `const r = $("Compare").first().json;
return [{ json: { channel: "#finance", level: "critical", text: r.issues.length + " of " + r.checked + " charges do not match the ledger: " + r.issues.map((i) => i.charge_id + " (" + i.kind + ")").join(", ") } }];`),
      call("Alert finance", "notify"),
      db.update("Check in", "heartbeats", { name: "'payment-reconcile'" }, { last_seen: "$now.toISO()" }, { onFail: "continue", alwaysOutput: false }),
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
      { name: "matching books post an all clear", routes: [{ path: "api.stripe.com/v1/charges", response: { data: [{ id: "ch_1", amount: 5000 }, { id: "ch_2", amount: 1250 }] } }], seed: { ledger: [{ charge_id: "ch_1", kind: "payment", amount: 50, at: "2999-01-01T00:00:00Z" }, { charge_id: "ch_2", kind: "payment", amount: 12.5, at: "2999-01-01T00:00:00Z" }] }, input: [{}], ran: ["Post all clear"], notRan: ["Alert finance"], output: { node: "Compare", json: { checked: 2, clean: true, total: 62.5 } } },
      { name: "a charge missing from the ledger is raised", routes: [{ path: "api.stripe.com/v1/charges", response: { data: [{ id: "ch_1", amount: 5000 }, { id: "ch_9", amount: 700 }] } }], seed: { ledger: [{ charge_id: "ch_1", kind: "payment", amount: 50, at: "2999-01-01T00:00:00Z" }] }, input: [{}], ran: ["Alert finance"], calls: [{ to: "supabase", path: "/rest/v1/reconciliation_issues", body: { charge_id: "ch_9", kind: "missing_in_ledger" } }] },
      { name: "a different amount is raised", routes: [{ path: "api.stripe.com/v1/charges", response: { data: [{ id: "ch_1", amount: 5000 }] } }], seed: { ledger: [{ charge_id: "ch_1", kind: "payment", amount: 45, at: "2999-01-01T00:00:00Z" }] }, input: [{}], calls: [{ to: "supabase", path: "/rest/v1/reconciliation_issues", body: { kind: "amount_mismatch", ledger_amount: 45, processor_amount: 50 } }] },
      { name: "a ledger line with no charge is raised", routes: [{ path: "api.stripe.com/v1/charges", response: { data: [] } }], seed: { ledger: [{ charge_id: "ch_7", kind: "payment", amount: 9, at: "2999-01-01T00:00:00Z" }] }, input: [{}], calls: [{ to: "supabase", path: "/rest/v1/reconciliation_issues", body: { kind: "missing_at_processor" } }] },
    ],
  }),

  define({
    ...base,
    id: "invoice-dunning",
    name: "Payments · Overdue reminders",
    summary: "Each morning, reminds customers with overdue invoices at 3, 7 and 14 days, then hands the invoice to a person at 21.",
    nodes: [
      schedule("09:00 daily", "0 9 * * *"),
      db.find("Open invoices", "invoices", { status: "'open'" }),
      code("Which step is due?", `const STEPS = [3, 7, 14, 21];
const today = Math.floor(Date.now() / 864e5);
return $input.all().map((i) => i.json).filter((inv) => inv.due_date && inv.email).map((inv) => {
  const overdue = today - Math.floor(new Date(inv.due_date).getTime() / 864e5);
  const step = STEPS.filter((s) => overdue >= s).pop() ?? 0;
  return { ...inv, overdue, step };
}).filter((inv) => inv.step > (inv.last_reminder_step ?? 0)).map((json) => ({ json }));`),
      iff("Still a reminder?", "$json.step < 21"),
      sendgrid.send("Send the reminder", { to: "$json.email", template: "'d-overdue-' + $json.step", data: { number: "$json.number", amount: "$json.amount", pay_url: "$json.pay_url" } }),
      db.update("Record the step", "invoices", { id: "$('Which step is due?').item.json.id" }, { last_reminder_step: "$('Which step is due?').item.json.step", last_reminder_at: "$now.toISO()" }, { alwaysOutput: false }),
      code("Escalation message", `return $input.all().map((i) => ({ json: { id: i.json.id, channel: "#finance", level: "warn", text: "Invoice " + i.json.number + " (" + i.json.email + ", " + i.json.amount + ") is " + i.json.overdue + " days overdue after three reminders. It needs a call." } }));`),
      call("Hand to a person", "notify"),
      db.update("Mark escalated", "invoices", { id: "$('Escalation message').item.json.id" }, { last_reminder_step: "21", status: "'escalated'" }, { alwaysOutput: false }),
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
      { name: "an invoice 8 days overdue gets the 7-day reminder", seed: { invoices: [{ id: "i1", number: "INV-1", email: "a@b.co", amount: 100, status: "open", due_date: new Date(Date.now() - 8 * 864e5).toISOString(), last_reminder_step: 3 }] }, input: [{}], calls: [{ to: "sendgrid", path: "/v3/mail/send", body: { template_id: "d-overdue-7" } }], table: { invoices: [{ id: "i1", last_reminder_step: 7 }] } },
      { name: "a step already sent is not sent again", seed: { invoices: [{ id: "i1", number: "INV-1", email: "a@b.co", status: "open", due_date: new Date(Date.now() - 8 * 864e5).toISOString(), last_reminder_step: 7 }] }, input: [{}], noCalls: ["sendgrid"] },
      { name: "an invoice not yet due is left alone", seed: { invoices: [{ id: "i1", email: "a@b.co", status: "open", due_date: new Date(Date.now() + 5 * 864e5).toISOString() }] }, input: [{}], noCalls: ["sendgrid"] },
      { name: "at 21 days it is handed to a person", seed: { invoices: [{ id: "i1", number: "INV-1", email: "a@b.co", amount: 100, status: "open", due_date: new Date(Date.now() - 22 * 864e5).toISOString(), last_reminder_step: 14 }] }, input: [{}], ran: ["Hand to a person"], noCalls: ["sendgrid"], table: { invoices: [{ id: "i1", status: "escalated" }] } },
    ],
  }),
];
