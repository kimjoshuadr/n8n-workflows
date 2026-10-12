/**
 * Content pipeline: a topic becomes a researched draft, a person approves it,
 * and only then is it published and shared.
 */
import { define, webhook, schedule, http, llm, parseLlm, code, iff, call, respond, noop, batches } from "../lib/wf.mjs";

const base = { folder: "systems/content-pipeline", tier: "flagship", system: "content-pipeline", category: "Content and SEO" };

export default [
  define({
    ...base,
    id: "content-draft",
    name: "Content pipeline · Research and draft",
    summary: "Takes the next topic off the list, researches it, drafts the article, and asks a person to approve it. Nothing is published from here.",
    integrations: ["Schedule", "Datastore", "Search", "LLM", "Chat"],
    nodes: [
      schedule("Weekdays 07:00", "0 7 * * 1-5"),
      http("Next topic", "DB:/content_topics", { method: "GET", query: { status: "'eq.queued'", limit: "'1'" }, alwaysOutput: true }),
      iff("Is there one?", "!!$json.id"),
      http("Claim the topic", "DB:/content_topics", { method: "PATCH", query: { id: "'eq.' + $json.id" }, body: "{ status: 'drafting' }" }),
      http("Research", "SEARCH:/search", { body: "{ query: $('Is there one?').first().json.topic, max_results: 5 }", onFail: "continue" }),
      code("Collect sources", `const t = $("Is there one?").first().json;
const results = ($input.first().json.results ?? []).slice(0, 5);
return [{ json: { topic_id: t.id, topic: t.topic, sources: results.map((r) => ({ title: r.title, url: r.url })), notes: results.map((r) => "- " + r.title + ": " + String(r.content ?? "").slice(0, 400)).join("\\n") } }];`),
      llm("Outline", { task: "outline", system: "Write an article outline as JSON: { title: string, sections: string[], keywords: string[] }. Use only facts found in the research notes.", user: "'Topic: ' + $json.topic + '\\n\\nResearch notes:\\n' + ($json.notes || '(none)')" }),
      parseLlm("Read the outline", { from: "Collect sources", fallback: { title: null, sections: [], keywords: [] } }),
      iff("Usable outline?", "!$json.parse_error && $json.sections.length >= 2"),
      llm("Write the draft", { task: "draft", json: false, system: "Write the article in Markdown from this outline. Plain language, no invented statistics, cite only the sources listed.", user: "JSON.stringify({ title: $json.title, sections: $json.sections, sources: $json.sources })" }),
      http("Save the draft", "DB:/content_drafts", { body: "{ topic_id: $('Usable outline?').first().json.topic_id, title: $('Usable outline?').first().json.title, keywords: $('Usable outline?').first().json.keywords, sources: $('Usable outline?').first().json.sources, body: $json.choices[0].message.content, status: 'awaiting_approval', created_at: $now.toISO() }" }),
      http("Ask for approval", "CHAT:/chat.postMessage", { body: "{ channel: '#content', text: ':memo: Draft ready for review: \"' + $json.title + '\"', draft_id: $json.id, actions: ['approve', 'reject'] }" }),
      http("Return the topic", "DB:/content_topics", { method: "PATCH", query: { id: "'eq.' + $json.topic_id" }, body: "{ status: 'needs_brief' }" }),
      noop("Queue is empty"),
    ],
    flow: [
      ["Weekdays 07:00", "Next topic", "Is there one?", "Claim the topic", "Research", "Collect sources", "Outline", "Read the outline", "Usable outline?", "Write the draft", "Save the draft", "Ask for approval"],
      ["Is there one?:1", "Queue is empty"],
      ["Usable outline?:1", "Return the topic"],
    ],
    story: [
      { title: "One topic a day", copy: "The next queued topic is claimed, so two runs can never draft the same one.", nodes: ["Weekdays 07:00", "Next topic", "Is there one?", "Claim the topic", "Queue is empty"] },
      { title: "Research before writing", copy: "A search gathers sources. The model is told to use only what is in them.", nodes: ["Research", "Collect sources"] },
      { title: "Outline, then a check", copy: "A thin or unreadable outline sends the topic back for a better brief instead of producing a weak article.", nodes: ["Outline", "Read the outline", "Usable outline?", "Return the topic"] },
      { title: "The draft is written and saved", copy: "It is stored as awaiting approval, with its sources.", nodes: ["Write the draft", "Save the draft"] },
      { title: "A person decides", copy: "The content channel gets approve and reject buttons. Publishing is a separate workflow that only a person can start.", nodes: ["Ask for approval"] },
    ],
    tests: [
      { name: "drafts the queued topic and asks for approval", seed: { content_topics: [{ id: "t1", topic: "How prop firm payouts work", status: "queued" }] }, routes: [{ path: "/search/search", response: { results: [{ title: "Payouts explained", url: "https://example.com/a", content: "Payouts are paid monthly." }] } }], input: [{}], ran: ["Ask for approval"], calls: [{ path: "/db/content_drafts", body: { status: "awaiting_approval", topic_id: "t1" } }, { path: "/chat/chat.postMessage", body: { channel: "#content" } }], table: { content_topics: [{ id: "t1", status: "drafting" }] }, noCalls: ["/cms"] },
      { name: "does nothing when the queue is empty", input: [{}], ran: ["Queue is empty"], noCalls: ["/llm"] },
      { name: "a thin outline sends the topic back", seed: { content_topics: [{ id: "t2", topic: "X", status: "queued" }] }, routes: [{ path: "/llm/chat/completions", response: { choices: [{ message: { content: "{\"title\":\"X\",\"sections\":[]}" } }] } }], input: [{}], ran: ["Return the topic"], notRan: ["Write the draft"], table: { content_topics: [{ id: "t2", status: "needs_brief" }] } },
    ],
  }),

  define({
    ...base,
    id: "content-approval",
    name: "Content pipeline · Approve and publish",
    summary: "Receives a person's decision on a draft. Approved drafts are published to the CMS once and queued for sharing; rejected ones go back with the reason.",
    integrations: ["Webhook", "Datastore", "CMS", "Chat"],
    nodes: [
      webhook("Decision", "content-decision"),
      code("Read the decision", `const b = $input.first().json.body ?? {};
const decision = b.decision === "approve" ? "approve" : b.decision === "reject" ? "reject" : null;
return [{ json: { valid: !!decision && !!b.draft_id, decision, draft_id: String(b.draft_id ?? ""), by: String(b.by ?? "unknown"), reason: String(b.reason ?? "") } }];`),
      iff("Valid?", "$json.valid"),
      respond("Bad request", "{ ok: false, error: 'Need draft_id and decision: approve | reject' }", { status: 400 }),
      http("Load the draft", "DB:/content_drafts", { method: "GET", query: { id: "'eq.' + $json.draft_id" }, alwaysOutput: true }),
      iff("Awaiting approval?", "$json.status === 'awaiting_approval'"),
      respond("Not pending", "{ ok: false, error: 'That draft is not awaiting approval' }", { status: 409 }),
      iff("Approved?", "$('Read the decision').first().json.decision === 'approve'"),
      http("Publish to CMS", "CMS:/posts", { body: "{ title: $json.title, content: $json.body, status: 'publish', meta: { keywords: $json.keywords } }" }),
      http("Mark published", "DB:/content_drafts", { method: "PATCH", query: { id: "'eq.' + $('Read the decision').first().json.draft_id" }, body: "{ status: 'published', post_id: $json.id, approved_by: $('Read the decision').first().json.by, published_at: $now.toISO(), shared: false }" }),
      respond("Published", "{ ok: true, status: 'published' }"),
      http("Mark rejected", "DB:/content_drafts", { method: "PATCH", query: { id: "'eq.' + $json.id" }, body: "{ status: 'rejected', rejected_by: $('Read the decision').first().json.by, reason: $('Read the decision').first().json.reason }" }),
      respond("Rejected", "{ ok: true, status: 'rejected' }"),
    ],
    flow: [
      ["Decision", "Read the decision", "Valid?", "Load the draft", "Awaiting approval?", "Approved?", "Publish to CMS", "Mark published", "Published"],
      ["Valid?:1", "Bad request"],
      ["Awaiting approval?:1", "Not pending"],
      ["Approved?:1", "Mark rejected", "Rejected"],
    ],
    story: [
      { title: "A person presses a button", copy: "Approve or reject, with who decided.", nodes: ["Decision", "Read the decision", "Valid?", "Bad request"] },
      { title: "The draft must still be pending", copy: "A second click, or a click on an old message, gets a 409 and publishes nothing.", nodes: ["Load the draft", "Awaiting approval?", "Not pending"] },
      { title: "Approved: published once", copy: "The article goes to the CMS and the draft records who approved it and when.", nodes: ["Approved?", "Publish to CMS", "Mark published", "Published"] },
      { title: "Rejected: kept with the reason", copy: "Nothing is deleted, so the reason is there for the next attempt.", nodes: ["Mark rejected", "Rejected"] },
    ],
    tests: [
      { name: "approval publishes and records who approved", seed: { content_drafts: [{ id: "d1", title: "T", body: "B", status: "awaiting_approval" }] }, request: { body: { draft_id: "d1", decision: "approve", by: "kim" } }, response: { status: 200, body: { status: "published" } }, calls: [{ path: "/cms/posts", body: { status: "publish", title: "T" } }], table: { content_drafts: [{ id: "d1", status: "published", approved_by: "kim", shared: false }] } },
      { name: "rejection publishes nothing and keeps the reason", seed: { content_drafts: [{ id: "d1", title: "T", body: "B", status: "awaiting_approval" }] }, request: { body: { draft_id: "d1", decision: "reject", by: "kim", reason: "Too thin" } }, response: { body: { status: "rejected" } }, noCalls: ["/cms"], table: { content_drafts: [{ id: "d1", status: "rejected", reason: "Too thin" }] } },
      { name: "approving twice publishes once", seed: { content_drafts: [{ id: "d1", title: "T", body: "B", status: "awaiting_approval" }] }, repeat: 2, request: { body: { draft_id: "d1", decision: "approve", by: "kim" } }, response: { status: 409 }, callCount: { "/cms/posts": 1 } },
      { name: "an unknown draft is refused", request: { body: { draft_id: "nope", decision: "approve" } }, response: { status: 409 }, noCalls: ["/cms"] },
      { name: "a malformed decision is a 400", request: { body: { decision: "maybe" } }, response: { status: 400 }, noCalls: ["/db"] },
    ],
  }),

  define({
    ...base,
    id: "content-distribute",
    name: "Content pipeline · Share what was published",
    summary: "Every hour, writes a post per network for anything newly published and schedules it. One network failing does not stop the others.",
    integrations: ["Schedule", "Datastore", "LLM", "Social"],
    nodes: [
      schedule("Hourly", { hours: 1 }),
      http("Published, not shared", "DB:/content_drafts", { method: "GET", query: { status: "'eq.published'", shared: "'eq.false'" }, alwaysOutput: true }),
      iff("Anything new?", "!!$json.id"),
      batches("Each article", 1),
      llm("Write the posts", { task: "social", system: "Write one post per network for this article. Reply with JSON: { x: string (max 260 chars), linkedin: string, facebook: string }. No hashtags stuffing, no invented claims.", user: "$json.title + '\\n\\n' + String($json.body).slice(0, 1500)", onFail: "continue" }),
      code("One item per network", `const a = $("Each article").first().json;
let posts = {};
try { posts = JSON.parse($input.first().json.choices[0].message.content); } catch (e) {}
const fallback = "New on the blog: " + a.title;
return ["x", "linkedin", "facebook"].map((network) => ({ json: { draft_id: a.id, network, text: String(posts[network] || fallback).slice(0, network === "x" ? 260 : 2000) } }));`),
      http("Schedule the post", "SOCIAL:/updates/create", { body: "{ network: $json.network, text: $json.text }", onFail: "continue" }),
      http("Mark shared", "DB:/content_drafts", { method: "PATCH", query: { id: "'eq.' + $('Each article').first().json.id" }, body: "{ shared: true, shared_at: $now.toISO() }" }),
      noop("Nothing new"),
      noop("Done"),
    ],
    flow: [
      ["Hourly", "Published, not shared", "Anything new?", "Each article"],
      ["Anything new?:1", "Nothing new"],
      ["Each article:0", "Done"],
      ["Each article:1", "Write the posts", "One item per network", "Schedule the post", "Mark shared", "Each article"],
    ],
    story: [
      { title: "It looks for new articles", copy: "Published and not yet shared. The flag in the datastore is the only state.", nodes: ["Hourly", "Published, not shared", "Anything new?", "Nothing new"] },
      { title: "A post for each network", copy: "The model writes three versions. If it fails, a plain title-and-link post is used instead.", nodes: ["Each article", "Write the posts", "One item per network"] },
      { title: "Scheduled, then marked", copy: "Each network is scheduled on its own, so one outage costs one post and not all three.", nodes: ["Schedule the post", "Mark shared", "Done"] },
    ],
    tests: [
      { name: "schedules three posts and marks the article shared", seed: { content_drafts: [{ id: "d1", title: "T", body: "B", status: "published", shared: false }] }, input: [{}], callCount: { "/social/updates/create": 3 }, table: { content_drafts: [{ id: "d1", shared: true }] } },
      { name: "uses a plain post when the model is down", seed: { content_drafts: [{ id: "d1", title: "Payouts", body: "B", status: "published", shared: false }] }, fail: [{ path: "/llm", times: 3 }], input: [{}], calls: [{ path: "/social/updates/create", body: { text: "New on the blog: Payouts" } }], table: { content_drafts: [{ id: "d1", shared: true }] } },
      { name: "does nothing when nothing is new", seed: { content_drafts: [{ id: "d1", status: "published", shared: true }] }, input: [{}], ran: ["Nothing new"], noCalls: ["/social"] },
    ],
  }),
];
