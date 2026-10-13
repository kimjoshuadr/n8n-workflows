/**
 * AI support desk: one canvas, five ways in.
 *
 *   a ticket is opened     -> triaged, answered by a specialist agent that can
 *                             look things up, checked by a judge, then sent or
 *                             handed to a person
 *   every ten minutes      -> tickets about to miss their response time are raised
 *   every night            -> a sample of the agents' answers is audited
 *   every Monday           -> what the agents could not answer becomes a to-do list
 *   a survey is answered   -> an unhappy customer gets a person, with a draft ready
 *
 * Agents may read from Shopify, Stripe and the knowledge base. Only code may
 * decide that money moves or that a reply is fit to send.
 */
import { define, schedule, code, iff, route, call, noop } from "../lib/wf.mjs";
import { db, slack, zendesk, stripe, triggers, agent, claude, gpt, shape, toolCode, toolThink, toolKnowledge, embeddings, toolNode, fromAI } from "../lib/nodes.mjs";

const ticket = "$('Apply the triage rules').first().json";

/** A specialist: an agent, its model and the shape it must answer in. */
const specialist = (name, system, parts = [], extra = {}) => [
  agent(name, { system, prompt: "'Subject: ' + $json.subject + '\\n\\n' + $json.body + '\\n\\nCustomer email: ' + $json.email", structured: true }, { onFail: "continue" }),
  claude(`Claude · ${name.split(" ")[0].toLowerCase()}`, name),
  shape(`${name.split(" ")[0]} answer`, name, { reply: "The reply to the customer.", confidence: 0.85, needs_human: false, facts: ["A fact the reply relies on, with where it came from"], ...extra }),
  ...parts,
];

const RULES = "Reply in under 140 words, plain text, signed 'The Acme support team'. State only what a tool returned. If a tool returned nothing useful, set needs_human true and confidence low instead of guessing. Never promise a refund, a date or a discount: describe what you found and what happens next.";

const TRIAGE = (topic, more = {}) => ({ system: "Triage agent", final: { topic, urgency: "normal", sentiment: "calm", language: "en", ...more } });
const ANSWER = { reply: "Your order shipped on Monday and is with the courier. The Acme support team", confidence: 0.9, needs_human: false, facts: ["Shopify: order fulfilled, in transit"] };
const PASS = { system: "Judge agent", final: { pass: true, issues: [] } };

export default [
  define({
    id: "ai-support-desk",
    folder: "systems/ai-support-desk",
    tier: "flagship",
    system: "ai-support-desk",
    category: "AI agents",
    name: "AI support desk · Triage, specialists and a judge",
    summary: "A triage agent routes each Zendesk ticket to a specialist agent that can read Shopify, Stripe or the knowledge base. A separate judge checks every answer before it is sent, refunds are decided by a written policy in code, and anything uncertain reaches a person with the facts already gathered.",
    nodes: [
      /* ---- 1. Intake and triage ---- */
      triggers.zendesk("New ticket"),
      code("Read the ticket", `return $input.all().map((item) => {
  const t = item.json;
  const id = String(t.id ?? t.ticket_id ?? "");
  if (!id) throw new Error("Ticket has no id");
  return { json: {
    ticket_id: id,
    email: String(t.requester_email ?? t.requester?.email ?? "").toLowerCase(),
    subject: String(t.subject ?? "").slice(0, 300),
    body: String(t.description ?? t.body ?? "").slice(0, 4000),
    plan: t.organization?.plan ?? t.plan ?? "standard",
    scope: "support-ticket", key: id,
  } };
});`),
      call("Seen this ticket?", "idempotency-guard"),
      iff("New ticket?", "!$json.duplicate"),
      noop("Already handled"),
      agent("Triage agent", {
        system: "You are the Triage agent on a support desk. Read the ticket and decide: topic ('orders' for delivery, order status and returns; 'billing' for charges, invoices and refunds; 'technical' for something not working; 'other' for anything else), urgency ('low', 'normal' or 'high'), sentiment ('calm', 'frustrated' or 'angry') and the language it is written in as a two-letter code. Do not answer the ticket.",
        prompt: "'Subject: ' + $json.subject + '\\n\\n' + $json.body",
        structured: true,
      }, { onFail: "continue" }),
      gpt("GPT · triage", "Triage agent"),
      shape("Triage", "Triage agent", { topic: "orders", urgency: "normal", sentiment: "calm", language: "en" }),
      code("Apply the triage rules", `const t = $("New ticket?").first().json;
const m = $input.first().json.output;
const ok = m && ["orders", "billing", "technical", "other"].includes(m.topic);
const text = (t.subject + " " + t.body).toLowerCase();
// Things a person handles whatever the model made of them.
const human = [];
if (!ok) human.push("triage could not read the ticket");
if (/\\b(lawyer|legal action|sue|chargeback|trading standards|data protection|gdpr|press)\\b/.test(text)) human.push("legal or regulatory language");
if (ok && m.sentiment === "angry") human.push("the customer is angry");
if (t.plan === "enterprise") human.push("enterprise account");
if (ok && m.language && m.language !== "en") human.push("written in " + m.language);
return [{ json: { ...t, topic: ok ? m.topic : "other", urgency: ok ? m.urgency : "normal", sentiment: ok ? m.sentiment : "unknown", straight_to_human: human.length > 0, human_reasons: human } }];`),
      zendesk.update("Tag the ticket", "$json.ticket_id", { tags: ["ai-triaged"], internalNote: "'Triage: ' + $json.topic + ', ' + $json.urgency + ', ' + $json.sentiment" }, { onFail: "continue" }),
      iff("Straight to a person?", `${ticket}.straight_to_human`),
      code("Skip the agents", `return [{ json: $("Apply the triage rules").first().json }];`),
      route("Which specialist?", { orders: `${ticket}.topic === 'orders'`, billing: `${ticket}.topic === 'billing'`, technical: `${ticket}.topic === 'technical'` }),
      code("To the orders agent", `return [{ json: $("Apply the triage rules").first().json }];`),
      code("To the billing agent", `return [{ json: $("Apply the triage rules").first().json }];`),
      code("To the technical agent", `return [{ json: $("Apply the triage rules").first().json }];`),
      code("To the general agent", `return [{ json: $("Apply the triage rules").first().json }];`),

      /* ---- 2. Specialists ---- */
      ...specialist("Orders agent", "You are the Orders agent. Look the order up in Shopify before saying anything about it. " + RULES, [
        toolNode("shopify", "Order lookup", "Orders agent", "Gets one Shopify order by its id: status, fulfilment, tracking and line items.", "shopify", 1, { authentication: "accessToken", resource: "order", operation: "get", orderId: fromAI("order_id", "The Shopify order id from the ticket"), options: {} }),
        toolNode("supabase", "Order history", "Orders agent", "Lists this customer's past orders from the orders table. Pass their email.", "supabase", 1, { resource: "row", operation: "getAll", tableId: "orders", returnAll: false, limit: 10, filterType: "string", filterString: fromAI("filter", "A PostgREST filter such as email=eq.ana@example.com") }),
      ]),
      ...specialist("Billing agent", "You are the Billing agent. Look the charge up in Stripe before saying anything about it. If the customer is asking for money back, do not decide it: describe what you found and set refund to the charge id and the amount in the currency's main unit. A separate policy decides. " + RULES, [
        toolNode("stripe", "Charge lookup", "Billing agent", "Gets one Stripe charge by its id: amount, status, date and whether it was refunded.", "stripe", 1, { resource: "charge", operation: "get", chargeId: fromAI("charge_id", "The Stripe charge id, starting ch_") }),
        toolNode("stripe", "Customer lookup", "Billing agent", "Gets one Stripe customer by id.", "stripe", 1, { resource: "customer", operation: "get", customerId: fromAI("customer_id", "The Stripe customer id, starting cus_") }),
        toolCode("Days since", "Billing agent", "Returns how many whole days ago an ISO date or a Unix timestamp in seconds was.", "const t = /^\\d+$/.test(String(query).trim()) ? Number(query) * 1000 : Date.parse(query); if (Number.isNaN(t)) return 'unknown'; return String(Math.floor((Date.now() - t) / 864e5));"),
      ], { refund: { charge: "ch_123", amount: 0 } }),
      ...specialist("Technical agent", "You are the Technical agent. Search the knowledge base and answer only from what it returns, citing the article titles in facts. " + RULES, [
        toolKnowledge("Help centre", "Technical agent", "Search the help centre and troubleshooting guides. Pass a short description of the problem."),
        embeddings("Embeddings · help centre", "Help centre"),
        toolThink("Work it through", "Technical agent"),
      ]),
      ...specialist("General agent", "You are the General agent, for questions that are not about an order, a charge or a fault. Search the knowledge base for policy and how-to answers. " + RULES, [
        toolKnowledge("Policies and guides", "General agent", "Search company policies, opening hours and how-to guides."),
        embeddings("Embeddings · policies", "Policies and guides"),
      ]),
      code("Collect the answer", `const t = $("Apply the triage rules").first().json;
const o = $input.first().json.output;
const ok = o && typeof o.reply === "string" && o.reply.trim().length > 0;
const refund = t.topic === "billing" && o && o.refund && o.refund.charge ? { charge: String(o.refund.charge), amount: Number(o.refund.amount) } : null;
return [{ json: { ...t, reply: ok ? o.reply.trim() : null, confidence: ok ? Number(o.confidence) || 0 : 0, needs_human: !ok || o.needs_human === true, facts: ok ? (o.facts ?? []) : [], refund, agent_failed: !ok } }];`),

      /* ---- 3. Refund policy ---- */
      iff("Refund asked for?", "!!$json.refund"),
      db.find("Past refunds", "refunds", { email: "$json.email" }),
      code("Apply the refund policy", `const a = $("Collect the answer").first().json;
const past = $input.all().map((i) => i.json).filter((r) => r.email);
const reasons = [];
if (!(a.refund.amount > 0)) reasons.push("no amount could be read");
if (a.refund.amount > 100) reasons.push("over the 100 automatic limit");
if (past.length >= 2) reasons.push("third refund for this customer");
if (past.some((r) => r.charge === a.refund.charge)) reasons.push("this charge was already refunded");
return [{ json: { ...a, refund_ok: reasons.length === 0, refund_reasons: reasons } }];`),
      iff("Inside the policy?", "$json.refund_ok"),
      stripe.refund("Refund in Stripe", { charge: "$json.refund.charge", amount: "Math.round($json.refund.amount * 100)", key: "'refund-' + $json.ticket_id" }, { onFail: "branch" }),
      db.insert("Record the refund", "refunds", { email: "$('Inside the policy?').first().json.email", charge: "$('Inside the policy?').first().json.refund.charge", amount: "$('Inside the policy?').first().json.refund.amount", ticket_id: "$('Inside the policy?').first().json.ticket_id", at: "$now.toISO()" }),
      code("Add the refund to the reply", `const a = $("Inside the policy?").first().json;
return [{ json: { ...a, reply: a.reply + "\\n\\nWe have refunded " + a.refund.amount.toFixed(2) + " to your original payment method. It usually arrives within 5 to 10 working days.", refunded: true } }];`),
      code("Refund needs a person", `const a = $("Collect the answer").first().json;
const why = $input.first().json.refund_reasons ?? ["Stripe could not process the refund"];
return [{ json: { ...a, needs_human: true, human_reasons: ["refund outside the policy: " + why.join(", ")] } }];`),

      /* ---- 4. The judge ---- */
      agent("Judge agent", {
        system: "You are the Judge agent. You did not write this reply. Pass it only if every statement in it is supported by the listed facts, it answers what the customer asked, it promises nothing, and the tone is calm and plain. List every problem you find.",
        prompt: "JSON.stringify({ ticket: { subject: $json.subject, body: $json.body }, reply: $json.reply, facts: $json.facts })",
        structured: true,
      }, { onFail: "continue" }),
      gpt("GPT · judging", "Judge agent"),
      shape("Verdict", "Judge agent", { pass: true, issues: ["A specific problem, if any"] }),
      code("Decide: send or hand over", `const a = $("Add the refund to the reply").isExecuted ? $("Add the refund to the reply").first().json : $("Collect the answer").first().json;
const v = $input.first().json.output;
const judged = v && typeof v.pass === "boolean";
const reasons = [...(a.human_reasons ?? [])];
if (a.needs_human) reasons.push("the specialist asked for a person");
if (a.confidence < 0.75) reasons.push("low confidence (" + a.confidence + ")");
if (!judged) reasons.push("the judge could not be reached");
else if (!v.pass) reasons.push("the judge rejected it: " + (v.issues ?? []).join("; "));
// Checks no model is asked to make.
const reply = String(a.reply ?? "");
if (/guarantee|we promise|definitely will|100%/i.test(reply)) reasons.push("the reply makes a promise");
if (/\\b(?:\\d[ -]?){13,19}\\b/.test(reply)) reasons.push("the reply contains what looks like a card number");
if (reply.split(/\\s+/).filter(Boolean).length > 220) reasons.push("the reply is too long");
return [{ json: { ...a, send: reasons.length === 0, human_reasons: reasons } }];`),
      iff("Fit to send?", "$json.send"),
      zendesk.update("Send the reply", "$json.ticket_id", { status: "'pending'", publicReply: "$json.reply", tags: ["ai-answered"] }),
      db.insert("Log: answered", "support_log", { ticket_id: "$('Fit to send?').first().json.ticket_id", topic: "$('Fit to send?').first().json.topic", question: "$('Fit to send?').first().json.subject", reply: "$('Fit to send?').first().json.reply", answered: "true", confidence: "$('Fit to send?').first().json.confidence", refunded: "$('Fit to send?').first().json.refunded === true", at: "$now.toISO()" }),

      /* ---- 5. Hand over ---- */
      code("Write the handover", `const t = $input.first().json;
const reasons = t.human_reasons ?? [];
const draft = t.reply ? "\\n\\nDraft the agents wrote (not sent):\\n" + t.reply : "";
const facts = (t.facts ?? []).length ? "\\n\\nWhat was found:\\n- " + t.facts.join("\\n- ") : "";
return [{ json: { ticket_id: t.ticket_id, topic: t.topic, subject: t.subject, urgency: t.urgency ?? "normal", confidence: t.confidence ?? 0, reasons, note: "Handed to a person because: " + reasons.join("; ") + "." + facts + draft } }];`),
      zendesk.update("Assign to the team", "$json.ticket_id", { status: "'open'", priority: "$json.urgency === 'high' ? 'urgent' : 'normal'", internalNote: "$json.note", tags: ["needs-human"] }),
      db.insert("Log: handed over", "support_log", { ticket_id: "$('Write the handover').first().json.ticket_id", topic: "$('Write the handover').first().json.topic", question: "$('Write the handover').first().json.subject", answered: "false", reasons: "$('Write the handover').first().json.reasons", confidence: "$('Write the handover').first().json.confidence", at: "$now.toISO()" }),
      code("Handover message", `const h = $("Write the handover").first().json;
return [{ json: { channel: "#support", level: h.urgency === "high" ? "critical" : "warn", text: "Ticket #" + h.ticket_id + " (" + h.topic + ") needs a person: " + h.reasons.join("; ") + "." } }];`),
      call("Tell the support team", "notify"),

      /* ---- 6. SLA watch ---- */
      schedule("Every 10 minutes", { minutes: 10 }),
      zendesk.search("Open, unanswered tickets", "'status:open tags:needs-human'"),
      code("Measure against the SLA", `const SLA = { urgent: 30, high: 120, normal: 480, low: 1440 }; // minutes
const now = Date.now();
return $input.all().map((i) => i.json).filter((t) => t.id && t.created_at).map((t) => {
  const limit = SLA[t.priority] ?? SLA.normal;
  const waited = Math.floor((now - new Date(t.created_at).getTime()) / 60000);
  const stage = waited >= limit ? "breached" : waited >= limit * 0.75 ? "at_risk" : "ok";
  const last = (t.tags ?? []).includes("sla-breached") ? "breached" : (t.tags ?? []).includes("sla-at-risk") ? "at_risk" : "ok";
  return { id: String(t.id), subject: t.subject, waited, limit, stage, last };
}).filter((t) => t.stage !== "ok" && t.stage !== t.last).map((json) => ({ json }));`),
      zendesk.update("Mark the stage", "$json.id", { tags: ["={{ $json.stage === 'breached' ? 'sla-breached' : 'sla-at-risk' }}"] }, { onFail: "continue" }),
      code("SLA message", `const before = $("Measure against the SLA").all();
return $input.all().map((_, i) => { const t = before[i].json; return { json: { channel: "#support", level: t.stage === "breached" ? "critical" : "warn", text: t.stage === "breached" ? "Response time missed on #" + t.id + ": waited " + t.waited + " min (limit " + t.limit + ")." : "Response time at risk on #" + t.id + ": " + (t.limit - t.waited) + " min left." } }; });`),
      call("Raise the SLA", "notify"),

      /* ---- 7. Nightly audit ---- */
      schedule("02:00 nightly", "0 2 * * *"),
      db.find("Yesterday's answers", "support_log", { answered: "'true'", at: ["gte", "$now.minus({ days: 1 }).toISO()"] }),
      code("Take a sample", `// Every answer that moved money, plus up to eight of the rest.
const rows = $input.all().map((i) => i.json).filter((r) => r.ticket_id && r.reply);
const refunded = rows.filter((r) => r.refunded);
const rest = rows.filter((r) => !r.refunded).sort((a, b) => String(a.ticket_id).localeCompare(String(b.ticket_id))).slice(0, 8);
return [...refunded, ...rest].map((json) => ({ json }));`),
      agent("Auditor agent", {
        system: "You are the Auditor agent. Grade a support reply that has already been sent, from 1 to 5: was it correct for the question, complete, and honest about what it did not know? Name the single most important thing to fix, or 'nothing'.",
        prompt: "JSON.stringify({ question: $json.question, reply: $json.reply, topic: $json.topic })",
        structured: true,
      }, { onFail: "continue" }),
      claude("Claude · auditing", "Auditor agent"),
      shape("Grade", "Auditor agent", { grade: 4, fix: "nothing" }),
      code("Gather the grades", `const sample = $("Take a sample").all().map((i) => i.json);
const graded = $input.all().map((item, i) => ({ ticket_id: sample[i]?.ticket_id, topic: sample[i]?.topic, grade: Number(item.json.output?.grade), fix: item.json.output?.fix ?? null })).filter((g) => g.ticket_id && g.grade >= 1 && g.grade <= 5);
const poor = graded.filter((g) => g.grade <= 2);
const average = graded.length ? Math.round((graded.reduce((s, g) => s + g.grade, 0) / graded.length) * 10) / 10 : null;
return [{ json: { audited: graded.length, average, poor, text: graded.length ? "Audited " + graded.length + " answers from yesterday, average " + average + "/5." + (poor.length ? " Poor: " + poor.map((p) => "#" + p.ticket_id + " (" + p.fix + ")").join("; ") : " None graded 2 or under.") : "No answers to audit yesterday." } }];`),
      db.insert("Save the audit", "support_audits", { audited: "$json.audited", average: "$json.average", poor: "$json.poor", at: "$now.toISO()" }),
      slack.post("Post the audit", "'#support'", "':mag: ' + $('Gather the grades').first().json.text"),

      /* ---- 8. Weekly gaps ---- */
      schedule("Monday 08:00", "0 8 * * 1"),
      db.find("Handed over last week", "support_log", { answered: "'false'", at: ["gte", "$now.minus({ days: 7 }).toISO()"] }),
      code("Gather the questions", `const rows = $input.all().map((i) => i.json).filter((r) => r.question);
return [{ json: { count: rows.length, questions: rows.slice(0, 80).map((r) => "- [" + r.topic + "] " + String(r.question).slice(0, 160) + " (" + (r.reasons ?? []).join(", ") + ")").join("\\n") } }];`),
      iff("Any gaps?", "$json.count > 0"),
      agent("Gaps agent", {
        system: "You are the Gaps agent. Group these tickets the agents could not answer into at most five themes. For each, give the theme, how many tickets, and the one change that would let an agent answer next time: a help article to write, a tool to add, or a policy to clarify. Plain text, no preamble.",
        prompt: "$json.questions",
      }, { onFail: "continue" }),
      claude("Claude · gaps", "Gaps agent"),
      slack.post("Post the gaps", "'#support'", "':books: ' + $('Gather the questions').first().json.count + ' tickets went to a person last week.\\n' + ($json.output ?? $('Gather the questions').first().json.questions)"),
      slack.post("Post all clear", "'#support'", "':white_check_mark: The agents answered every ticket they were given last week.'"),

      /* ---- 9. After the answer ---- */
      triggers.typeform("Survey answered", "csat-form"),
      code("Read the survey", `return $input.all().map((item) => {
  const s = item.json;
  const score = Number(s.score ?? s["How did we do?"]);
  if (!Number.isInteger(score) || score < 1 || score > 5) throw new Error("Score must be 1 to 5");
  return { json: { ticket_id: String(s.ticket_id ?? ""), email: String(s.email ?? "").toLowerCase(), score, comment: String(s.comment ?? "").slice(0, 1000) } };
});`),
      db.insert("Record the score", "csat", { ticket_id: "$json.ticket_id", email: "$json.email", score: "$json.score", comment: "$json.comment", at: "$now.toISO()" }),
      iff("Unhappy?", "$('Read the survey').first().json.score <= 2"),
      agent("Recovery agent", {
        system: "You are the Recovery agent. A customer rated their support 1 or 2 out of 5. Draft a short, personal note a human support lead could send: acknowledge what went wrong in their words, do not make excuses, do not offer compensation, and ask one question that would help put it right. Under 90 words. This is a draft for a person, never sent by you.",
        prompt: "'Score: ' + $('Read the survey').first().json.score + '/5\\nComment: ' + ($('Read the survey').first().json.comment || '(none)')",
      }, { onFail: "continue" }),
      claude("Claude · recovery", "Recovery agent"),
      zendesk.create("Open a follow-up", { subject: "'Unhappy after ticket #' + $('Read the survey').first().json.ticket_id", body: "'Rated ' + $('Read the survey').first().json.score + '/5. ' + $('Read the survey').first().json.comment + '\\n\\nDraft reply for you to edit:\\n' + ($json.output ?? '(no draft: the agent was unavailable)')", tags: ["csat-recovery"] }),
      code("Unhappy message", `const s = $("Read the survey").first().json;
return [{ json: { channel: "#support", level: "warn", text: s.email + " rated ticket #" + s.ticket_id + " " + s.score + "/5" + (s.comment ? ": \\"" + s.comment.slice(0, 200) + "\\"" : "") + ". A follow-up ticket is open with a draft reply." } }];`),
      call("Tell the support lead", "notify"),
      noop("Recorded"),
    ],
    flow: [
      ["New ticket", "Read the ticket", "Seen this ticket?", "New ticket?", "Triage agent", "Apply the triage rules", "Tag the ticket", "Straight to a person?", "Skip the agents", "Write the handover"],
      ["New ticket?:1", "Already handled"],
      ["Straight to a person?:1", "Which specialist?"],
      ["Which specialist?:0", "To the orders agent", "Orders agent", "Collect the answer"],
      ["Which specialist?:1", "To the billing agent", "Billing agent", "Collect the answer"],
      ["Which specialist?:2", "To the technical agent", "Technical agent", "Collect the answer"],
      ["Which specialist?:3", "To the general agent", "General agent", "Collect the answer"],
      ["Collect the answer", "Refund asked for?", "Past refunds", "Apply the refund policy", "Inside the policy?", "Refund in Stripe", "Record the refund", "Add the refund to the reply", "Judge agent"],
      ["Refund asked for?:1", "Judge agent"],
      ["Inside the policy?:1", "Refund needs a person", "Write the handover"],
      ["Refund in Stripe:1", "Refund needs a person"],
      ["Judge agent", "Decide: send or hand over", "Fit to send?", "Send the reply", "Log: answered"],
      ["Fit to send?:1", "Write the handover", "Assign to the team", "Log: handed over", "Handover message", "Tell the support team"],

      ["Every 10 minutes", "Open, unanswered tickets", "Measure against the SLA", "Mark the stage", "SLA message", "Raise the SLA"],
      ["02:00 nightly", "Yesterday's answers", "Take a sample", "Auditor agent", "Gather the grades", "Save the audit", "Post the audit"],
      ["Monday 08:00", "Handed over last week", "Gather the questions", "Any gaps?", "Gaps agent", "Post the gaps"],
      ["Any gaps?:1", "Post all clear"],
      ["Survey answered", "Read the survey", "Record the score", "Unhappy?", "Recovery agent", "Open a follow-up", "Unhappy message", "Tell the support lead"],
      ["Unhappy?:1", "Recorded"],
    ],
    sections: [
      { title: "Intake and triage", note: "Zendesk in. One agent reads the ticket; code decides what always goes to a person.", nodes: ["New ticket", "Read the ticket", "Seen this ticket?", "New ticket?", "Already handled", "Triage agent", "Apply the triage rules", "Tag the ticket", "Straight to a person?", "Skip the agents", "Which specialist?", "To the orders agent", "To the billing agent", "To the technical agent", "To the general agent"] },
      { title: "Specialists, each with its own tools", note: "Orders reads Shopify, billing reads Stripe, technical and general search the knowledge base in Pinecone.", nodes: ["Orders agent", "Billing agent", "Technical agent", "General agent", "Collect the answer"] },
      { title: "Refund policy, in code", note: "An agent can ask for a refund. Only this section can make one.", nodes: ["Refund asked for?", "Past refunds", "Apply the refund policy", "Inside the policy?", "Refund in Stripe", "Record the refund", "Add the refund to the reply", "Refund needs a person"] },
      { title: "The judge, then send or hand over", note: "A different model checks the answer against the facts. Code makes the final call.", nodes: ["Judge agent", "Decide: send or hand over", "Fit to send?", "Send the reply", "Log: answered", "Write the handover", "Assign to the team", "Log: handed over", "Handover message", "Tell the support team"] },
      { title: "Response-time watch", nodes: ["Every 10 minutes", "Open, unanswered tickets", "Measure against the SLA", "Mark the stage", "SLA message", "Raise the SLA"] },
      { title: "Nightly audit of what was sent", nodes: ["02:00 nightly", "Yesterday's answers", "Take a sample", "Auditor agent", "Gather the grades", "Save the audit", "Post the audit"] },
      { title: "Weekly gaps", nodes: ["Monday 08:00", "Handed over last week", "Gather the questions", "Any gaps?", "Gaps agent", "Post the gaps", "Post all clear"] },
      { title: "After the answer: unhappy customers", nodes: ["Survey answered", "Read the survey", "Record the score", "Unhappy?", "Recovery agent", "Open a follow-up", "Unhappy message", "Tell the support lead", "Recorded"] },
    ],
    story: [
      { title: "A ticket is opened", copy: "Zendesk sends it in. A ticket seen before is not answered twice.", nodes: ["New ticket", "Read the ticket", "Seen this ticket?", "New ticket?", "Already handled"] },
      { title: "A triage agent reads it", copy: "Topic, urgency, sentiment and language. It is told not to answer.", nodes: ["Triage agent", "GPT · triage", "Triage"] },
      { title: "Some tickets always get a person", copy: "Legal language, an angry customer, an enterprise account or another language: code sends these straight to the team, whatever the model thought.", nodes: ["Apply the triage rules", "Tag the ticket", "Straight to a person?", "Skip the agents"] },
      { title: "The rest go to a specialist", copy: "Four agents, each with only the tools its job needs.", nodes: ["Which specialist?", "To the orders agent", "To the billing agent", "To the technical agent", "To the general agent"] },
      { title: "Orders: it looks the order up", copy: "The agent reads the order and the customer's history from Shopify and Supabase before it writes a word.", nodes: ["Orders agent", "Claude · orders", "Orders answer", "Order lookup", "Order history"] },
      { title: "Billing: it reads the charge", copy: "It can look at Stripe. It cannot refund: it can only say a refund was asked for.", nodes: ["Billing agent", "Claude · billing", "Billing answer", "Charge lookup", "Customer lookup", "Days since"] },
      { title: "Technical and general: from the documents", copy: "Both search the knowledge base in Pinecone and must name the articles they used.", nodes: ["Technical agent", "Claude · technical", "Technical answer", "Help centre", "Embeddings · help centre", "Work it through", "General agent", "Claude · general", "General answer", "Policies and guides", "Embeddings · policies", "Collect the answer"] },
      { title: "A refund is decided by a written policy", copy: "Under 100, not a third refund, not already refunded. Inside the policy, Stripe refunds it with an idempotency key. Outside, a person decides.", nodes: ["Refund asked for?", "Past refunds", "Apply the refund policy", "Inside the policy?", "Refund in Stripe", "Record the refund", "Add the refund to the reply", "Refund needs a person"] },
      { title: "A judge checks the answer", copy: "A different model, which did not write the reply, checks every statement against the facts the specialist gathered.", nodes: ["Judge agent", "GPT · judging", "Verdict"] },
      { title: "Code makes the final call", copy: "Low confidence, a rejected verdict, a promise, a card number or a judge that could not be reached all mean the same thing: do not send.", nodes: ["Decide: send or hand over", "Fit to send?"] },
      { title: "Sent, and logged", copy: "The reply goes out through Zendesk and the answer is recorded for the nightly audit.", nodes: ["Send the reply", "Log: answered"] },
      { title: "Or handed over with everything attached", copy: "The team gets the reasons, the facts found and the unsent draft as a private note, so nobody starts from zero.", nodes: ["Write the handover", "Assign to the team", "Log: handed over", "Handover message", "Tell the support team"] },
      { title: "Tickets waiting on people are watched", copy: "Every ten minutes, anything near or past its response time is raised once per stage.", nodes: ["Every 10 minutes", "Open, unanswered tickets", "Measure against the SLA", "Mark the stage", "SLA message", "Raise the SLA"] },
      { title: "Every night, the agents are audited", copy: "Every answer that moved money and a sample of the rest are graded by a separate agent. Poor grades are named in Slack.", nodes: ["02:00 nightly", "Yesterday's answers", "Take a sample", "Auditor agent", "Claude · auditing", "Grade", "Gather the grades", "Save the audit", "Post the audit"] },
      { title: "Every Monday, the gaps become a to-do list", copy: "What the agents could not answer is grouped into themes, each with the article, tool or policy that would fix it.", nodes: ["Monday 08:00", "Handed over last week", "Gather the questions", "Any gaps?", "Gaps agent", "Claude · gaps", "Post the gaps", "Post all clear"] },
      { title: "An unhappy customer gets a person", copy: "A low survey score opens a follow-up with a draft note. The agent writes the draft; a person decides what is sent.", nodes: ["Survey answered", "Read the survey", "Record the score", "Unhappy?", "Recovery agent", "Claude · recovery", "Open a follow-up", "Unhappy message", "Tell the support lead", "Recorded"] },
    ],
    tests: [
      {
        name: "an order question is looked up in Shopify, judged and answered",
        entry: "New ticket",
        input: [{ id: 55, requester_email: "Ana@Shop.co", subject: "Where is order 1001?", description: "It has been a week. Order 1001." }],
        llm: [TRIAGE("orders"), { system: "Orders agent", last: "Subject:", tool: { name: "Order lookup", input: { order_id: "1001" } } }, { system: "Orders agent", final: ANSWER }, PASS],
        ran: ["Send the reply", "Log: answered"], notRan: ["Write the handover", "Billing agent"],
        calls: [{ to: "shopify", path: "/admin/api/*" }, { to: "zendesk", method: "PUT", path: "/api/v2/tickets/55.json", body: { ticket: { status: "pending" } } }],
        table: { support_log: [{ ticket_id: "55", answered: true, topic: "orders" }] },
      },
      {
        name: "legal language goes straight to a person and no specialist is asked",
        entry: "New ticket",
        input: [{ id: 56, requester_email: "a@b.co", subject: "Refund now", description: "If this is not fixed today I will start a chargeback and call my lawyer." }],
        llm: [TRIAGE("billing")],
        ran: ["Skip the agents", "Tell the support team"], notRan: ["Which specialist?", "Judge agent"], noCalls: ["anthropic", "stripe"],
        table: { support_log: [{ ticket_id: "56", answered: false }] },
      },
      {
        name: "a small refund inside the policy is made in Stripe and added to the reply",
        entry: "New ticket",
        input: [{ id: 57, requester_email: "a@b.co", subject: "Charged twice", description: "I was charged twice, charge ch_1 for 40. Please refund one." }],
        llm: [TRIAGE("billing"), { system: "Billing agent", last: "Subject:", tool: { name: "Charge lookup", input: { charge_id: "ch_1" } } }, { system: "Billing agent", final: { ...ANSWER, reply: "I can see the duplicate charge. The Acme support team", refund: { charge: "ch_1", amount: 40 } } }, PASS],
        ran: ["Refund in Stripe", "Send the reply"],
        calls: [{ to: "stripe", path: "/v1/refunds", body: { charge: "ch_1", amount: 4000 } }],
        table: { refunds: [{ charge: "ch_1", amount: 40 }], support_log: [{ ticket_id: "57", refunded: true }] },
      },
      {
        name: "a refund over the limit is never made by the agents",
        entry: "New ticket",
        input: [{ id: 58, requester_email: "a@b.co", subject: "Refund my order", description: "Please refund charge ch_9, 450." }],
        llm: [TRIAGE("billing"), { system: "Billing agent", final: { ...ANSWER, refund: { charge: "ch_9", amount: 450 } } }, PASS],
        ran: ["Refund needs a person", "Assign to the team"], notRan: ["Refund in Stripe", "Send the reply"], callCount: { "stripe /v1/refunds": 0 },
      },
      {
        name: "an answer the judge rejects is handed over with the unsent draft",
        entry: "New ticket",
        input: [{ id: 59, requester_email: "a@b.co", subject: "Login broken", description: "I cannot log in since this morning." }],
        seed: { kb: [{ id: "kb-1", title: "Resetting a password", text: "Use the reset link on the sign-in page." }] },
        llm: [TRIAGE("technical"), { system: "Technical agent", final: ANSWER }, { system: "Judge agent", final: { pass: false, issues: ["Claims the outage is fixed; no fact supports it"] } }],
        ran: ["Assign to the team"], notRan: ["Send the reply"],
        calls: [{ to: "zendesk", method: "PUT", path: "/api/v2/tickets/59.json", body: { ticket: { status: "open" } } }],
        table: { support_log: [{ ticket_id: "59", answered: false }] },
      },
      {
        name: "a promise is caught in code even when the judge passes it",
        entry: "New ticket",
        input: [{ id: 60, requester_email: "a@b.co", subject: "Late parcel", description: "Order 1002 is late." }],
        llm: [TRIAGE("orders"), { system: "Orders agent", final: { ...ANSWER, reply: "We guarantee it arrives tomorrow. The Acme support team" } }, PASS],
        ran: ["Assign to the team"], notRan: ["Send the reply"],
      },
      {
        name: "a technical question is answered from the knowledge base",
        entry: "New ticket",
        input: [{ id: 61, requester_email: "a@b.co", subject: "How do I reset my password?", description: "I forgot it." }],
        seed: { kb: [{ id: "kb-1", title: "Resetting a password", text: "Use the reset link on the sign-in page." }] },
        llm: [TRIAGE("technical"), { system: "Technical agent", last: "Subject:", tool: { name: "Help centre", input: { input: "reset password" } } }, { system: "Technical agent", final: ANSWER }, PASS],
        ran: ["Send the reply"], calls: [{ to: "pinecone", path: "/query" }, { to: "openai", path: "/v1/embeddings" }],
      },
      {
        name: "with the models down, the ticket still reaches a person",
        entry: "New ticket",
        fail: [{ path: "/v1/chat/completions", times: 20, status: 500 }, { path: "/v1/messages", times: 20, status: 529 }],
        input: [{ id: 62, requester_email: "a@b.co", subject: "Help", description: "Something is wrong with my order." }],
        ran: ["Tell the support team"], notRan: ["Send the reply"],
        table: { support_log: [{ ticket_id: "62", answered: false }] },
      },
      {
        name: "the same ticket delivered twice is answered once",
        entry: "New ticket", repeat: 2,
        input: [{ id: 63, requester_email: "a@b.co", subject: "Where is order 1003?", description: "Order 1003 please." }],
        llm: [TRIAGE("orders"), { system: "Orders agent", final: ANSWER }, PASS],
        ran: ["Already handled"], callCount: { "zendesk /api/v2/tickets/63.json": 2 },
      },
      {
        name: "the nightly audit grades every refunded answer and names the poor ones",
        entry: "02:00 nightly",
        seed: { support_log: [{ ticket_id: "70", answered: true, topic: "billing", question: "Charged twice", reply: "Refunded.", refunded: true, at: "2999-01-01T00:00:00Z" }, { ticket_id: "71", answered: true, topic: "orders", question: "Where is it?", reply: "On its way.", at: "2999-01-01T00:00:00Z" }] },
        llm: [{ system: "Auditor agent", last: "Charged twice", final: { grade: 2, fix: "Did not say when the money arrives" } }, { system: "Auditor agent", final: { grade: 5, fix: "nothing" } }],
        output: { node: "Gather the grades", json: { audited: 2, average: 3.5, poor: [{ ticket_id: "70", grade: 2 }] } },
        calls: [{ to: "slack", body: { channel: "#support" } }], table: { support_audits: [{ audited: 2 }] },
      },
      {
        name: "Monday's gaps are grouped and posted",
        entry: "Monday 08:00",
        seed: { support_log: [{ ticket_id: "80", answered: false, topic: "technical", question: "SSO setup", reasons: ["low confidence (0.3)"], at: "2999-01-01T00:00:00Z" }] },
        llm: [{ system: "Gaps agent", text: "1. Single sign-on (1 ticket): write an SSO setup article." }],
        ran: ["Post the gaps"], notRan: ["Post all clear"], output: { node: "Gather the questions", json: { count: 1 } },
      },
      { name: "a week with no handovers posts an all clear without a model call", entry: "Monday 08:00", ran: ["Post all clear"], noCalls: ["anthropic"] },
      {
        name: "an unhappy survey opens a follow-up with a draft for a person",
        entry: "Survey answered",
        input: [{ ticket_id: "55", email: "ana@shop.co", score: 1, comment: "Nobody told me it was delayed." }],
        llm: [{ system: "Recovery agent", text: "I am sorry nobody told you about the delay. What would have helped most?" }],
        ran: ["Open a follow-up", "Tell the support lead"],
        calls: [{ to: "zendesk", method: "POST", path: "/api/v2/tickets.json" }], table: { csat: [{ ticket_id: "55", score: 1 }] },
      },
      { name: "a happy survey is only recorded", entry: "Survey answered", input: [{ ticket_id: "55", email: "ana@shop.co", score: 5 }], ran: ["Recorded"], noCalls: ["anthropic", "zendesk"] },
    ],
  }),
];
