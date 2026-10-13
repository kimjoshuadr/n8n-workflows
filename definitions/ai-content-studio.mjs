/**
 * AI content studio: one canvas, three ways in.
 *
 *   weekday mornings      -> the next topic is researched, outlined, written,
 *                            fact-checked, optimised and put in front of a person
 *   a person decides      -> approved pieces are published, illustrated, voiced
 *                            and shared; rejected ones keep the reason
 *   Friday afternoons     -> what was read becomes next week's topics
 *
 * Seven agents write and check. Nothing is published without a person's yes,
 * and a claim the sources do not support does not survive the fact-check.
 */
import { define, webhook, schedule, code, iff, call, noop, respond } from "../lib/wf.mjs";
import { db, slack, serp, wordpress, social, openaiApi, elevenlabs, posthog, agent, claude, gpt, shape, toolThink, toolKnowledge, embeddings } from "../lib/nodes.mjs";

const topic = "$('Is there a topic?').first().json";
const decision = "$('Read the decision').first().json";
const draft = "$('Awaiting approval?').first().json";

const TOPIC = { id: "t1", topic: "How prop firm payouts work", status: "queued" };
const SEARCH = { path: "serpapi.com/search.json", response: { organic_results: [{ title: "Payouts explained", link: "https://example.com/a", snippet: "Payouts are paid monthly after a review." }, { title: "Payout rules", link: "https://example.com/b", snippet: "Most firms pay within 14 days of a request." }, { title: "Trader guide", link: "https://example.com/c", snippet: "A request needs a minimum profit." }] } };
const RESEARCH = { system: "Research agent", final: { angle: "What actually happens between a payout request and the money arriving.", key_points: [{ point: "Payouts are paid monthly after a review", sources: [1] }, { point: "Most firms pay within 14 days", sources: [2] }, { point: "A request needs a minimum profit", sources: [3] }] } };
const OUTLINE = { system: "Outline agent", final: { title: "How prop firm payouts work", sections: ["The request", "The review", "The wait", "What can delay it"], keywords: ["prop firm payouts"] } };
const ARTICLE = "## The request\n" + Array(45).fill("Payouts are paid monthly after a review [1].").join(" ");
const DRAFT = { id: "d1", title: "How payouts work", slug: "how-payouts-work", meta_description: "What happens after a payout request.", body: "## The request\nPayouts are paid monthly [1].", status: "awaiting_approval" };

export default [
  define({
    id: "ai-content-studio",
    folder: "systems/ai-content-studio",
    tier: "flagship",
    system: "ai-content-studio",
    category: "AI agents",
    name: "AI content studio · Research to published, voiced and shared",
    summary: "Seven agents take a topic from research to a fact-checked, optimised draft. A person approves it in Slack, then it is published to WordPress with a cover image and an ElevenLabs voice-over, shared to LinkedIn, X and Facebook, and its results in PostHog become next week's topics.",
    nodes: [
      /* ---- 1. Research and outline ---- */
      schedule("Weekdays 07:00", "0 7 * * 1-5"),
      db.find("Next topic", "content_topics", { status: "'queued'" }, { limit: 1 }),
      iff("Is there a topic?", "!!$json.id"),
      noop("Queue is empty"),
      db.update("Claim the topic", "content_topics", { id: "$json.id", status: "'queued'" }, { status: "'drafting'", started_at: "$now.toISO()" }),
      iff("Claimed it?", "!!$json.id"),
      noop("Another run has it"),
      serp.search("Search the topic", `${topic}.topic`, { onFail: "continue", retry: false }),
      code("Collect the sources", `const t = $("Is there a topic?").first().json;
const found = $input.first().json ?? {};
const sources = (found.organic_results ?? []).slice(0, 6).map((r, i) => ({ n: i + 1, title: r.title, url: r.link, says: String(r.snippet ?? "").slice(0, 500) }));
return [{ json: { topic_id: t.id, topic: t.topic, audience: t.audience ?? "business owners", sources, enough: sources.length >= 2 } }];`),
      iff("Enough to write from?", "$json.enough"),
      agent("Research agent", {
        system: "You are the Research agent in a content studio. From the numbered sources, work out the angle worth taking for this audience and the key points an article should make. Every key point must name the source numbers it rests on. If the sources disagree, say so. Use nothing that is not in the sources.",
        prompt: "JSON.stringify({ topic: $json.topic, audience: $json.audience, sources: $json.sources })",
        structured: true,
      }, { onFail: "continue" }),
      claude("Claude · research", "Research agent"),
      toolThink("Reason it through", "Research agent"),
      shape("Research notes", "Research agent", { angle: "The angle to take.", key_points: [{ point: "A point the article should make", sources: [1, 2] }] }),
      code("Keep the supported points", `const s = $("Collect the sources").first().json;
const o = $input.first().json.output;
const known = new Set(s.sources.map((x) => x.n));
// A point that cites no real source is dropped here, before anyone writes from it.
const points = (o?.key_points ?? []).filter((p) => p && p.point && Array.isArray(p.sources) && p.sources.length && p.sources.every((n) => known.has(n)));
return [{ json: { ...s, angle: o?.angle ?? null, points, researched: !!o?.angle && points.length >= 2 } }];`),
      agent("Outline agent", {
        system: "You are the Outline agent. Turn the angle and key points into an article outline: a title, four to six section headings, and three search keywords. Search the past articles first and do not propose a title or angle that repeats one of them.",
        prompt: "JSON.stringify({ topic: $json.topic, audience: $json.audience, angle: $json.angle, points: $json.points })",
        structured: true,
      }, { onFail: "continue" }),
      claude("Claude · outline", "Outline agent"),
      toolKnowledge("Past articles", "Outline agent", "Search the articles already published, to avoid repeating one. Pass the topic.", "content-index"),
      embeddings("Embeddings · past articles", "Past articles"),
      shape("Outline", "Outline agent", { title: "The article title", sections: ["A section heading"], keywords: ["a keyword"] }),
      code("Check the outline", `const r = $("Keep the supported points").first().json;
const o = $input.first().json.output;
const ok = r.researched && o && typeof o.title === "string" && Array.isArray(o.sections) && o.sections.length >= 3;
return [{ json: { ...r, title: ok ? o.title.trim() : null, sections: ok ? o.sections : [], keywords: ok ? (o.keywords ?? []).slice(0, 5) : [], outlined: !!ok } }];`),
      iff("Usable outline?", "$json.outlined"),

      /* ---- 2. Write and check ---- */
      agent("Writer agent", {
        system: "You are the Writer agent. Write the article in Markdown from the outline: 600 to 900 words, plain language, short paragraphs, one H2 per section. Make only the listed key points and cite each with its source number in square brackets, like [2]. Search the house style guide before you start and follow it. No statistics, quotes or names that are not in the key points.",
        prompt: "JSON.stringify({ title: $json.title, sections: $json.sections, audience: $json.audience, points: $json.points })",
      }, { onFail: "continue" }),
      claude("Claude · writing", "Writer agent"),
      toolKnowledge("House style", "Writer agent", "Search the house style guide: tone, banned phrases, formatting rules.", "content-index"),
      embeddings("Embeddings · style", "House style"),
      code("Read the article", `const o = $("Check the outline").first().json;
const body = typeof $input.first().json.output === "string" ? $input.first().json.output.trim() : "";
const words = body.split(/\\s+/).filter(Boolean).length;
return [{ json: { ...o, body, words, written: words >= 150 } }];`),
      agent("Fact-check agent", {
        system: "You are the Fact-check agent. You did not write this article. List every factual claim in it: numbers, dates, names, causes, comparisons. For each, say whether the numbered sources support it and which source. Be strict: 'plausible' is not 'supported'.",
        prompt: "JSON.stringify({ article: $json.body, sources: $json.sources })",
        structured: true,
      }, { onFail: "continue" }),
      gpt("GPT · fact-check", "Fact-check agent"),
      shape("Claims", "Fact-check agent", { claims: [{ claim: "A factual claim from the article", supported: true, source: 1 }] }),
      code("Weigh the claims", `const a = $("Read the article").first().json;
const o = $input.first().json.output;
const checked = o && Array.isArray(o.claims);
const unsupported = checked ? o.claims.filter((c) => c && c.supported !== true).map((c) => c.claim) : [];
// A citation to a source that does not exist is unsupported whatever the checker said.
const cited = [...a.body.matchAll(/\\[(\\d+)\\]/g)].map((m) => Number(m[1]));
const phantom = [...new Set(cited.filter((n) => !a.sources.some((s) => s.n === n)))];
if (phantom.length) unsupported.push("cites source " + phantom.join(", ") + ", which does not exist");
return [{ json: { ...a, checked: !!checked, unsupported, clean: !!checked && unsupported.length === 0 && a.written } }];`),
      iff("Every claim supported?", "$json.clean"),
      iff("Worth a rewrite?", "$json.checked && $json.written && $json.unsupported.length <= 4"),
      agent("Editor agent", {
        system: "You are the Editor agent. Remove or rewrite every listed unsupported claim so the article says only what the sources support. Change nothing else. Return the full article in Markdown.",
        prompt: "JSON.stringify({ article: $json.body, unsupported: $json.unsupported, sources: $json.sources })",
      }, { onFail: "continue" }),
      claude("Claude · editing", "Editor agent"),
      code("Recheck the edit", `const a = $("Worth a rewrite?").first().json;
const body = typeof $input.first().json.output === "string" ? $input.first().json.output.trim() : "";
const words = body.split(/\\s+/).filter(Boolean).length;
const cited = [...body.matchAll(/\\[(\\d+)\\]/g)].map((m) => Number(m[1]));
const phantom = cited.some((n) => !a.sources.some((s) => s.n === n));
// The removed claims must be gone: compare on their first few words.
const still = a.unsupported.filter((c) => body.toLowerCase().includes(String(c).toLowerCase().split(/\\s+/).slice(0, 6).join(" ")));
return [{ json: { ...a, body: words >= 150 ? body : a.body, words, edited: true, clean: words >= 150 && !phantom && still.length === 0, unsupported: still } }];`),
      iff("Clean now?", "$json.clean"),
      agent("SEO agent", {
        system: "You are the SEO agent. Write a meta title (under 60 characters), a meta description (under 155 characters) and a URL slug (lowercase words joined by hyphens) for this article. Describe what the article says; do not oversell it.",
        prompt: "JSON.stringify({ title: $json.title, keywords: $json.keywords, opening: $json.body.slice(0, 600) })",
        structured: true,
      }, { onFail: "continue" }),
      gpt("GPT · SEO", "SEO agent"),
      shape("Meta", "SEO agent", { meta_title: "Under 60 characters", meta_description: "Under 155 characters", slug: "a-url-slug" }),
      code("Enforce the limits", `const a = $("Clean now?").isExecuted ? $("Clean now?").first().json : $("Every claim supported?").first().json;
const m = $input.first().json.output ?? {};
const slugify = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
// Lengths are cut here, so a model that overshoots cannot break the page.
return [{ json: { ...a, meta_title: String(m.meta_title || a.title).slice(0, 60), meta_description: String(m.meta_description || a.angle || "").slice(0, 155), slug: slugify(m.slug || a.title) } }];`),
      db.insert("Save the draft", "content_drafts", { topic_id: "$json.topic_id", title: "$json.title", slug: "$json.slug", meta_title: "$json.meta_title", meta_description: "$json.meta_description", keywords: "$json.keywords", sources: "$json.sources", body: "$json.body", words: "$json.words", edited: "$json.edited === true", status: "'awaiting_approval'", created_at: "$now.toISO()" }),
      slack.post("Ask for approval", "'#content'", "':memo: Draft ready: \"' + $json.title + '\" (' + $json.words + ' words' + ($json.edited ? ', edited after fact-check' : '') + '). Approve or reject draft ' + $json.id + '.'"),
      code("Could not finish", `const candidates = ["Recheck the edit", "Weigh the claims", "Check the outline", "Collect the sources"];
const name = candidates.find((n) => $(n).isExecuted);
const s = $(name).first().json;
const why = !s.enough && name === "Collect the sources" ? "too few sources were found" : !s.outlined && name === "Check the outline" ? "no usable outline could be made" : (s.unsupported ?? []).length ? "claims the sources do not support: " + s.unsupported.slice(0, 3).join("; ") : "the article could not be written";
return [{ json: { topic_id: s.topic_id, topic: s.topic, why } }];`),
      db.update("Return the topic", "content_topics", { id: "$json.topic_id" }, { status: "'needs_brief'", note: "$json.why" }),
      code("Returned message", `const r = $("Could not finish").first().json;
return [{ json: { channel: "#content", level: "warn", text: "\\"" + r.topic + "\\" was sent back for a better brief: " + r.why + "." } }];`),
      call("Tell the editor", "notify"),

      /* ---- 3. A person decides ---- */
      webhook("Decision", "content-studio-decision"),
      code("Read the decision", `const b = $input.first().json.body ?? {};
const d = b.decision === "approve" ? "approve" : b.decision === "reject" ? "reject" : null;
return [{ json: { valid: !!d && !!b.draft_id, decision: d, draft_id: String(b.draft_id ?? ""), by: String(b.by ?? "unknown"), reason: String(b.reason ?? "").slice(0, 500) } }];`),
      iff("Valid?", "$json.valid"),
      respond("Bad request", "{ ok: false, error: 'Need draft_id and decision: approve | reject' }", { status: 400 }),
      db.update("Take it if pending", "content_drafts", { id: "$json.draft_id", status: "'awaiting_approval'" }, { status: "$json.decision === 'approve' ? 'publishing' : 'rejected'", decided_by: "$json.by", decided_at: "$now.toISO()", reason: "$json.reason" }),
      iff("Awaiting approval?", "!!$json.id"),
      respond("Not pending", "{ ok: false, error: 'That draft is not awaiting approval' }", { status: 409 }),
      iff("Approved?", `${decision}.decision === 'approve'`),
      respond("Rejected", "{ ok: true, status: 'rejected' }"),
      respond("Publishing", "{ ok: true, status: 'publishing' }"),

      /* ---- 4. Publish, illustrate, voice ---- */
      wordpress.publish("Publish to WordPress", { title: `${draft}.title`, content: `${draft}.body` }),
      db.update("Mark published", "content_drafts", { id: `${draft}.id` }, { status: "'published'", post_id: "String($json.id ?? '')", published_at: "$now.toISO()" }),
      openaiApi.image("Make a cover image", `'An editorial illustration, flat shapes, two colours, no text, for an article titled: ' + ${draft}.title`, { onFail: "continue", retry: false }),
      code("Script for the voice", `const d = $("Awaiting approval?").first().json;
// Read aloud: no Markdown marks, no citation numbers, no links.
const script = String(d.body).replace(/\\[(\\d+)\\]/g, "").replace(/[#*_>\`]/g, "").replace(/\\[([^\\]]+)\\]\\([^)]+\\)/g, "$1").replace(/\\n{2,}/g, "\\n\\n").trim().slice(0, 4500);
return [{ json: { script, image_url: $input.first().json.data?.[0]?.url ?? null } }];`),
      elevenlabs.speak("Record the voice-over", { voice: "'narrator'", text: "$json.script" }, { onFail: "continue", retry: false }),
      db.update("Record the assets", "content_drafts", { id: `${draft}.id` }, { cover_image: "$('Script for the voice').first().json.image_url", has_voice_over: "!$json.error" }),

      /* ---- 5. Share ---- */
      agent("Social agent", {
        system: "You are the Social agent. Write one post per network announcing this article. LinkedIn: three short paragraphs, professional. X: under 250 characters. Facebook: two friendly sentences. Say what the article is about; make no claim the article does not make. No hashtags.",
        prompt: `JSON.stringify({ title: ${draft}.title, description: ${draft}.meta_description, opening: String(${draft}.body).slice(0, 800) })`,
        structured: true,
      }, { onFail: "continue" }),
      claude("Claude · social", "Social agent"),
      shape("Posts", "Social agent", { linkedin: "The LinkedIn post", x: "The X post", facebook: "The Facebook post" }),
      code("Cut each post to length", `const d = $("Awaiting approval?").first().json;
const o = $input.first().json.output ?? {};
const link = "https://acme.wordpress.test/" + d.slug;
const plain = "New on the blog: " + d.title;
const limit = { linkedin: 2800, x: 250, facebook: 1500 };
// A post the agent did not write falls back to the plain title, so sharing never waits on a model.
const post = (network) => String(typeof o[network] === "string" && o[network].trim() ? o[network] : plain).slice(0, limit[network]).trim() + "\\n" + link;
return [{ json: { linkedin: post("linkedin"), x: post("x"), facebook: post("facebook") } }];`),
      social.linkedin("Post to LinkedIn", "$('Cut each post to length').first().json.linkedin", { onFail: "continue" }),
      social.x("Post to X", "$('Cut each post to length').first().json.x", { onFail: "continue" }),
      social.facebook("Post to Facebook", "$('Cut each post to length').first().json.facebook", { onFail: "continue" }),
      db.update("Mark shared", "content_drafts", { id: `${draft}.id` }, { shared_at: "$now.toISO()" }),
      slack.post("Say it is live", "'#content'", `':tada: Published and shared: "' + ${draft}.title + '"'`),

      /* ---- 6. Learn ---- */
      schedule("Friday 16:00", "0 16 * * 5"),
      db.find("Published this month", "content_drafts", { status: "'published'", published_at: ["gte", "$now.minus({ days: 30 }).toISO()"] }),
      posthog.pageviews("Count the readers", "'/' + $json.slug", { onFail: "continue", retry: false }),
      code("Rank the articles", `const drafts = $("Published this month").all().map((i) => i.json);
const rows = $input.all().map((item, i) => ({ title: drafts[i]?.title, slug: drafts[i]?.slug, keywords: drafts[i]?.keywords ?? [], views: Number(item.json?.results?.[0]?.[0] ?? NaN) })).filter((r) => r.title);
const known = rows.filter((r) => Number.isFinite(r.views)).sort((a, b) => b.views - a.views);
return [{ json: { measured: known.length, of: rows.length, best: known.slice(0, 3), worst: known.slice(-3).reverse(), existing: rows.map((r) => r.title) } }];`),
      iff("Anything measured?", "$json.measured >= 2"),
      agent("Strategist agent", {
        system: "You are the Strategist agent. From which articles were read most and least, propose three topics for next week. Each must be a clear step on from something that worked, and none may repeat an existing title. Give one sentence of reasoning that refers to the numbers.",
        prompt: "JSON.stringify($json)",
        structured: true,
      }, { onFail: "continue" }),
      claude("Claude · strategy", "Strategist agent"),
      shape("Topics", "Strategist agent", { topics: [{ topic: "A topic to write next", why: "Why, referring to the numbers" }] }),
      code("Keep the new ones", `const r = $("Rank the articles").first().json;
const seen = new Set(r.existing.map((t) => String(t).toLowerCase().trim()));
const out = [];
for (const t of $input.first().json.output?.topics ?? []) {
  const key = String(t?.topic ?? "").toLowerCase().trim();
  if (!key || seen.has(key)) continue;
  seen.add(key);
  out.push({ json: { topic: t.topic.trim(), why: String(t.why ?? "").slice(0, 300) } });
}
return out.slice(0, 3);`),
      db.insert("Queue the topic", "content_topics", { topic: "$json.topic", note: "$json.why", status: "'queued'", suggested_by: "'strategist'", created_at: "$now.toISO()" }),
      slack.post("Post next week's topics", "'#content'", "':compass: Queued for next week: ' + $('Keep the new ones').all().map((i) => i.json.topic).join(' · ')", { once: true }),
      noop("Too little data yet"),
    ],
    flow: [
      ["Weekdays 07:00", "Next topic", "Is there a topic?", "Claim the topic", "Claimed it?", "Search the topic", "Collect the sources", "Enough to write from?", "Research agent", "Keep the supported points", "Outline agent", "Check the outline", "Usable outline?"],
      ["Is there a topic?:1", "Queue is empty"],
      ["Claimed it?:1", "Another run has it"],
      ["Enough to write from?:1", "Could not finish"],
      ["Usable outline?", "Writer agent", "Read the article", "Fact-check agent", "Weigh the claims", "Every claim supported?", "SEO agent", "Enforce the limits", "Save the draft", "Ask for approval"],
      ["Usable outline?:1", "Could not finish"],
      ["Every claim supported?:1", "Worth a rewrite?", "Editor agent", "Recheck the edit", "Clean now?", "SEO agent"],
      ["Worth a rewrite?:1", "Could not finish"],
      ["Clean now?:1", "Could not finish", "Return the topic", "Returned message", "Tell the editor"],

      ["Decision", "Read the decision", "Valid?", "Take it if pending", "Awaiting approval?", "Approved?", "Publishing", "Publish to WordPress", "Mark published", "Make a cover image", "Script for the voice", "Record the voice-over", "Record the assets", "Social agent", "Cut each post to length", "Post to LinkedIn", "Post to X", "Post to Facebook", "Mark shared", "Say it is live"],
      ["Valid?:1", "Bad request"],
      ["Awaiting approval?:1", "Not pending"],
      ["Approved?:1", "Rejected"],

      ["Friday 16:00", "Published this month", "Count the readers", "Rank the articles", "Anything measured?", "Strategist agent", "Keep the new ones", "Queue the topic", "Post next week's topics"],
      ["Anything measured?:1", "Too little data yet"],
    ],
    sections: [
      { title: "Research and outline", note: "SerpAPI finds sources. Points that cite no real source are dropped before anyone writes from them.", nodes: ["Weekdays 07:00", "Next topic", "Is there a topic?", "Queue is empty", "Claim the topic", "Claimed it?", "Another run has it", "Search the topic", "Collect the sources", "Enough to write from?", "Research agent", "Keep the supported points", "Outline agent", "Check the outline", "Usable outline?"] },
      { title: "Write, fact-check, edit, optimise", note: "A different model checks the writer. Unsupported claims get one edit, then the topic goes back.", nodes: ["Writer agent", "Read the article", "Fact-check agent", "Weigh the claims", "Every claim supported?", "Worth a rewrite?", "Editor agent", "Recheck the edit", "Clean now?", "SEO agent", "Enforce the limits", "Save the draft", "Ask for approval", "Could not finish", "Return the topic", "Returned message", "Tell the editor"] },
      { title: "A person decides", note: "Nothing below this line runs without a yes.", nodes: ["Decision", "Read the decision", "Valid?", "Bad request", "Take it if pending", "Awaiting approval?", "Not pending", "Approved?", "Rejected", "Publishing"] },
      { title: "Publish, illustrate, voice", nodes: ["Publish to WordPress", "Mark published", "Make a cover image", "Script for the voice", "Record the voice-over", "Record the assets"] },
      { title: "Share", nodes: ["Social agent", "Cut each post to length", "Post to LinkedIn", "Post to X", "Post to Facebook", "Mark shared", "Say it is live"] },
      { title: "Learn from what was read", nodes: ["Friday 16:00", "Published this month", "Count the readers", "Rank the articles", "Anything measured?", "Strategist agent", "Keep the new ones", "Queue the topic", "Post next week's topics", "Too little data yet"] },
    ],
    story: [
      { title: "One topic each weekday", copy: "The next queued topic is claimed in Supabase with an update that only succeeds once, so two runs cannot draft the same piece.", nodes: ["Weekdays 07:00", "Next topic", "Is there a topic?", "Queue is empty", "Claim the topic", "Claimed it?", "Another run has it"] },
      { title: "Sources first", copy: "SerpAPI gathers up to six sources and numbers them. With fewer than two, the topic is sent back instead of written from nothing.", nodes: ["Search the topic", "Collect the sources", "Enough to write from?"] },
      { title: "A research agent finds the angle", copy: "Each key point must name the source it rests on. Code then drops any point that cites a source that is not there.", nodes: ["Research agent", "Claude · research", "Reason it through", "Research notes", "Keep the supported points"] },
      { title: "An outline that does not repeat", copy: "The outline agent searches the published articles in Pinecone first.", nodes: ["Outline agent", "Claude · outline", "Past articles", "Embeddings · past articles", "Outline", "Check the outline", "Usable outline?"] },
      { title: "A writer agent drafts it", copy: "It reads the house style guide from Pinecone and may make only the supported points, citing each by number.", nodes: ["Writer agent", "Claude · writing", "House style", "Embeddings · style", "Read the article"] },
      { title: "A different model fact-checks it", copy: "Every claim is listed and marked supported or not. A citation to a source that does not exist is caught in code.", nodes: ["Fact-check agent", "GPT · fact-check", "Claims", "Weigh the claims", "Every claim supported?"] },
      { title: "One edit, then back for a brief", copy: "An editor agent removes what was not supported. Code checks the removed claims are really gone. If not, the topic returns with the reason.", nodes: ["Worth a rewrite?", "Editor agent", "Claude · editing", "Recheck the edit", "Clean now?", "Could not finish", "Return the topic", "Returned message", "Tell the editor"] },
      { title: "Optimised, saved, and put to a person", copy: "An SEO agent writes the meta text; code cuts it to length. The draft waits in Supabase and Slack asks for a decision.", nodes: ["SEO agent", "GPT · SEO", "Meta", "Enforce the limits", "Save the draft", "Ask for approval"] },
      { title: "A person says yes or no", copy: "The decision takes the draft only if it is still pending, so a second click publishes nothing.", nodes: ["Decision", "Read the decision", "Valid?", "Bad request", "Take it if pending", "Awaiting approval?", "Not pending", "Approved?", "Rejected", "Publishing"] },
      { title: "Published, illustrated and voiced", copy: "WordPress gets the article. OpenAI makes a cover image and ElevenLabs reads it aloud. Either can fail without unpublishing anything.", nodes: ["Publish to WordPress", "Mark published", "Make a cover image", "Script for the voice", "Record the voice-over", "Record the assets"] },
      { title: "Shared, one network at a time", copy: "A social agent writes three posts and code cuts each to its network's limit. LinkedIn, X and Facebook are posted one after another, and one failing does not stop the next.", nodes: ["Social agent", "Claude · social", "Posts", "Cut each post to length", "Post to LinkedIn", "Post to X", "Post to Facebook", "Mark shared", "Say it is live"] },
      { title: "Friday: what was actually read", copy: "PostHog counts readers per article. A strategist agent proposes three topics that build on what worked, and code refuses any that repeat a title.", nodes: ["Friday 16:00", "Published this month", "Count the readers", "Rank the articles", "Anything measured?", "Strategist agent", "Claude · strategy", "Topics", "Keep the new ones", "Queue the topic", "Post next week's topics", "Too little data yet"] },
    ],
    tests: [
      {
        name: "a topic is researched, written, fact-checked, optimised and put to a person",
        entry: "Weekdays 07:00",
        seed: { content_topics: [TOPIC], kb: [{ id: "style", title: "House style", text: "Short sentences. No hype." }] },
        routes: [SEARCH],
        llm: [RESEARCH, OUTLINE, { system: "Writer agent", text: ARTICLE }, { system: "Fact-check agent", final: { claims: [{ claim: "Payouts are paid monthly", supported: true, source: 1 }] } }, { system: "SEO agent", final: { meta_title: "How prop firm payouts work, explained in plain language for new and experienced traders alike", meta_description: "A guide.", slug: "How Prop Firm Payouts Work!" } }],
        ran: ["Ask for approval"], notRan: ["Editor agent", "Return the topic"], noCalls: ["wordpress"],
        output: [{ node: "Keep the supported points", json: { researched: true } }, { node: "Enforce the limits", json: { slug: "how-prop-firm-payouts-work" } }],
        table: { content_drafts: [{ topic_id: "t1", status: "awaiting_approval", edited: false }], content_topics: [{ id: "t1", status: "drafting" }] },
      },
      {
        name: "a point that cites a source that does not exist is dropped before writing",
        entry: "Weekdays 07:00",
        seed: { content_topics: [TOPIC] }, routes: [SEARCH],
        llm: [{ system: "Research agent", final: { angle: "A", key_points: [{ point: "Real", sources: [1] }, { point: "Invented", sources: [9] }] } }],
        ran: ["Return the topic"], notRan: ["Writer agent"],
        table: { content_topics: [{ id: "t1", status: "needs_brief" }] },
      },
      {
        name: "an unsupported claim is edited out, and the draft says it was edited",
        entry: "Weekdays 07:00",
        seed: { content_topics: [TOPIC] }, routes: [SEARCH],
        llm: [RESEARCH, OUTLINE, { system: "Writer agent", text: ARTICLE + " Nine in ten traders double their money within a week." }, { system: "Fact-check agent", final: { claims: [{ claim: "Nine in ten traders double their money within a week", supported: false, source: 0 }] } }, { system: "Editor agent", text: ARTICLE }, { system: "SEO agent", final: { meta_title: "Payouts", meta_description: "d", slug: "payouts" } }],
        ran: ["Editor agent", "Ask for approval"], table: { content_drafts: [{ topic_id: "t1", edited: true }] },
      },
      {
        name: "when the edit leaves the claim in, the topic goes back and nothing is saved",
        entry: "Weekdays 07:00",
        seed: { content_topics: [TOPIC] }, routes: [SEARCH],
        llm: [RESEARCH, OUTLINE, { system: "Writer agent", text: ARTICLE + " Nine in ten traders double their money within a week." }, { system: "Fact-check agent", final: { claims: [{ claim: "Nine in ten traders double their money within a week", supported: false }] } }, { system: "Editor agent", text: ARTICLE + " Nine in ten traders double their money within a week, we believe." }],
        ran: ["Tell the editor"], notRan: ["Save the draft"], table: { content_topics: [{ id: "t1", status: "needs_brief" }] },
      },
      {
        name: "a citation to a source that does not exist is caught even when the checker passes it",
        entry: "Weekdays 07:00",
        seed: { content_topics: [TOPIC] }, routes: [SEARCH],
        llm: [RESEARCH, OUTLINE, { system: "Writer agent", text: ARTICLE + " Rules changed last year [7]." }, { system: "Fact-check agent", final: { claims: [] } }, { system: "Editor agent", text: ARTICLE }, { system: "SEO agent", final: { meta_title: "P", meta_description: "d", slug: "p" } }],
        ran: ["Editor agent", "Ask for approval"],
      },
      { name: "with too few sources the topic is returned without a model call", entry: "Weekdays 07:00", seed: { content_topics: [TOPIC] }, routes: [{ path: "serpapi.com/search.json", response: { organic_results: [] } }], ran: ["Return the topic"], noCalls: ["anthropic", "openai"] },
      { name: "an empty queue does nothing", entry: "Weekdays 07:00", ran: ["Queue is empty"], noCalls: ["serpapi", "anthropic"] },
      {
        name: "an approved draft is published, illustrated, voiced and shared to three networks",
        seed: { content_drafts: [DRAFT] },
        request: { body: { draft_id: "d1", decision: "approve", by: "kim" } },
        response: { status: 200, body: { status: "publishing" } }, settle: true,
        llm: [{ system: "Social agent", final: { linkedin: "We wrote about payouts.", x: "x".repeat(400), facebook: "New guide." } }],
        calls: [{ to: "wordpress", path: "/wp-json/wp/v2/posts", body: { title: "How payouts work", status: "publish" } }, { to: "openai", path: "/v1/images/generations" }, { to: "elevenlabs" }, { to: "linkedin", path: "/rest/posts" }, { to: "x", path: "/2/tweets" }, { to: "facebook" }, { to: "slack", body: { channel: "#content" } }],
        table: { content_drafts: [{ id: "d1", status: "published", decided_by: "kim" }] },
      },
      { name: "approving twice publishes once", seed: { content_drafts: [DRAFT] }, repeat: 2, request: { body: { draft_id: "d1", decision: "approve", by: "kim" } }, response: { status: 409 }, callCount: { "wordpress /wp-json/wp/v2/posts": 1 } },
      { name: "a rejection publishes nothing and keeps the reason", seed: { content_drafts: [DRAFT] }, request: { body: { draft_id: "d1", decision: "reject", by: "kim", reason: "Too thin" } }, response: { body: { status: "rejected" } }, noCalls: ["wordpress", "linkedin", "elevenlabs"], table: { content_drafts: [{ id: "d1", status: "rejected", reason: "Too thin" }] } },
      { name: "sharing still happens with a plain post when the social model is down", seed: { content_drafts: [DRAFT] }, fail: [{ path: "/v1/messages", times: 20, status: 529 }], request: { body: { draft_id: "d1", decision: "approve", by: "kim" } }, settle: true, calls: [{ to: "x", path: "/2/tweets", body: { text: "New on the blog: How payouts work\nhttps://acme.wordpress.test/how-payouts-work" } }, { to: "linkedin" }] },
      { name: "a malformed decision is a 400", request: { body: { decision: "maybe" } }, response: { status: 400 }, noCalls: ["supabase", "wordpress"] },
      {
        name: "Friday's topics build on what was read and never repeat a title",
        entry: "Friday 16:00",
        seed: { content_drafts: [{ id: "a", title: "How payouts work", slug: "how-payouts-work", status: "published", published_at: "2999-01-01T00:00:00Z" }, { id: "b", title: "Choosing a challenge", slug: "choosing-a-challenge", status: "published", published_at: "2999-01-01T00:00:00Z" }] },
        routes: [{ path: "app.posthog.com/api/projects/@current/query/", response: { results: [[120]] } }],
        llm: [{ system: "Strategist agent", final: { topics: [{ topic: "How payouts work", why: "It did well" }, { topic: "Payout schedules compared", why: "Payouts had 120 readers" }] } }],
        ran: ["Post next week's topics"], callCount: { "supabase /rest/v1/content_topics": 1 },
        table: { content_topics: [{ topic: "Payout schedules compared", status: "queued" }] },
      },
    ],
  }),
];
