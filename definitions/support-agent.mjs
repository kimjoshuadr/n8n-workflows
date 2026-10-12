/**
 * Support agent: answers what it can from the help centre, hands over what it
 * cannot, and reports on what it could not answer so the help centre improves.
 */
import { define, webhook, schedule, http, llm, parseLlm, code, iff, route, call, noop } from "../lib/wf.mjs";

const base = { folder: "systems/support-agent", tier: "flagship", system: "support-agent", category: "Support and AI agents" };

export default [
  define({
    ...base,
    id: "support-answer",
    name: "Support agent · Answer or hand over",
    summary: "Answers a customer's message from the help centre when it is confident, and hands the conversation to a person with a summary when it is not.",
    integrations: ["Webhook", "Helpdesk", "LLM", "Datastore", "Chat"],
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
      http("Search the help centre", "HELPDESK:/help_center/search", { method: "GET", query: { query: "$json.text.slice(0, 200)" }, onFail: "continue" }),
      code(
        "Build the context",
        `const m = $("New message?").first().json;
const articles = ($input.first().json.articles ?? []).slice(0, 4);
const context = articles.map((a) => "[" + a.id + "] " + a.title + "\\n" + String(a.body ?? "").slice(0, 800)).join("\\n\\n");
return [{ json: { ...m, context, article_count: articles.length } }];`,
      ),
      llm("Draft an answer", {
        task: "support-answer",
        system: "You are a support agent. Answer ONLY from the articles given. Reply with JSON: { answer: string, confidence: 0-1, sources: string[], handover: boolean }. Set handover true if the articles do not cover it, or the customer is upset, asks for a person, or mentions a refund dispute or legal action.",
        user: "'Articles:\\n' + ($json.context || '(none found)') + '\\n\\nCustomer: ' + $json.text",
        onFail: "continue",
      }),
      parseLlm("Read the draft", { from: "Build the context", fallback: { answer: "", confidence: 0, sources: [], handover: true } }),
      iff("Confident?", "!$json.handover && !$json.parse_error && $json.confidence >= 0.7 && $json.answer.length > 0"),
      http("Send the reply", "HELPDESK:/conversations/reply", { body: "{ conversation_id: $json.conversation_id, content: $json.answer, message_type: 'outgoing' }" }),
      http("Hand to a person", "HELPDESK:/conversations/assign", { body: "{ conversation_id: $json.conversation_id, team: 'support', status: 'open' }" }),
      http("Leave a private note", "HELPDESK:/conversations/note", { body: "{ conversation_id: $('Confident?').first().json.conversation_id, private: true, content: 'Handed over by the agent. Customer asked: ' + $('Confident?').first().json.text.slice(0, 300) + ' | Confidence: ' + $('Confident?').first().json.confidence + ' | Articles found: ' + $('Confident?').first().json.article_count }" }),
      code("Answered", `return [{ json: { ...$("Confident?").first().json, answered: true } }];`),
      code("Handed over", `return [{ json: { ...$("Confident?").first().json, answered: false } }];`),
      http("Log the outcome", "DB:/support_log", { body: "{ conversation_id: $json.conversation_id, question: $json.text, answered: $json.answered, confidence: $json.confidence, sources: $json.sources, at: $now.toISO() }" }),
      noop("Ignore the repeat"),
    ],
    flow: [
      ["Message received", "Read the message", "Seen before?", "New message?", "Search the help centre", "Build the context", "Draft an answer", "Read the draft", "Confident?", "Send the reply", "Answered", "Log the outcome"],
      ["New message?:1", "Ignore the repeat"],
      ["Confident?:1", "Hand to a person", "Leave a private note", "Handed over", "Log the outcome"],
    ],
    story: [
      { title: "A customer writes in", copy: "The helpdesk sends every message here. The agent's own replies and repeats are dropped.", nodes: ["Message received", "Read the message", "Seen before?", "New message?", "Ignore the repeat"] },
      { title: "It looks things up first", copy: "The help centre is searched and the best four articles become the only thing the model may answer from.", nodes: ["Search the help centre", "Build the context"] },
      { title: "It drafts, with a confidence", copy: "The model returns an answer, its sources and whether a person should take over.", nodes: ["Draft an answer", "Read the draft", "Confident?"] },
      { title: "Confident: it replies", copy: "Above the threshold, the answer goes to the customer.", nodes: ["Send the reply", "Answered"] },
      { title: "Not confident: a person takes over", copy: "The conversation is assigned with a private note, so nobody has to ask the customer to repeat themselves.", nodes: ["Hand to a person", "Leave a private note", "Handed over"] },
      { title: "Every outcome is logged", copy: "Answered or handed over, it is recorded. That log is what the weekly gap report reads.", nodes: ["Log the outcome"] },
    ],
    tests: [
      { name: "answers a covered question", routes: [{ path: "/helpdesk/help_center/search", response: { articles: [{ id: "kb-12", title: "Refunds", body: "Refunds take 5 days." }] } }], request: { body: { id: 501, message_type: "incoming", content: "How long does a refund take?", conversation: { id: 9 } } }, ran: ["Send the reply"], notRan: ["Hand to a person"], calls: [{ path: "/helpdesk/conversations/reply", body: { conversation_id: "9" } }, { path: "/db/support_log", body: { answered: true } }] },
      { name: "hands over what the help centre does not cover", request: { body: { id: 502, message_type: "incoming", content: "Can you integrate with my custom ERP?", conversation: { id: 10 } } }, ran: ["Hand to a person", "Leave a private note"], notRan: ["Send the reply"], calls: [{ path: "/db/support_log", body: { answered: false } }] },
      { name: "hands over an upset customer even when the answer is known", request: { body: { id: 503, message_type: "incoming", content: "I want a refund or I call my lawyer", conversation: { id: 11 } } }, ran: ["Hand to a person"], notRan: ["Send the reply"] },
      { name: "hands over when the model is unavailable", fail: [{ path: "/llm", times: 3 }], request: { body: { id: 504, message_type: "incoming", content: "How long does a refund take?", conversation: { id: 12 } } }, ran: ["Hand to a person"], notRan: ["Send the reply"] },
      { name: "ignores its own outgoing replies", request: { body: { id: 505, message_type: "outgoing", content: "Here you go", conversation: { id: 9 } } }, notRan: ["Seen before?"], noCalls: ["/llm"] },
    ],
  }),

  define({
    ...base,
    id: "support-triage",
    name: "Support agent · Ticket triage",
    summary: "Labels each new ticket by topic and urgency, routes it to the right team, and pages someone only when it is urgent.",
    integrations: ["Webhook", "LLM", "Helpdesk", "Chat"],
    nodes: [
      webhook("Ticket created", "support-ticket", { respond: "immediately" }),
      code("Read the ticket", `const b = $input.first().json.body ?? {};
return [{ json: { ticket_id: String(b.id), subject: String(b.subject ?? ""), body: String(b.body ?? "").slice(0, 3000), from: b.from ?? null } }];`),
      llm("Classify", { task: "classify", system: "Classify a support ticket. Reply with JSON: { label: 'billing'|'technical'|'spam'|'general', urgent: boolean, sentiment: 'negative'|'neutral'|'positive' }.", user: "$json.subject + '\\n\\n' + $json.body", onFail: "continue" }),
      parseLlm("Read the labels", { from: "Read the ticket", fallback: { label: "general", urgent: false, sentiment: "neutral" } }),
      route("By topic", { spam: "$json.label === 'spam'", billing: "$json.label === 'billing'", technical: "$json.label === 'technical'" }),
      http("Close as spam", "HELPDESK:/tickets/update", { body: "{ ticket_id: $json.ticket_id, status: 'closed', labels: ['spam'] }" }),
      http("Send to billing", "HELPDESK:/tickets/update", { body: "{ ticket_id: $json.ticket_id, team: 'billing', labels: ['billing', $json.sentiment] }" }),
      http("Send to engineering", "HELPDESK:/tickets/update", { body: "{ ticket_id: $json.ticket_id, team: 'engineering', labels: ['technical', $json.sentiment] }" }),
      http("Send to general queue", "HELPDESK:/tickets/update", { body: "{ ticket_id: $json.ticket_id, team: 'support', labels: ['general', $json.sentiment], needs_review: $json.parse_error }" }),
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
      { name: "a billing ticket goes to billing without paging", request: { body: { id: 1, subject: "Wrong charge", body: "My invoice shows a payment I did not make." } }, ran: ["Send to billing"], notRan: ["Page on-call", "Send to engineering"], calls: [{ path: "/helpdesk/tickets/update", body: { team: "billing" } }] },
      { name: "an urgent outage pages on-call", request: { body: { id: 2, subject: "Site is down", body: "Error on every page, urgent, we are losing orders." } }, ran: ["Send to engineering", "Page on-call"], calls: [{ path: "/chat/chat.postMessage" }] },
      { name: "spam is closed and nobody is paged", request: { body: { id: 3, subject: "You won", body: "Claim at http://scam.example urgent" } }, ran: ["Close as spam"], notRan: ["Urgent?"], calls: [{ path: "/helpdesk/tickets/update", body: { status: "closed" } }] },
      { name: "an unreadable model reply falls back to the general queue for review", routes: [{ path: "/llm/chat/completions", response: { choices: [{ message: { content: "not json" } }] } }], request: { body: { id: 4, subject: "Hi", body: "Question" } }, calls: [{ path: "/helpdesk/tickets/update", body: { team: "support", needs_review: true } }] },
    ],
  }),

  define({
    ...base,
    id: "support-gap-report",
    name: "Support agent · Weekly gap report",
    summary: "Every Monday, reads what the agent could not answer last week and tells the team which help articles are missing.",
    integrations: ["Schedule", "Datastore", "LLM", "Chat"],
    nodes: [
      schedule("Monday 08:00", "0 8 * * 1"),
      http("Unanswered last week", "DB:/support_log", { method: "GET", query: { answered: "'eq.false'", at: "'gte.' + $now.minus({ days: 7 }).toISO()" }, alwaysOutput: true }),
      code("Gather the questions", `const qs = $input.all().map((i) => i.json.question).filter(Boolean);
return [{ json: { count: qs.length, questions: qs.slice(0, 80).map((q) => "- " + String(q).slice(0, 200)).join("\\n") } }];`),
      iff("Any gaps?", "$json.count > 0"),
      llm("Group into topics", { task: "summarise", json: false, system: "Group these unanswered support questions into at most five topics. For each, give the topic, how many questions, and the help article that would have answered them. Plain text.", user: "$json.questions" }),
      http("Post the report", "CHAT:/chat.postMessage", { body: "{ channel: '#support', text: ':books: ' + $('Gather the questions').first().json.count + ' questions went to a person last week.\\n' + $json.choices[0].message.content }" }),
      http("Post all clear", "CHAT:/chat.postMessage", { body: "{ channel: '#support', text: ':white_check_mark: The agent answered everything it was asked last week.' }" }),
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
      { name: "reports the gaps", seed: { support_log: [{ answered: false, question: "ERP integration?", at: "2999-01-01T00:00:00Z" }, { answered: true, question: "Refund?", at: "2999-01-01T00:00:00Z" }] }, input: [{}], ran: ["Post the report"], calls: [{ path: "/chat/chat.postMessage", body: { channel: "#support" } }], output: { node: "Gather the questions", json: { count: 1 } } },
      { name: "says all clear when nothing was handed over", input: [{}], ran: ["Post all clear"], noCalls: ["/llm"] },
    ],
  }),
];
