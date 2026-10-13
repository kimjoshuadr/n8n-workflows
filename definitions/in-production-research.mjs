/**
 * Built and run in production, rebuilt here for publication: the research
 * engine behind a daily newsletter.
 *
 * Ten sources are each read on their own schedule. Every article found is
 * scraped in full, judged for relevance by a model, and the ones that pass are
 * saved as Markdown in Google Drive and indexed in Supabase. The newsletter
 * drafting workflow starts from that store.
 *
 * The four sections and the shape of each row follow the original canvas. The
 * source rows were too small to read in the screenshot, so the three feed rows
 * and seven blog rows here are a reading of it, and every address is a
 * placeholder. Where the canvas drops an item with a Filter node inside the
 * loop, this build uses an If node, so the loop is handed back and the next
 * article still runs.
 */
import { schedule, called, http, code, iff, set, filter, splitOut, batches, call, define } from "../lib/wf.mjs";
import { db, drive, rss, chain, geminiModel, groqModel, autofix, shape } from "../lib/nodes.mjs";

const FEEDS = 3;
const BLOGS = 7;
const SOURCES = "https://feeds.acme.example";

const normalise = (source, urlField) => `return $input.all().map((i) => i.json).filter((p) => p.${urlField} && p.title).map((p) => ({ json: { url: String(p.${urlField}), title: String(p.title).trim(), source: "${source}", published: p.isoDate ?? p.published_at ?? p.date ?? null } }));`;

/* Three forum and community feeds: an index of threads, each read as RSS, last day only. */
const feedRow = (n) => [
  schedule(`schedule_${n}`, `${n * 5} 5 * * *`),
  http(`get_feed_${n}`, `='${SOURCES}/forum-${n}/index.json'`, { method: "GET" }),
  splitOut(`split_results_${n}`, "feeds"),
  rss.read(`read_feed_${n}`, "$json.url", { onFail: "continue" }),
  filter(`filter_recent_${n}`, "!!$json.link && !!$json.isoDate && new Date($json.isoDate) >= new Date(Date.now() - 24 * 3600 * 1000)"),
  code(`data_manipulation_${n}`, normalise(`forum-${n}`, "link")),
];
/* Seven industry blogs, each with a listing of its recent posts. */
const blogRow = (n) => [
  schedule(`schedule_${n}`, `${n * 5} 5 * * *`),
  http(`get_blog_${n - FEEDS}`, `='${SOURCES}/blog-${n - FEEDS}/posts.json'`, { method: "GET" }),
  splitOut(`split_results_${n}`, "posts"),
  code(`data_manipulation_${n}`, normalise(`blog-${n - FEEDS}`, "url")),
];
const feedFlow = (n) => [`schedule_${n}`, `get_feed_${n}`, `split_results_${n}`, `read_feed_${n}`, `filter_recent_${n}`, `data_manipulation_${n}`, "set_item"];
const blogFlow = (n) => [`schedule_${n}`, `get_blog_${n - FEEDS}`, `split_results_${n}`, `data_manipulation_${n}`, "set_item"];
const feedRows = Array.from({ length: FEEDS }, (_, i) => i + 1);
const blogRows = Array.from({ length: BLOGS }, (_, i) => i + 1 + FEEDS);
const sourceNodes = [...feedRows.flatMap(feedRow), ...blogRows.flatMap(blogRow)];

const item = "$('for_each_content').first().json";

const LONG = "The central bank held rates steady and signalled two cuts next year. ".repeat(8);
const page = (text = LONG) => ({ __raw: `<html><head><title>T</title><style>p{color:red}</style></head><body><nav>Menu</nav><article><h1>Rates held</h1><p>${text}</p><a href="https://source.example.com/report">the report</a></article><script>track()</script></body></html>`, type: "text/html" });
const posts = (...urls) => ({ posts: urls.map((url, i) => ({ url, title: `Article ${i + 1}`, published_at: new Date().toISOString() })) });
const RELEVANT = { system: "validate-content", json: { output: { relevant: true, topic: "monetary policy", summary: "Rates were held; two cuts are signalled.", reason: "Directly about our readers' market." } } };
const OFF_TOPIC = { system: "validate-content", json: { output: { relevant: false, topic: "sport", summary: "A match report.", reason: "Not our audience." } } };
const A = `${SOURCES}/blog-1/a`;
const B = `${SOURCES}/blog-1/b`;

export default [
  define({
    source: "production",
    id: "scrape-page",
    folder: "production/newsletter-research",
    tier: "block",
    system: "newsletter-research",
    category: "Content and SEO",
    name: "Research · Scrape a page",
    summary: "Called with a URL. Fetches the page and returns its readable text and the links in it. A page that fails to load comes back marked as failed instead of stopping the caller.",
    nodes: [
      called("When called"),
      http("fetch_page", "=$json.url", { method: "GET", onFail: "continue", retry: false }),
      code("extract_text", `const asked = $("When called").all();
return $input.all().map((item, i) => {
  const url = asked[i]?.json.url ?? null;
  const html = typeof item.json.data === "string" ? item.json.data : "";
  if (!html) return { json: { url, ok: false, text: "", links: [], error: String(item.json.error?.message ?? item.json.error ?? "the page returned no HTML") } };
  const links = [...new Set([...html.matchAll(/href="(https?:\\/\\/[^"#]+)"/g)].map((m) => m[1]))].slice(0, 50);
  const text = html
    .replace(/<(script|style|nav|header|footer|aside|head)\\b[\\s\\S]*?<\\/\\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/\\s+/g, " ")
    .trim();
  return { json: { url, ok: text.length > 0, text: text.slice(0, 20000), links } };
});`),
    ],
    flow: [["When called", "fetch_page", "extract_text"]],
    story: [
      { title: "Called with a URL", copy: "The page is requested once. A page that errors or times out is an answer, not a crash.", nodes: ["When called", "fetch_page"] },
      { title: "Text and links come back", copy: "Scripts, styles and navigation are removed and what is left is returned as plain text, with the links found in the page.", nodes: ["extract_text"] },
    ],
    tests: [
      { name: "returns the page's text without scripts, styles or navigation", routes: [{ path: "/page/a", response: page("Rates were held.") }], input: [{ url: "http://mocks:4010/page/a" }], output: { node: "extract_text", json: { ok: true, text: "Rates held Rates were held. the report", links: ["https://source.example.com/report"] } } },
      { name: "a page that fails to load comes back marked as failed", fail: [{ path: "/page/gone", times: 1, status: 404 }], input: [{ url: "http://mocks:4010/page/gone" }], output: { node: "extract_text", json: { ok: false, text: "", url: "http://mocks:4010/page/gone" } } },
    ],
  }),

  define({
    source: "production",
    id: "newsletter-research",
    folder: "production/newsletter-research",
    tier: "flagship",
    system: "newsletter-research",
    category: "Content and SEO",
    name: "Research · Content aggregation engine",
    summary: "Ten sources are checked on their own schedules: forum feeds and industry blogs. Each new article is scraped in full, judged for relevance to the audience by Gemini, and the ones that pass are saved as Markdown in Google Drive and indexed in Supabase for the newsletter.",
    nodes: [
      /* ---- 1. Scrape sources ---- */
      ...sourceNodes,
      set("set_item", {
        url: "$json.url", title: "$json.title", source: "$json.source", published: "$json.published ?? ''",
        date: "$now.toFormat('yyyy-MM-dd')",
        slug: "String($json.url).replace(/^https?:\\/\\//, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 80)",
      }),

      /* ---- 2. Scrape content ---- */
      batches("for_each_content", 1),
      drive.search("get_files", { name: "$json.slug", folder: "research-folder" }),
      iff("skip_existing", "!$json.id"),
      set("set_url", { url: `${item}.url` }),
      call("scrape_url", "scrape-page", { onFail: "continue" }),

      /* ---- 3. Validation ---- */
      iff("filter_scrape_errors", "$json.ok === true && String($json.text ?? '').length >= 200"),
      chain("validate_content", {
        system: "[task:validate-content] You screen articles for a daily industry newsletter. Decide whether this article is relevant to the newsletter's readers: it must be news or analysis about the industry, published recently, and more than an advert or a listing. Give its topic in a few words, a two-sentence summary using only what the article says, and one sentence on why it is or is not relevant.",
        prompt: `'Title: ' + ${item}.title + '\\nSource: ' + ${item}.source + '\\n\\n' + String($json.text).slice(0, 12000)`,
      }, { onFail: "continue" }),
      geminiModel("Google Gemini Chat Model", "validate_content"),
      autofix("content_parser", "validate_content"),
      groqModel("Groq Chat Model", "content_parser"),
      shape("Structured Output Parser", "content_parser", { relevant: true, topic: "A few words", summary: "Two sentences.", reason: "One sentence." }),
      iff("filter_relevant", "$json.output?.relevant === true"),

      /* ---- 4. Store data ---- */
      set("format_markdown", {
        file_name: `${item}.date + ' ' + ${item}.slug + '.md'`,
        markdown: `'# ' + ${item}.title + '\\n\\nSource: ' + ${item}.url + '\\nTopic: ' + $json.output.topic + '\\n\\n## Summary\\n' + $json.output.summary + '\\n\\n## Full text\\n' + $('scrape_url').first().json.text`,
        topic: "$json.output.topic", summary: "$json.output.summary",
        external_urls: "($('scrape_url').first().json.links ?? []).slice(0, 5).join(',')",
      }),
      drive.createText("upload_file", { content: "$json.markdown", as: "$json.file_name", folder: "research-folder" }),
      db.insert("create_object_info", "content_objects", {
        id: `${item}.slug`, date: `${item}.date`, type: "'article'", title: `${item}.title`, url: `${item}.url`, source: `${item}.source`,
        topic: "$('format_markdown').first().json.topic", summary: "$('format_markdown').first().json.summary", external_urls: "$('format_markdown').first().json.external_urls",
        drive_file_id: "$json.id", file_name: "$('format_markdown').first().json.file_name",
      }),
    ],
    flow: [
      ...feedRows.map(feedFlow),
      ...blogRows.map(blogFlow),
      ["set_item", "for_each_content"],
      ["for_each_content:1", "get_files", "skip_existing", "set_url", "scrape_url", "filter_scrape_errors", "validate_content", "filter_relevant", "format_markdown", "upload_file", "create_object_info", "for_each_content"],
      // An article that is dropped hands the loop back, so the next one still runs.
      ["skip_existing:1", "for_each_content"],
      ["filter_scrape_errors:1", "for_each_content"],
      ["filter_relevant:1", "for_each_content"],
    ],
    sections: [
      { title: "Scrape sources", note: "Three forum feeds and seven blogs, each on its own schedule, all put in one shape.", nodes: [...sourceNodes.map((n) => n.name), "set_item"] },
      { title: "Scrape content", note: "One article at a time. An article already in the store is skipped; a new one is fetched in full.", nodes: ["for_each_content", "get_files", "skip_existing", "set_url", "scrape_url"] },
      { title: "Validation", note: "A page that did not load is dropped. A model decides whether the rest is relevant to the audience.", nodes: ["filter_scrape_errors", "validate_content", "filter_relevant"] },
      { title: "Store data", note: "Markdown in Google Drive, an index row in Supabase.", nodes: ["format_markdown", "upload_file", "create_object_info"] },
    ],
    story: [
      { title: "Ten sources, ten schedules", copy: "Each source has its own trigger a few minutes apart, so one slow site never holds up the others.", nodes: sourceNodes.filter((n) => n.name.startsWith("schedule_")).map((n) => n.name) },
      { title: "Forum feeds", copy: "For the three forums, an index of threads is fetched, each thread is read as RSS, and only items from the last day are kept.", nodes: feedRows.flatMap((n) => [`get_feed_${n}`, `split_results_${n}`, `read_feed_${n}`, `filter_recent_${n}`, `data_manipulation_${n}`]) },
      { title: "Industry blogs", copy: "For the seven blogs, the listing of recent posts is fetched and split into single articles.", nodes: blogRows.flatMap((n) => [`get_blog_${n - FEEDS}`, `split_results_${n}`, `data_manipulation_${n}`]) },
      { title: "One shape for every source", copy: "Whatever the source, an article becomes the same record: address, title, source, date and a file-safe name.", nodes: ["set_item"] },
      { title: "Already stored?", copy: "Articles are taken one at a time. Google Drive is searched for the article's file name, and one that is already there is skipped.", nodes: ["for_each_content", "get_files", "skip_existing"] },
      { title: "The full article is fetched", copy: "A headline is not enough to judge by. The page is scraped for its full text and the links it cites.", nodes: ["set_url", "scrape_url"] },
      { title: "Did the page load?", copy: "A page that failed, or came back with too little text to be an article, is dropped and the loop moves on.", nodes: ["filter_scrape_errors"] },
      { title: "A model judges relevance", copy: "Gemini reads the article and says whether it belongs in the newsletter, with a topic and a short summary. If its answer is not in the required shape, a second model on Groq repairs it.", nodes: ["validate_content", "Google Gemini Chat Model", "content_parser", "Groq Chat Model", "Structured Output Parser"] },
      { title: "Only relevant articles go on", copy: "An article judged off-topic is dropped. If the model is down, the article is dropped too: nothing is stored on a guess.", nodes: ["filter_relevant"] },
      { title: "Saved for the newsletter", copy: "The article becomes a Markdown file in Google Drive, and a row in Supabase records its date, topic, summary, links and where the file is.", nodes: ["format_markdown", "upload_file", "create_object_info"] },
    ],
    tests: [
      {
        name: "a relevant article is scraped, saved to Drive and indexed",
        entry: "schedule_4",
        routes: [{ path: "feeds.acme.example/blog-1/posts.json", response: posts(A) }, { path: "feeds.acme.example/blog-1/a", response: page() }],
        llm: [RELEVANT],
        input: [{}],
        ran: ["upload_file"],
        calls: [{ to: "googleDrive", path: "/upload/drive/v3/files", method: "POST" }],
        table: { content_objects: [{ id: "feeds-acme-example-blog-1-a", type: "article", title: "Article 1", source: "blog-1", topic: "monetary policy", external_urls: "https://source.example.com/report" }] },
      },
      {
        name: "an off-topic article is dropped and the next one still runs",
        entry: "schedule_4",
        routes: [{ path: "feeds.acme.example/blog-1/posts.json", response: posts(A, B) }, { path: "feeds.acme.example/blog-1/a", response: page() }, { path: "feeds.acme.example/blog-1/b", response: page() }],
        llm: [OFF_TOPIC, RELEVANT],
        input: [{}],
        callCount: { "/upload/drive/v3/files": 1, "/rest/v1/content_objects": 1 },
        table: { content_objects: [{ id: "feeds-acme-example-blog-1-b" }] },
      },
      {
        name: "an article already in the store is not scraped again",
        entry: "schedule_4",
        seed: { drive_files: [{ id: "f1", name: "2026-10-12 feeds-acme-example-blog-1-a.md", content: "x" }] },
        routes: [{ path: "feeds.acme.example/blog-1/posts.json", response: posts(A) }],
        input: [{}],
        notRan: ["scrape_url", "validate_content"],
        noCalls: ["gemini", "/upload/drive/v3/files"],
      },
      {
        name: "a page that fails to load is skipped and the next one still runs",
        entry: "schedule_4",
        routes: [{ path: "feeds.acme.example/blog-1/posts.json", response: posts(A, B) }, { path: "feeds.acme.example/blog-1/b", response: page() }],
        fail: [{ path: "/blog-1/a", times: 1, status: 500 }],
        llm: [RELEVANT],
        input: [{}],
        callCount: { "gemini": 1 },
        table: { content_objects: [{ id: "feeds-acme-example-blog-1-b" }] },
      },
      {
        name: "nothing is stored when the model is down",
        entry: "schedule_4",
        routes: [{ path: "feeds.acme.example/blog-1/posts.json", response: posts(A) }, { path: "feeds.acme.example/blog-1/a", response: page() }],
        fail: [{ path: "/v1beta/models", times: 20 }],
        input: [{}],
        notRan: ["upload_file", "create_object_info"],
      },
      {
        name: "an answer in the wrong shape is repaired by the second model",
        entry: "schedule_4",
        routes: [{ path: "feeds.acme.example/blog-1/posts.json", response: posts(A) }, { path: "feeds.acme.example/blog-1/a", response: page() }],
        llm: [{ system: "validate-content", text: "Yes, this one is relevant!" }, { last: "^Instructions:", json: { output: { relevant: true, topic: "monetary policy", summary: "Rates were held.", reason: "On topic." } } }],
        input: [{}],
        callCount: { groq: 1 },
        table: { content_objects: [{ topic: "monetary policy" }] },
      },
      {
        name: "a forum feed keeps only the last day's items",
        entry: "schedule_1",
        routes: [
          { path: "feeds.acme.example/forum-1/index.json", response: { feeds: [{ url: `${SOURCES}/forum-1/thread.xml` }] } },
          { path: "feeds.acme.example/forum-1/thread.xml", response: { type: "application/rss+xml", __raw: `<?xml version="1.0"?><rss version="2.0"><channel><title>Forum</title><link>${SOURCES}</link><description>d</description><item><title>Fresh thread</title><link>${SOURCES}/forum-1/fresh</link><guid>fresh</guid><pubDate>${new Date(Date.now() - 3600e3).toUTCString()}</pubDate></item><item><title>Old thread</title><link>${SOURCES}/forum-1/old</link><guid>old</guid><pubDate>${new Date(Date.now() - 5 * 864e5).toUTCString()}</pubDate></item></channel></rss>` } },
          { path: "feeds.acme.example/forum-1/fresh", response: page() },
        ],
        llm: [RELEVANT],
        input: [{}],
        output: { node: "set_item", json: { title: "Fresh thread", source: "forum-1" } },
        callCount: { "/rest/v1/content_objects": 1 },
        table: { content_objects: [{ id: "feeds-acme-example-forum-1-fresh", source: "forum-1" }] },
      },
    ],
  }),
];
