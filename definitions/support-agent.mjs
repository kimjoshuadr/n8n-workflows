/**
 * Support agent: answers what it can from the help centre, hands over what it
 * cannot, and reports on what it could not answer so the help centre improves.
 */
import { webhook, schedule, code, iff, route, noop, call, define } from "../lib/wf.mjs";
import { db, slack, zendesk, api, agent, ask, readAnswer } from "../lib/nodes.mjs";

const base = { folder: "systems/support-agent", tier: "flagship", system: "support-agent", category: "Support and AI agents" };

export default [
  define({
    ...base,
    id: "support-answer",
    name: "Support agent · Answer or hand over",
    summary: "Answers a customer's message from the help centre when it is confident, and hands the conversation to a person with a summary when it is not.",
    nodes: [
      webhook("Message received", "support-message", { respond: "immediately" }),
      code(
        "Read the message",
        `const b = $input.first().json.body ?? {};
if (b.message_type && b.message_type !== "incoming") return []; // our own replies come back as events too
const text = String(b.content ?? "").trim();
if (!text) return [];
return [{ json: {
  conversation_id: String(b.conversation?.id ?? b.conversation_id),
  message_id: String(b.id),
  text: text.slice(0, 3000),
  customer: b.sender?.name ?? "Customer",
  scope: "support-message", key: String(b.id),
} }];`,
      ),
      call("Seen before?", "idempotency-guard"),
      iff("New message?", "!$json.duplicate"),
      api("zendesk", "zendeskApi", "Search the help centre", "GET", "'https://acme.zendesk.com/api/v2/help_center/articles/search.json'", { query: { query: "$json.text.slice(0, 200)" }, onFail: "continue" }),
      code(
        "Build the context",
        `const m = $("New message?").first().json;
const articles = ($input.first().json.results ?? []).slice(0, 4);
const context = articles.map((a) => "[" + a.id + "] " + a.title + "\\n" + String(a.body ?? "").slice(0, 800)).join("\\n\\n");
return [{ json: { ...m, context, article_count: articles.length } }];`,
      ),
      ...ask("Draft an answer", { task: "support-answer", system: "You are a support agent. Answer ONLY from the articles given. Reply with JSON: { answer: string, confidence: 0-1, sources: string[], handover: boolean }. Set handover true if the articles do not cover it, or the customer is upset, asks for a person, or mentions a refund dispute or legal action.", prompt: "'Articles:\\n' + ($json.context || '(none found)') + '\\n\\nCustomer: ' + $json.text", example: { answer: "The answer.", confidence: 0.9, sources: ["kb-12"], handover: false } }),
      readAnswer("Read the draft", { from: "Build the context", fallback: { answer: "", confidence: 0, sources: [], handover: true } }),
      iff("Confident?", "!$json.handover && !$json.parse_error && $json.confidence >= 0.7 && $json.answer.length > 0"),
      zendesk.update("Send the reply", "$json.conversation_id", { status: "'pending'", publicReply: "$json.answer", tags: ["ai-answered"] }),
      zendesk.update("Hand to a person", "$json.conversation_id", { status: "'open'", tags: ["needs-human"] }),
      zendesk.update("Leave a private note", "$('Confident?').first().json.conversation_id", { internalNote: "'Handed over by the agent. Customer asked: ' + $('Confident?').first().json.text.slice(0, 300) + ' | Confidence: ' + $('Confident?').first().json.confidence + ' | Articles found: ' + $('Confident?').first().json.article_count" }),
      code("Answered", `return [{ json: { ...$("Confident?").first().json, answered: true } }];`),
      code("Handed over", `return [{ json: { ...$("Confident?").first().json, answered: false } }];`),
      db.insert("Log the outcome", "support_log", { conversation_id: "$json.conversation_id", question: "$json.text", answered: "$json.answered", confidence: "$json.confidence", sources: "$json.sources", at: "$now.toISO()" }),
      noop("Ignore the repeat"),
    ],
    flow: [
      ["Message received", "Read the message", "Seen before?", "New message?", "Search the help centre", "Build the context", "Draft an answer", "Read the draft", "Confident?", "Send the reply", "Answered", "Log the outcome"],
      ["New message?:1", "Ignore the repeat"],
      ["Confident?:1", "Hand to a person", "Leave a private note", "Handed over", "Log the outcome"],
    ],
    story: [
      { title: "A customer writes in", copy: "Zendesk sends every message here. The agent's own replies and repeats are dropped.", nodes: ["Message received", "Read the message", "Seen before?", "New message?", "Ignore the repeat"] },
      { title: "It looks things up first", copy: "The Zendesk help centre is searched and the best four articles become the only thing the model may answer from.", nodes: ["Search the help centre", "Build the context"] },
      { title: "It drafts, with a confidence", copy: "The model returns an answer, its sources and whether a person should take over.", nodes: ["Draft an answer", "Read the draft", "Confident?"] },
      { title: "Confident: it replies", copy: "Above the threshold, the answer goes to the customer.", nodes: ["Send the reply", "Answered"] },
      { title: "Not confident: a person takes over", copy: "The conversation is assigned with a private note, so nobody has to ask the customer to repeat themselves.", nodes: ["Hand to a person", "Leave a private note", "Handed over"] },
      { title: "Every outcome is logged", copy: "Answered or handed over, it is recorded. That log is what the weekly gap report reads.", nodes: ["Log the outcome"] },
    ],
    tests: [
      { name: "answers a covered question", routes: [{ path: "acme.zendesk.com/api/v2/help_center/articles/search.json", response: { results: [{ id: "kb-12", title: "Refunds", body: "Refunds take 5 days." }] } }], request: { body: { id: 501, message_type: "incoming", content: "How long does a refund take?", conversation: { id: 9 } } }, ran: ["Send the reply"], notRan: ["Hand to a person"], calls: [{ to: "zendesk", method: "PUT", path: "/api/v2/tickets/9.json", body: { ticket: { status: "pending" } } }, { to: "supabase", path: "/rest/v1/support_log", body: { answered: true } }] },
      { name: "hands over what the help centre does not cover", request: { body: { id: 502, message_type: "incoming", content: "Can you integrate with my custom ERP?", conversation: { id: 10 } } }, ran: ["Hand to a person", "Leave a private note"], notRan: ["Send the reply"], calls: [{ to: "supabase", path: "/rest/v1/support_log", body: { answered: false } }] },
      { name: "hands over an upset customer even when the answer is known", request: { body: { id: 503, message_type: "incoming", content: "I want a refund or I call my lawyer", conversation: { id: 11 } } }, ran: ["Hand to a person"], notRan: ["Send the reply"] },
      { name: "hands over when the model is unavailable", fail: [{ path: "/v1/chat/completions", times: 20 }, { path: "/v1/messages", times: 20 }], request: { body: { id: 504, message_type: "incoming", content: "How long does a refund take?", conversation: { id: 12 } } }, ran: ["Hand to a person"], notRan: ["Send the reply"] },
      { name: "ignores its own outgoing replies", request: { body: { id: 505, message_type: "outgoing", content: "Here you go", conversation: { id: 9 } } }, notRan: ["Seen before?"], noCalls: ["openai", "anthropic"] },
    ],
  }),

  define({
    ...base,
    id: "support-triage",
    name: "Support agent · Ticket triage",
    summary: "Labels each new ticket by topic and urgency, routes it to the right team, and pages someone only when it is urgent.",
    nodes: [
      webhook("Ticket created", "support-ticket", { respond: "immediately" }),
      code("Read the ticket", `const b = $input.first().json.body ?? {};
return [{ json: { ticket_id: String(b.id), subject: String(b.subject ?? ""), body: String(b.body ?? "").slice(0, 3000), from: b.from ?? null } }];`),
      ...ask("Classify", { task: "classify", system: "Classify a support ticket. Reply with JSON: { label: 'billing'|'technical'|'spam'|'general', urgent: boolean, sentiment: 'negative'|'neutral'|'positive' }.", prompt: "$json.subject + '\\n\\n' + $json.body", example: { label: "billing", urgent: false, sentiment: "neutral" } }),
      readAnswer("Read the labels", { from: "Read the ticket", fallback: { label: "general", urgent: false, sentiment: "neutral" } }),
      route("By topic", { spam: "$json.label === 'spam'", billing: "$json.label === 'billing'", technical: "$json.label === 'technical'" }),
      zendesk.update("Close as spam", "$json.ticket_id", { status: "'closed'", tags: ["spam"] }),
      zendesk.update("Send to billing", "$json.ticket_id", { tags: ["billing"], internalNote: "'Routed to billing. Sentiment: ' + $json.sentiment" }),
      zendesk.update("Send to engineering", "$json.ticket_id", { tags: ["technical"], internalNote: "'Routed to engineering. Sentiment: ' + $json.sentiment" }),
      zendesk.update("Send to general queue", "$json.ticket_id", { tags: ["={{ $json.parse_error ? 'needs-review' : 'general' }}"], internalNote: "'Routed to the general queue. Sentiment: ' + $json.sentiment" }),
      iff("Urgent?", "$('Read the labels').first().json.urgent === true"),
      code("Page message", `const t = $("Read the labels").first().json;
return [{ json: { text: "Urgent " + t.label + " ticket #" + t.ticket_id + ": " + t.subject, level: "critical" } }];`),
      call("Page on-call", "notify"),
    ],
    flow: [
      ["Ticket created", "Read the ticket", "Classify", "Read the labels", "By topic"],
      ["By topic:0", "Close as spam"],
      ["By topic:1", "Send to billing", "Urgent?"],
      ["By topic:2", "Send to engineering", "Urgent?"],
      ["By topic:3", "Send to general queue", "Urgent?"],
      ["Urgent?", "Page message", "Page on-call"],
    ],
    story: [
      { title: "A ticket is opened", copy: "Subject and body are read. Nothing else about the customer is sent to the model.", nodes: ["Ticket created", "Read the ticket"] },
      { title: "A model labels it", copy: "Topic, urgency and sentiment. If the reply cannot be read, the ticket goes to the general queue marked for review.", nodes: ["Classify", "Read the labels"] },
      { title: "It lands with the right team", copy: "Spam is closed. Billing, engineering and general each get their own queue.", nodes: ["By topic", "Close as spam", "Send to billing", "Send to engineering", "Send to general queue"] },
      { title: "Only urgent tickets page someone", copy: "Everything else waits its turn in the queue.", nodes: ["Urgent?", "Page message", "Page on-call"] },
    ],
    tests: [
      { name: "a billing ticket goes to billing without paging", request: { body: { id: 1, subject: "Wrong charge", body: "My invoice shows a payment I did not make." } }, ran: ["Send to billing"], notRan: ["Page on-call", "Send to engineering"], calls: [{ to: "zendesk", method: "PUT", path: "/api/v2/tickets/1.json", body: { ticket: { tags: ["billing"] } } }] },
      { name: "an urgent outage pages on-call", request: { body: { id: 2, subject: "Site is down", body: "Error on every page, urgent, we are losing orders." } }, ran: ["Send to engineering", "Page on-call"], calls: [{ to: "slack", path: "/api/chat.postMessage" }] },
      { name: "spam is closed and nobody is paged", request: { body: { id: 3, subject: "You won", body: "Claim at http://scam.example urgent" } }, ran: ["Close as spam"], notRan: ["Urgent?"], calls: [{ to: "zendesk", method: "PUT", path: "/api/v2/tickets/3.json", body: { ticket: { status: "closed" } } }] },
      { name: "an unreadable model reply falls back to the general queue for review", llm: [{ text: "not json" }], request: { body: { id: 4, subject: "Hi", body: "Question" } }, calls: [{ to: "zendesk", method: "PUT", path: "/api/v2/tickets/4.json", body: { ticket: { tags: ["needs-review"] } } }] },
    ],
  }),

  define({
    ...base,
    id: "support-gap-report",
    name: "Support agent · Weekly gap report",
    summary: "Every Monday, reads what the agent could not answer last week and tells the team which help articles are missing.",
    nodes: [
      schedule("Monday 08:00", "0 8 * * 1"),
      db.find("Unanswered last week", "support_log", { answered: "'false'", at: ["gte", "$now.minus({ days: 7 }).toISO()"] }),
      code("Gather the questions", `const qs = $input.all().map((i) => i.json.question).filter(Boolean);
return [{ json: { count: qs.length, questions: qs.slice(0, 80).map((q) => "- " + String(q).slice(0, 200)).join("\\n") } }];`),
      iff("Any gaps?", "$json.count > 0"),
      ...ask("Group into topics", { task: "summarise", system: "Group these unanswered support questions into at most five topics. For each, give the topic, how many questions, and the help article that would have answered them. Plain text.", prompt: "$json.questions" }),
      slack.post("Post the report", "'#support'", "':books: ' + $('Gather the questions').first().json.count + ' questions went to a person last week.\\n' + $json.output"),
      slack.post("Post all clear", "'#support'", "':white_check_mark: The agent answered everything it was asked last week.'"),
    ],
    flow: [
      ["Monday 08:00", "Unanswered last week", "Gather the questions", "Any gaps?", "Group into topics", "Post the report"],
      ["Any gaps?:1", "Post all clear"],
    ],
    story: [
      { title: "Monday morning", copy: "It reads last week's log for conversations that went to a person.", nodes: ["Monday 08:00", "Unanswered last week", "Gather the questions", "Any gaps?"] },
      { title: "Questions become topics", copy: "A model groups them and names the article that is missing for each.", nodes: ["Group into topics"] },
      { title: "The team gets a to-do list", copy: "The report lands in the support channel. A clean week gets a short all-clear.", nodes: ["Post the report", "Post all clear"] },
    ],
    tests: [
      { name: "reports the gaps", seed: { support_log: [{ answered: false, question: "ERP integration?", at: "2999-01-01T00:00:00Z" }, { answered: true, question: "Refund?", at: "2999-01-01T00:00:00Z" }] }, input: [{}], ran: ["Post the report"], calls: [{ to: "slack", path: "/api/chat.postMessage", body: { channel: "#support" } }], output: { node: "Gather the questions", json: { count: 1 } } },
      { name: "says all clear when nothing was handed over", input: [{}], ran: ["Post all clear"], noCalls: ["openai", "anthropic"] },
    ],
  }),
];
