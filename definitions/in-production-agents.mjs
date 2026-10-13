/**
 * Built and run in production, rebuilt here for publication: one canvas that
 * answers inbound messages and runs outbound prospecting.
 *
 *   a message arrives   -> a router agent decides who handles it: a RAG agent
 *                          that answers from the knowledge base and the CRM, a
 *                          fallback agent, or a human escalation agent
 *   every weekday       -> a research agent finds companies that fit the ideal
 *                          customer profile, a lead gen agent finds the person,
 *                          and a cold outreach agent writes to them
 *
 * The two tracks and the six agents are the original's. Its canvas was too
 * small to read node by node, so the steps between the agents follow the
 * written description of the workflow. Prompts, rules, table names and the
 * choice of Gmail and Slack for sending and alerting were written for this
 * library.
 */
import { webhook, schedule, code, iff, route, set, respond, batches, define } from "../lib/wf.mjs";
import { db, hubspot, slack, gmail, agent, gptModel, shape, memory, embeddings, toolNode, toolSupabaseKnowledge, fromAI } from "../lib/nodes.mjs";

const msg = "$('normalise_message').first().json";
const icp = "$('get_icp').first().json";
const lead = "$('check_icp').first().json";

const fetchTool = (name, to) => toolNode(undefined, name, to, "Fetches a public web page and returns its HTML. Pass the full address.", "httpRequest", 4.2, { method: "GET", url: fromAI("url", "The full address of the page, starting https://"), options: { timeout: 15000 } });
const crmTool = (name, to) => toolNode("hubspot", name, to, "Searches HubSpot contacts by email, name or company and returns what the CRM knows about them.", "hubspot", 2.1, { authentication: "appToken", resource: "contact", operation: "search", returnAll: false, limit: 5, filterGroupsUi: {}, additionalFields: { query: fromAI("query", "An email address, a name or a company") } });

/* ---- test data ---- */
const inbound = (text, more = {}) => ({ body: { conversation_id: "conv-1", email: "ana@example.com", message: text, ...more } });
const ROUTE = (intent, confidence = 0.92) => ({ system: "Router Agent", final: { intent, confidence, reason: "Read from the message." } });
const ICP = { icp_profiles: [{ id: "icp-1", active: true, industry: "dental clinics", size: "5 to 50 staff", region: "Australia", role: "practice manager", offer: "online booking that fills cancelled slots" }] };
const RESEARCH = { system: "Research Agent", final: { companies: [{ name: "Bright Smile Dental", domain: "brightsmile.example", why: "Three clinics, no online booking." }] } };
const LEAD = (more = {}) => ({ system: "Lead Gen Agent", final: { name: "Dana Lee", role: "Practice manager", email: "dana@brightsmile.example", company: "Bright Smile Dental", score: 84, evidence: "Listed as practice manager on the team page.", ...more } });
const EMAIL = { system: "Cold Outreach Agent", final: { subject: "Filling cancelled slots at Bright Smile Dental", body: "Hi Dana, I saw Bright Smile Dental runs three clinics without online booking. We help practices fill cancelled slots the same day. Worth a short call next week?" } };
const SENT = "gmail /gmail/v1/users/me/messages/send";

export default [
  define({
    source: "production",
    id: "revenue-support-agents",
    folder: "production/revenue-support-agents",
    tier: "flagship",
    system: "revenue-support-agents",
    category: "AI agents",
    name: "AI agents · Revenue and support pipeline",
    summary: "Two tracks on one canvas. Inbound messages go to a router agent, which hands each one to a RAG agent that answers from the Supabase knowledge base and HubSpot, to a fallback agent, or to a human escalation agent that briefs a person. On weekdays, research and lead gen agents find people who fit the ideal customer profile, and a cold outreach agent writes to them and files them in the CRM.",
    nodes: [
      /* ---- 1. Inbound: route ---- */
      webhook("on_message_received", "inbound-message"),
      code("normalise_message", `const b = $input.first().json.body ?? {};
const text = String(b.message ?? b.text ?? "").trim();
if (!text) throw new Error("The message is empty");
return [{ json: { conversation_id: String(b.conversation_id ?? b.email ?? "anonymous"), email: String(b.email ?? "").trim().toLowerCase(), text: text.slice(0, 4000), channel: b.channel ?? "chat" } }];`),
      agent("Router Agent", {
        system: "You are the Router Agent for a company's inbox. Read the message and decide its intent: 'support' for a question about the product, an order, an account or how something works; 'sales' for someone asking about buying, pricing or a demo; 'human' for a complaint, a legal or billing dispute, or anyone asking for a person; 'other' for anything else. Give your confidence from 0 to 1. Do not answer the message.",
        prompt: `'From: ' + ($json.email || 'unknown') + '\\n\\n' + $json.text`,
        structured: true,
      }, { onFail: "continue" }),
      shape("router_parser", "Router Agent", { intent: "support", confidence: 0.9, reason: "One sentence." }),
      code("read_route", `const m = $("normalise_message").first().json;
const r = $input.first().json.output;
const ok = r && ["support", "sales", "human", "other"].includes(r.intent);
// What a person handles whatever the model made of it.
const must = /\\b(lawyer|legal action|sue|chargeback|refund|complaint|speak to (a|someone)|human|manager)\\b/i.test(m.text);
let to = "fallback";
if (must || (ok && r.intent === "human")) to = "human";
else if (ok && Number(r.confidence) >= 0.6 && (r.intent === "support" || r.intent === "sales")) to = "answer";
return [{ json: { ...m, intent: ok ? r.intent : "unknown", confidence: ok ? Number(r.confidence) : 0, route: to } }];`),
      route("switch_intent", { answer: "$json.route === 'answer'", human: "$json.route === 'human'" }),

      /* ---- 2. Inbound: answer ---- */
      agent("RAG Agent", {
        system: "You are the RAG Agent: you answer customers for the company. Search the knowledge base before you answer, and look the customer up in the CRM when the question depends on who they are. State only what a tool returned. If the tools do not hold the answer, reply with exactly: I do not know. Under 120 words, plain text.",
        prompt: `'Customer: ' + (${msg}.email || 'unknown') + '\\n\\n' + ${msg}.text`,
      }, { onFail: "continue" }),
      memory("conversation_memory", "RAG Agent", `${msg}.conversation_id`),
      toolSupabaseKnowledge("knowledge_base", "RAG Agent", "Searches the company's help centre and product documentation. Pass the customer's question in a few words."),
      embeddings("embeddings", "knowledge_base"),
      crmTool("crm_lookup", "RAG Agent"),
      code("read_answer", `const m = $("normalise_message").first().json;
const reply = String($input.first().json.output ?? "").trim();
const answered = reply.length > 0 && !/i do not know|i don't know|UNSCRIPTED/i.test(reply);
return [{ json: { ...m, reply, answered, handled_by: "rag" } }];`),
      iff("if_answered", "$json.answered"),
      agent("Fallback Agent", {
        system: "You are the Fallback Agent. The message could not be answered from the knowledge base, or its intent was unclear. Do not guess an answer. Ask the one question that would make it answerable, or say that the team will follow up by email. Under 60 words, plain text.",
        prompt: `${msg}.text`,
      }, { onFail: "continue" }),
      code("read_fallback", `const m = $("normalise_message").first().json;
const reply = String($input.first().json.output ?? "").trim();
const usable = reply.length > 0 && !/UNSCRIPTED/.test(reply);
return [{ json: { ...m, reply: usable ? reply : "Thanks for your message. A member of the team will reply by email shortly.", handled_by: "fallback" } }];`),

      /* ---- 3. Inbound: hand over ---- */
      agent("Human Escalation Agent", {
        system: "You are the Human Escalation Agent. This conversation is going to a person. Write a two-sentence summary of what the customer wants for the colleague who picks it up, say how urgent it is ('low', 'normal' or 'high'), and write a short holding reply that tells the customer a person will be in touch. Promise nothing else.",
        prompt: `'Customer: ' + (${msg}.email || 'unknown') + '\\n\\n' + ${msg}.text`,
        structured: true,
      }, { onFail: "continue" }),
      shape("escalation_parser", "Human Escalation Agent", { summary: "Two sentences.", urgency: "normal", holding_reply: "A person will be in touch." }),
      code("read_escalation", `const m = $("normalise_message").first().json;
const e = $input.first().json.output;
const ok = e && typeof e === "object" && e.summary;
return [{ json: { ...m, summary: ok ? String(e.summary) : m.text.slice(0, 300), urgency: ok && ["low", "normal", "high"].includes(e.urgency) ? e.urgency : "high", reply: ok && e.holding_reply ? String(e.holding_reply) : "Thanks for your message. A member of the team will be in touch shortly.", handled_by: "human" } }];`),
      hubspot.task("create_handover_task", { subject: "'Handover: ' + ($json.email || 'unknown customer')", body: "$json.summary" }),
      slack.post("notify_team", "'#support'", `':raising_hand: ' + $('read_escalation').first().json.urgency.toUpperCase() + ' handover from ' + ($('read_escalation').first().json.email || 'unknown') + ': ' + $('read_escalation').first().json.summary`, { onFail: "continue" }),
      set("set_escalation_reply", { reply: "$('read_escalation').first().json.reply", handled_by: "'human'" }),

      db.insert("log_conversation", "conversations", { conversation_id: `${msg}.conversation_id`, email: `${msg}.email`, message: `${msg}.text`, reply: "$json.reply", handled_by: "$json.handled_by", at: "$now.toISO()" }),
      respond("respond_to_customer", "{ reply: $json.reply, handled_by: $json.handled_by }"),

      /* ---- 4. Outbound: research ---- */
      schedule("daily_prospecting", "0 7 * * 1-5"),
      db.find("get_icp", "icp_profiles", { active: "true" }, { limit: 1 }),
      iff("if_icp", "!!$json.industry"),
      agent("Research Agent", {
        system: "You are the Research Agent. Find up to five real companies that fit the ideal customer profile you are given. Use web search to find candidates and fetch a company's own site to confirm it fits before you list it. For each give its name, its domain and one sentence of evidence. List nothing you could not confirm.",
        prompt: "'Industry: ' + $json.industry + '\\nSize: ' + $json.size + '\\nRegion: ' + $json.region + '\\nWe offer: ' + $json.offer",
        structured: true,
      }, { onFail: "continue" }),
      { name: "web_search", type: "@n8n/n8n-nodes-langchain.toolSerpApi", typeVersion: 1, parameters: { options: {} }, platform: "serpapi", attach: { to: "Research Agent", as: "ai_tool" } },
      fetchTool("fetch_page", "Research Agent"),
      shape("research_parser", "Research Agent", { companies: [{ name: "The company", domain: "its-site.com", why: "One sentence of evidence." }] }),
      code("read_companies", `const list = $input.first().json.output?.companies;
if (!Array.isArray(list)) return [];
const seen = new Set();
return list.filter((c) => c && c.name && c.domain && !seen.has(c.domain) && seen.add(c.domain)).slice(0, 5).map((c) => ({ json: { name: String(c.name), domain: String(c.domain).toLowerCase(), why: String(c.why ?? "") } }));`),

      /* ---- 5. Outbound: find the person, write, send ---- */
      batches("for_each_company", 1),
      agent("Lead Gen Agent", {
        system: "You are the Lead Gen Agent. For the company you are given, find the one person who holds the role in the ideal customer profile. Fetch the company's site (team, about and contact pages) to find them. Give their name, role and work email only if the site shows them, a fit score from 0 to 100, and the evidence for the role. If you cannot find a named person with an email, leave email empty.",
        prompt: `'Company: ' + $json.name + ' (' + $json.domain + ')\\nRole we want: ' + ${icp}.role + '\\nWhy the company fits: ' + $json.why`,
        structured: true,
      }, { onFail: "continue" }),
      fetchTool("fetch_company_page", "Lead Gen Agent"),
      crmTool("crm_search", "Lead Gen Agent"),
      shape("lead_parser", "Lead Gen Agent", { name: "Full name", role: "Their role", email: "name@company.com", company: "The company", score: 80, evidence: "Where the role was found." }),
      code("check_icp", `// The profile is applied here, in code: a model's enthusiasm does not qualify a lead.
const c = $("for_each_company").first().json;
const l = $input.first().json.output ?? {};
const email = String(l.email ?? "").trim().toLowerCase();
const reasons = [];
if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)) reasons.push("no work email found");
else if (!email.endsWith("@" + c.domain) && !email.endsWith("." + c.domain)) reasons.push("email is not at the company's domain");
if (!(Number(l.score) >= 70)) reasons.push("fit score under 70");
if (!String(l.evidence ?? "").trim()) reasons.push("no evidence for the role");
if (!String(l.name ?? "").trim()) reasons.push("no named person");
return [{ json: { company: c.name, domain: c.domain, why: c.why, name: String(l.name ?? ""), role: String(l.role ?? ""), email, score: Number(l.score) || 0, evidence: String(l.evidence ?? ""), qualified: reasons.length === 0, reasons } }];`),
      iff("if_qualified", "$json.qualified"),
      hubspot.search("find_contact", "$json.email"),
      iff("if_new_lead", "!$json.id"),
      agent("Cold Outreach Agent", {
        system: "You are the Cold Outreach Agent. Write one first email to the person you are given. Open with the specific thing found about their company, say in one sentence what we offer and why it fits them, and end with one small ask. Under 90 words, plain text, no flattery, no placeholders. Give a subject line of under 60 characters.",
        prompt: `'To: ' + ${lead}.name + ', ' + ${lead}.role + ' at ' + ${lead}.company + '\\nWhat we found: ' + ${lead}.why + '\\nWe offer: ' + ${icp}.offer`,
        structured: true,
      }, { onFail: "continue" }),
      shape("outreach_parser", "Cold Outreach Agent", { subject: "The subject line", body: "The email." }),
      code("check_email", `const l = $("check_icp").first().json;
const e = $input.first().json.output ?? {};
const subject = String(e.subject ?? "").trim();
const body = String(e.body ?? "").trim();
const problems = [];
if (!subject || subject.length > 80) problems.push("subject missing or too long");
if (body.length < 40 || body.split(/\\s+/).length > 130) problems.push("body missing or too long");
if (/[\\[{<][^\\]}>]*[\\]}>]/.test(subject + body)) problems.push("a placeholder was left in");
return [{ json: { ...l, subject, body, sendable: problems.length === 0, problems } }];`),
      iff("if_sendable", "$json.sendable"),
      gmail.send("send_outreach", { to: "$json.email", subject: "$json.subject", text: "$json.body" }),
      hubspot.contact("create_lead", `${lead}.email`, { firstName: `${lead}.name`, companyName: `${lead}.company`, jobTitle: `${lead}.role` }, { onFail: "continue" }),
      db.insert("log_outreach", "outreach_log", { email: `${lead}.email`, company: `${lead}.company`, subject: "$('check_email').first().json.subject", score: `${lead}.score`, sent_at: "$now.toISO()" }),

      /* ---- the models ---- */
      gptModel("OpenAI Chat Model", ["Router Agent", "RAG Agent", "Fallback Agent", "Human Escalation Agent"]),
      gptModel("OpenAI Chat Model 1", ["Research Agent", "Lead Gen Agent", "Cold Outreach Agent"]),
    ],
    flow: [
      ["on_message_received", "normalise_message", "Router Agent", "read_route", "switch_intent"],
      ["switch_intent:0", "RAG Agent", "read_answer", "if_answered", "log_conversation"],
      ["if_answered:1", "Fallback Agent"],
      ["switch_intent:2", "Fallback Agent", "read_fallback", "log_conversation"],
      ["switch_intent:1", "Human Escalation Agent", "read_escalation", "create_handover_task", "notify_team", "set_escalation_reply", "log_conversation"],
      ["log_conversation", "respond_to_customer"],

      ["daily_prospecting", "get_icp", "if_icp", "Research Agent", "read_companies", "for_each_company"],
      ["for_each_company:1", "Lead Gen Agent", "check_icp", "if_qualified", "find_contact", "if_new_lead", "Cold Outreach Agent", "check_email", "if_sendable", "send_outreach", "create_lead", "log_outreach", "for_each_company"],
      // A company that is dropped hands the loop back, so the next one still runs.
      ["if_qualified:1", "for_each_company"],
      ["if_new_lead:1", "for_each_company"],
      ["if_sendable:1", "for_each_company"],
    ],
    sections: [
      { title: "Inbound: route the message", note: "A router agent names the intent. Code decides where it goes, and sends anything that reads like a dispute to a person.", nodes: ["on_message_received", "normalise_message", "Router Agent", "read_route", "switch_intent"] },
      { title: "Inbound: answer, fall back or hand over", note: "The RAG agent answers from the knowledge base and the CRM. What it cannot answer goes to the fallback agent; what needs a person is briefed and raised.", nodes: ["RAG Agent", "read_answer", "if_answered", "Fallback Agent", "read_fallback", "Human Escalation Agent", "read_escalation", "create_handover_task", "notify_team", "set_escalation_reply", "log_conversation", "respond_to_customer"] },
      { title: "Outbound: research", note: "Weekdays. A research agent searches the web for companies that fit the profile stored in Supabase.", nodes: ["daily_prospecting", "get_icp", "if_icp", "Research Agent", "read_companies"] },
      { title: "Outbound: find the person, write, send", note: "One company per pass. Code applies the profile and checks the email before anything is sent.", nodes: ["for_each_company", "Lead Gen Agent", "check_icp", "if_qualified", "find_contact", "if_new_lead", "Cold Outreach Agent", "check_email", "if_sendable", "send_outreach", "create_lead", "log_outreach"] },
    ],
    story: [
      { title: "A message arrives", copy: "The webhook takes the message and puts it in one shape: who it is from, which conversation it belongs to and what it says.", nodes: ["on_message_received", "normalise_message"] },
      { title: "The router agent reads it", copy: "It names the intent and how sure it is. It does not answer.", nodes: ["Router Agent", "router_parser", "OpenAI Chat Model"] },
      { title: "Code decides the route", copy: "A clear support or sales question goes to be answered. A low-confidence reading goes to the fallback agent. Anything that mentions a refund, a complaint, legal action or asks for a person goes to a human, whatever the model thought.", nodes: ["read_route", "switch_intent"] },
      { title: "The RAG agent answers from what is known", copy: "It searches the knowledge base held in Supabase, can look the customer up in HubSpot, and remembers the conversation so far. It is told to say so when the tools do not hold the answer.", nodes: ["RAG Agent", "conversation_memory", "knowledge_base", "embeddings", "crm_lookup"] },
      { title: "No answer, no guess", copy: "If the RAG agent could not answer, the message goes to the fallback agent, which asks the one question that would make it answerable or says the team will follow up. If that model is down too, a fixed reply is sent.", nodes: ["read_answer", "if_answered", "Fallback Agent", "read_fallback"] },
      { title: "A person is briefed", copy: "The human escalation agent writes a summary for the colleague who picks the conversation up, rates its urgency and writes a holding reply. A task is created in HubSpot and the team is told in Slack.", nodes: ["Human Escalation Agent", "escalation_parser", "read_escalation", "create_handover_task", "notify_team", "set_escalation_reply"] },
      { title: "Logged and answered", copy: "Every conversation is stored in Supabase with who handled it, and the reply goes back to the customer.", nodes: ["log_conversation", "respond_to_customer"] },
      { title: "Outbound starts from the profile", copy: "On weekdays the ideal customer profile is read from Supabase: industry, size, region, the role to reach and what is on offer. With no active profile, nothing runs.", nodes: ["daily_prospecting", "get_icp", "if_icp"] },
      { title: "The research agent finds companies", copy: "It searches the web and fetches each company's own site to confirm the fit before listing it. The list is deduplicated and capped in code.", nodes: ["Research Agent", "web_search", "fetch_page", "research_parser", "OpenAI Chat Model 1", "read_companies"] },
      { title: "The lead gen agent finds the person", copy: "For each company it reads the team and contact pages for the person in the right role, and can check the CRM.", nodes: ["for_each_company", "Lead Gen Agent", "fetch_company_page", "crm_search", "lead_parser"] },
      { title: "The profile is applied in code", copy: "A lead qualifies only with a named person, an email at the company's own domain, evidence for the role and a fit score of 70 or more. Someone already in HubSpot is not contacted again.", nodes: ["check_icp", "if_qualified", "find_contact", "if_new_lead"] },
      { title: "The cold outreach agent writes", copy: "One short email built on what was found about the company. Code checks its length and that no placeholder was left in before it can be sent.", nodes: ["Cold Outreach Agent", "outreach_parser", "check_email", "if_sendable"] },
      { title: "Sent, filed and logged", copy: "The email goes out through Gmail, the lead is created in HubSpot, and the send is logged in Supabase.", nodes: ["send_outreach", "create_lead", "log_outreach"] },
    ],
    tests: [
      {
        name: "a support question is answered from the knowledge base",
        entry: "on_message_received",
        seed: { documents: [{ content: "Orders ship within two working days.", metadata: { title: "Shipping" } }] },
        llm: [ROUTE("support"), { system: "RAG Agent", last: "ship", tool: { name: "knowledge_base", input: { input: "shipping time" } } }, { system: "RAG Agent", text: "Orders ship within two working days." }],
        request: inbound("How long does it take to ship?"),
        response: { status: 200, body: { reply: "Orders ship within two working days.", handled_by: "rag" } },
        calls: [{ to: "supabase", path: "/rest/v1/rpc/match_documents" }],
        notRan: ["Fallback Agent", "Human Escalation Agent"],
        table: { conversations: [{ conversation_id: "conv-1", handled_by: "rag", email: "ana@example.com" }] },
      },
      {
        name: "what the knowledge base cannot answer goes to the fallback agent",
        entry: "on_message_received",
        llm: [ROUTE("support"), { system: "RAG Agent", text: "I do not know." }, { system: "Fallback Agent", text: "Could you tell me which product this is about?" }],
        request: inbound("Does it work with my old setup?"),
        response: { body: { reply: "Could you tell me which product this is about?", handled_by: "fallback" } },
        ran: ["RAG Agent", "Fallback Agent"],
      },
      {
        name: "an unclear message skips the RAG agent",
        entry: "on_message_received",
        llm: [ROUTE("other", 0.3), { system: "Fallback Agent", text: "Thanks. What can we help you with?" }],
        request: inbound("hello??"),
        response: { body: { handled_by: "fallback" } },
        notRan: ["RAG Agent", "Human Escalation Agent"],
      },
      {
        name: "a complaint reaches a person even when the router calls it support",
        entry: "on_message_received",
        llm: [ROUTE("support"), { system: "Human Escalation Agent", final: { summary: "The customer was charged twice and wants a refund.", urgency: "high", holding_reply: "Thanks for telling us. A member of the team will be in touch today." } }],
        request: inbound("I was charged twice and I want a refund now"),
        response: { body: { reply: "Thanks for telling us. A member of the team will be in touch today.", handled_by: "human" } },
        notRan: ["RAG Agent"],
        calls: [{ to: "hubspot" }, { to: "slack", path: "/api/chat.postMessage", body: { channel: "#support" } }],
        table: { conversations: [{ handled_by: "human" }] },
      },
      {
        name: "the customer still gets a reply when every model is down",
        entry: "on_message_received",
        fail: [{ path: "/v1/chat/completions", times: 30 }],
        request: inbound("How do I reset my password?"),
        response: { status: 200, body: { reply: "Thanks for your message. A member of the team will reply by email shortly.", handled_by: "fallback" } },
      },
      {
        name: "a qualified lead is emailed, created in HubSpot and logged",
        entry: "daily_prospecting",
        seed: ICP,
        llm: [RESEARCH, LEAD(), EMAIL],
        input: [{}],
        callCount: { [SENT]: 1 },
        ran: ["create_lead"],
        table: { outreach_log: [{ email: "dana@brightsmile.example", company: "Bright Smile Dental", subject: "Filling cancelled slots at Bright Smile Dental", score: 84 }] },
      },
      {
        name: "a lead that fails the profile is not contacted, whatever the model scored",
        entry: "daily_prospecting",
        seed: ICP,
        llm: [RESEARCH, LEAD({ email: "dana@gmail.example", score: 96 })],
        input: [{}],
        output: { node: "check_icp", json: { qualified: false, reasons: ["email is not at the company's domain"] } },
        notRan: ["Cold Outreach Agent", "send_outreach"],
        noCalls: ["gmail"],
      },
      {
        name: "someone already in HubSpot is not emailed again",
        entry: "daily_prospecting",
        seed: ICP,
        routes: [{ path: "api.hubapi.com/crm/v3/objects/contacts/search", response: { total: 1, results: [{ id: "501", properties: { email: "dana@brightsmile.example" } }] } }],
        llm: [RESEARCH, LEAD()],
        input: [{}],
        ran: ["find_contact"],
        notRan: ["Cold Outreach Agent", "send_outreach"],
        noCalls: ["gmail"],
      },
      {
        name: "an email with a placeholder left in is not sent",
        entry: "daily_prospecting",
        seed: ICP,
        llm: [RESEARCH, LEAD(), { system: "Cold Outreach Agent", final: { subject: "Quick idea for [Company]", body: "Hi [First name], I saw your company and thought our booking tool could help you fill cancelled slots. Worth a call?" } }],
        input: [{}],
        output: { node: "check_email", json: { sendable: false } },
        noCalls: ["gmail"],
        notRan: ["create_lead"],
      },
      {
        name: "nothing runs without an active customer profile",
        entry: "daily_prospecting",
        input: [{}],
        notRan: ["Research Agent"],
        noCalls: ["openai", "gmail"],
      },
    ],
  }),
];
