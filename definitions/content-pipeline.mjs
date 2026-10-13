/**
 * Content pipeline: a topic becomes a researched draft, a person approves it,
 * and only then is it published and shared.
 */
import { webhook, schedule, code, iff, respond, batches, noop, define } from "../lib/wf.mjs";
import { db, slack, wordpress, serp, social, ask, readAnswer } from "../lib/nodes.mjs";

const base = { folder: "systems/content-pipeline", tier: "flagship", system: "content-pipeline", category: "Content and SEO" };

export default [
  define({
    ...base,
    id: "content-draft",
    name: "Content pipeline · Research and draft",
    summary: "Takes the next topic off the list, researches it, drafts the article, and asks a person to approve it. Nothing is published from here.",
    nodes: [
      schedule("Weekdays 07:00", "0 7 * * 1-5"),
      db.find("Next topic", "content_topics", { status: "'queued'" }, { limit: 1 }),
      iff("Is there one?", "!!$json.id"),
      db.update("Claim the topic", "content_topics", { id: "$json.id" }, { status: "'drafting'" }, { alwaysOutput: false }),
      serp.search("Research", "$('Is there one?').first().json.topic", { onFail: "continue" }),
      code("Collect sources", `const t = $("Is there one?").first().json;
const results = ($input.first().json.organic_results ?? []).slice(0, 5);
return [{ json: { topic_id: t.id, topic: t.topic, sources: results.map((r) => ({ title: r.title, url: r.link })), notes: results.map((r) => "- " + r.title + ": " + String(r.snippet ?? "").slice(0, 400)).join("\\n") } }];`),
      ...ask("Outline", { task: "outline", system: "Write an article outline as JSON: { title: string, sections: string[], keywords: string[] }. Use only facts found in the research notes.", prompt: "'Topic: ' + $json.topic + '\\n\\nResearch notes:\\n' + ($json.notes || '(none)')", example: { title: "The title", sections: ["A section"], keywords: ["a keyword"] } }),
      readAnswer("Read the outline", { from: "Collect sources", fallback: { title: null, sections: [], keywords: [] } }),
      iff("Usable outline?", "!$json.parse_error && $json.sections.length >= 2"),
      ...ask("Write the draft", { task: "draft", system: "Write the article in Markdown from this outline. Plain language, no invented statistics, cite only the sources listed.", prompt: "JSON.stringify({ title: $json.title, sections: $json.sections, sources: $json.sources })" }),
      db.insert("Save the draft", "content_drafts", { topic_id: "$('Usable outline?').first().json.topic_id", title: "$('Usable outline?').first().json.title", keywords: "$('Usable outline?').first().json.keywords", sources: "$('Usable outline?').first().json.sources", body: "$json.output", status: "'awaiting_approval'", created_at: "$now.toISO()" }),
      slack.post("Ask for approval", "'#content'", "':memo: Draft ready for review: \"' + $json.title + '\". Approve or reject draft ' + $json.id + '.'"),
      db.update("Return the topic", "content_topics", { id: "$json.topic_id" }, { status: "'needs_brief'" }, { alwaysOutput: false }),
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
      { name: "drafts the queued topic and asks for approval", seed: { content_topics: [{ id: "t1", topic: "How prop firm payouts work", status: "queued" }] }, routes: [{ path: "serpapi.com/search.json", response: { organic_results: [{ title: "Payouts explained", link: "https://example.com/a", snippet: "Payouts are paid monthly." }] } }], input: [{}], ran: ["Ask for approval"], calls: [{ to: "supabase", path: "/rest/v1/content_drafts", body: { status: "awaiting_approval", topic_id: "t1" } }, { to: "slack", path: "/api/chat.postMessage", body: { channel: "#content" } }], table: { content_topics: [{ id: "t1", status: "drafting" }] }, noCalls: ["wordpress"] },
      { name: "does nothing when the queue is empty", input: [{}], ran: ["Queue is empty"], noCalls: ["openai", "anthropic"] },
      { name: "a thin outline sends the topic back", seed: { content_topics: [{ id: "t2", topic: "X", status: "queued" }] }, llm: [{ final: JSON.parse("{\"title\":\"X\",\"sections\":[]}") }], input: [{}], ran: ["Return the topic"], notRan: ["Write the draft"], table: { content_topics: [{ id: "t2", status: "needs_brief" }] } },
    ],
  }),

  define({
    ...base,
    id: "content-approval",
    name: "Content pipeline · Approve and publish",
    summary: "Receives a person's decision on a draft. Approved drafts are published to the CMS once and queued for sharing; rejected ones go back with the reason.",
    nodes: [
      webhook("Decision", "content-decision"),
      code("Read the decision", `const b = $input.first().json.body ?? {};
const decision = b.decision === "approve" ? "approve" : b.decision === "reject" ? "reject" : null;
return [{ json: { valid: !!decision && !!b.draft_id, decision, draft_id: String(b.draft_id ?? ""), by: String(b.by ?? "unknown"), reason: String(b.reason ?? "") } }];`),
      iff("Valid?", "$json.valid"),
      respond("Bad request", "{ ok: false, error: 'Need draft_id and decision: approve | reject' }", { status: 400 }),
      db.find("Load the draft", "content_drafts", { id: "$json.draft_id" }),
      iff("Awaiting approval?", "$json.status === 'awaiting_approval'"),
      respond("Not pending", "{ ok: false, error: 'That draft is not awaiting approval' }", { status: 409 }),
      iff("Approved?", "$('Read the decision').first().json.decision === 'approve'"),
      wordpress.publish("Publish to WordPress", { title: "$json.title", content: "$json.body" }),
      db.update("Mark published", "content_drafts", { id: "$('Read the decision').first().json.draft_id" }, { status: "'published'", post_id: "$json.id", approved_by: "$('Read the decision').first().json.by", published_at: "$now.toISO()", shared: "false" }, { alwaysOutput: false }),
      respond("Published", "{ ok: true, status: 'published' }"),
      db.update("Mark rejected", "content_drafts", { id: "$json.id" }, { status: "'rejected'", rejected_by: "$('Read the decision').first().json.by", reason: "$('Read the decision').first().json.reason" }, { alwaysOutput: false }),
      respond("Rejected", "{ ok: true, status: 'rejected' }"),
    ],
    flow: [
      ["Decision", "Read the decision", "Valid?", "Load the draft", "Awaiting approval?", "Approved?", "Publish to WordPress", "Mark published", "Published"],
      ["Valid?:1", "Bad request"],
      ["Awaiting approval?:1", "Not pending"],
      ["Approved?:1", "Mark rejected", "Rejected"],
    ],
    story: [
      { title: "A person presses a button", copy: "Approve or reject, with who decided.", nodes: ["Decision", "Read the decision", "Valid?", "Bad request"] },
      { title: "The draft must still be pending", copy: "A second click, or a click on an old message, gets a 409 and publishes nothing.", nodes: ["Load the draft", "Awaiting approval?", "Not pending"] },
      { title: "Approved: published once", copy: "The article goes to the CMS and the draft records who approved it and when.", nodes: ["Approved?", "Publish to WordPress", "Mark published", "Published"] },
      { title: "Rejected: kept with the reason", copy: "Nothing is deleted, so the reason is there for the next attempt.", nodes: ["Mark rejected", "Rejected"] },
    ],
    tests: [
      { name: "approval publishes and records who approved", seed: { content_drafts: [{ id: "d1", title: "T", body: "B", status: "awaiting_approval" }] }, request: { body: { draft_id: "d1", decision: "approve", by: "kim" } }, response: { status: 200, body: { status: "published" } }, calls: [{ to: "wordpress", path: "/wp-json/wp/v2/posts", body: { status: "publish", title: "T" } }], table: { content_drafts: [{ id: "d1", status: "published", approved_by: "kim", shared: false }] } },
      { name: "rejection publishes nothing and keeps the reason", seed: { content_drafts: [{ id: "d1", title: "T", body: "B", status: "awaiting_approval" }] }, request: { body: { draft_id: "d1", decision: "reject", by: "kim", reason: "Too thin" } }, response: { body: { status: "rejected" } }, noCalls: ["wordpress"], table: { content_drafts: [{ id: "d1", status: "rejected", reason: "Too thin" }] } },
      { name: "approving twice publishes once", seed: { content_drafts: [{ id: "d1", title: "T", body: "B", status: "awaiting_approval" }] }, repeat: 2, request: { body: { draft_id: "d1", decision: "approve", by: "kim" } }, response: { status: 409 }, callCount: { "wordpress /wp-json/wp/v2/posts": 1 } },
      { name: "an unknown draft is refused", request: { body: { draft_id: "nope", decision: "approve" } }, response: { status: 409 }, noCalls: ["wordpress"] },
      { name: "a malformed decision is a 400", request: { body: { decision: "maybe" } }, response: { status: 400 }, noCalls: ["supabase"] },
    ],
  }),

  define({
    ...base,
    id: "content-distribute",
    name: "Content pipeline · Share what was published",
    summary: "Every hour, writes a post per network for anything newly published and schedules it. One network failing does not stop the others.",
    nodes: [
      schedule("Hourly", { hours: 1 }),
      db.find("Published, not shared", "content_drafts", { status: "'published'", shared: "'false'" }),
      iff("Anything new?", "!!$json.id"),
      batches("Each article", 1),
      ...ask("Write the posts", { task: "social", system: "Write one post per network for this article. Reply with JSON: { x: string (max 260 chars), linkedin: string, facebook: string }. No hashtags stuffing, no invented claims.", prompt: "$json.title + '\\n\\n' + String($json.body).slice(0, 1500)", example: { x: "The X post", linkedin: "The LinkedIn post", facebook: "The Facebook post" } }),
      code("Cut each post to length", `const a = $("Each article").first().json;
const o = $input.first().json.output ?? {};
const fallback = "New on the blog: " + a.title;
const post = (network, max) => String(typeof o[network] === "string" && o[network].trim() ? o[network] : fallback).slice(0, max);
return [{ json: { draft_id: a.id, x: post("x", 260), linkedin: post("linkedin", 2000), facebook: post("facebook", 2000) } }];`),
      social.linkedin("Post to LinkedIn", "$('Cut each post to length').first().json.linkedin", { onFail: "continue" }),
      social.x("Post to X", "$('Cut each post to length').first().json.x", { onFail: "continue" }),
      social.facebook("Post to Facebook", "$('Cut each post to length').first().json.facebook", { onFail: "continue" }),
      db.update("Mark shared", "content_drafts", { id: "$('Each article').first().json.id" }, { shared: "true", shared_at: "$now.toISO()" }, { alwaysOutput: false }),
      noop("Nothing new"),
      noop("Done"),
    ],
    flow: [
      ["Hourly", "Published, not shared", "Anything new?", "Each article"],
      ["Anything new?:1", "Nothing new"],
      ["Each article:0", "Done"],
      ["Each article:1", "Write the posts", "Cut each post to length", "Post to LinkedIn", "Post to X", "Post to Facebook", "Mark shared", "Each article"],
    ],
    story: [
      { title: "It looks for new articles", copy: "Published and not yet shared. The flag in the datastore is the only state.", nodes: ["Hourly", "Published, not shared", "Anything new?", "Nothing new"] },
      { title: "A post for each network", copy: "The model writes three versions. If it fails, a plain title-and-link post is used instead.", nodes: ["Each article", "Write the posts", "Cut each post to length"] },
      { title: "Scheduled, then marked", copy: "LinkedIn, X and Facebook are posted one after another, so one outage costs one post and not all three.", nodes: ["Post to LinkedIn", "Post to X", "Post to Facebook", "Mark shared", "Done"] },
    ],
    tests: [
      { name: "schedules three posts and marks the article shared", seed: { content_drafts: [{ id: "d1", title: "T", body: "B", status: "published", shared: false }] }, input: [{}], callCount: { linkedin: 1, x: 1, facebook: 1 }, table: { content_drafts: [{ id: "d1", shared: true }] } },
      { name: "uses a plain post when the model is down", seed: { content_drafts: [{ id: "d1", title: "Payouts", body: "B", status: "published", shared: false }] }, fail: [{ path: "/v1/chat/completions", times: 20 }, { path: "/v1/messages", times: 20 }], input: [{}], calls: [{ to: "x", path: "/2/tweets", body: { text: "New on the blog: Payouts" } }], table: { content_drafts: [{ id: "d1", shared: true }] } },
      { name: "does nothing when nothing is new", seed: { content_drafts: [{ id: "d1", status: "published", shared: true }] }, input: [{}], ran: ["Nothing new"], noCalls: ["linkedin", "x", "facebook"] },
    ],
  }),
];
