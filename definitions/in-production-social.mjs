/**
 * Built and run in production, rebuilt here for publication: the social media
 * and publishing workflows of a media group.
 *
 * Node names, order, branches and loops follow the original canvases. The
 * prompts, the brand profiles and the feeds were written again for this
 * library: the three media brands below are placeholders.
 */
import { batches, set, filter, iff, route, form, limit, extractText, define } from "../lib/wf.mjs";
import { telegram, rss, gemini, apify, wix, triggers, chain, geminiModel, groqModel, autofix, shape } from "../lib/nodes.mjs";

const real = { source: "production", tier: "production", category: "Content and SEO" };

/* ---- The brands a request can be for. Each has its own voice, look and feed. ---- */
const BRANDS = [
  { name: "Northwind Daily", voice: "Plain, fast, general news. Short sentences. No slang.", look: "Bold editorial photo style, navy and white, headline space at the top.", feed: "https://feeds.acme.example/northwind.xml", tags: "#news #daily" },
  { name: "Harbor Finance", voice: "Measured and precise. Numbers first. Never hype.", look: "Clean chart-led graphic, dark green and cream.", feed: "https://feeds.acme.example/harbor.xml", tags: "#markets #finance" },
  { name: "Circuit Weekly", voice: "Curious and a little playful. Explains the tech in one line.", look: "Bright flat illustration, electric blue and orange.", feed: "https://feeds.acme.example/circuit.xml", tags: "#tech #ai" },
];
const brandRules = Object.fromEntries(BRANDS.map((b) => [b.name, `$json['Media house'] === '${b.name}'`]));
const brandNode = (b, i) => set(`mediahouse_${i + 1}`, { brand: `'${b.name}'`, voice: `'${b.voice}'`, look: `'${b.look}'`, feed: `'${b.feed}'`, tags: `'${b.tags}'` });
const brandFlow = (next) => BRANDS.flatMap((_, i) => [[`switch_mediahouse:${i}`, `mediahouse_${i + 1}`, next]]);

const CAPTION_RULES = "You write one social media caption for a media brand. Follow the brand voice you are given exactly. Under 600 characters, one idea, no invented facts, no quotation marks around the whole caption. End with the brand's hashtags. Reply with the caption only.";
const caption = "String($('generate_caption').first().json.content?.parts?.[0]?.text ?? '').trim()";
/** The check the workflow runs on its own output before a person sees it. */
const VALID = `${caption}.length > 0 && ${caption}.length <= 2200 && !/as an ai|i cannot|i can't/i.test(${caption}) && !!$binary.data`;

const rssFeed = (items) => ({
  type: "application/rss+xml",
  __raw: `<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title><link>https://feeds.acme.example</link><description>Test feed</description>${items.map((i) => `<item><title>${i.title}</title><link>${i.link}</link><guid>${i.link}</guid><pubDate>Tue, 13 Oct 2026 08:00:00 GMT</pubDate><description>${i.text ?? i.title}</description></item>`).join("")}</channel></rss>`,
});
const NEWS = [{ title: "Markets close higher", link: "https://feeds.acme.example/a1", text: "Stocks rose for a third day." }, { title: "New chip announced", link: "https://feeds.acme.example/a2", text: "A faster chip was shown." }, { title: "Port expansion approved", link: "https://feeds.acme.example/a3", text: "The council voted yes." }];
const CAPTION = { system: "social-caption", text: "Stocks rose for a third day. Here is what moved. #news #daily", times: 9 };
const PHOTO = "telegram /bot100000:test-telegram/sendPhoto";
const GEMINI_TEXT = "gemini /v1beta/models/gemini-2.5-flash:generateContent";
const GEMINI_IMAGE = "gemini /v1beta/models/gemini-2.5-flash-image:generateContent";

const BLOG = { title: "What the funding round means", excerpt: "A short read on the week's biggest round.", body: "The round closed on Monday.\n\nHere is why it matters.\n\nWatch the walkthrough below.", video_url: "https://youtube.example/watch?v=v1" };
const mdUpload = (file_name = "2026-10-13 funding.md") => ({ message: { message_id: 7, chat: { id: 1 }, document: { file_id: "tg-file-1", file_name, mime_type: "text/markdown" } } });

export default [
  define({
    ...real,
    folder: "production/social-content",
    id: "social-content-engine",
    name: "Social · News to social content engine",
    summary: "A form request picks a media brand. The workflow applies that brand's voice, reads its news feed, and for each article drafts a caption and an image with Gemini, checks its own output, and sends the draft to the social manager on Telegram. Approved moves to the next article; rejected is drafted again.",
    nodes: [
      form("submit_form", { title: "Create social posts from today's news", fields: [{ label: "Media house", type: "dropdown", options: BRANDS.map((b) => b.name), required: true }, { label: "How many posts", type: "number", required: true }] }),
      route("switch_mediahouse", brandRules),
      ...BRANDS.map(brandNode),
      set("store_temp", { brand: "$json.brand", voice: "$json.voice", look: "$json.look", feed: "$json.feed", tags: "$json.tags", max_posts: "Math.min(Math.max(Number($('submit_form').first().json['How many posts']) || 3, 1), 10)" }),
      rss.read("get_news", "$json.feed"),
      limit("limit_output", "Number($('store_temp').first().json.max_posts)"),
      batches("for_each_news", 1),
      gemini.text("generate_caption", { system: `[task:social-caption] ${CAPTION_RULES}`, prompt: "'Brand: ' + $('store_temp').first().json.brand + '\\nVoice: ' + $('store_temp').first().json.voice + '\\nHashtags: ' + $('store_temp').first().json.tags + '\\n\\nHeadline: ' + $('for_each_news').first().json.title + '\\nSummary: ' + String($('for_each_news').first().json.contentSnippet ?? '').slice(0, 1500)" }),
      gemini.image("generate_image", "'A social media graphic for the news story: ' + $('for_each_news').first().json.title + '. Style: ' + $('store_temp').first().json.look + ' No text in the image.'"),
      iff("if_valid", VALID),
      telegram.photo("send_image"),
      telegram.send("send_caption", `${caption} + '\\n\\n' + $('for_each_news').first().json.link`),
      telegram.approval("wait_approval", "'Post this for ' + $('store_temp').first().json.brand + '?'"),
      iff("if_approved", "$json.data?.approved === true"),
      filter("timeout", "$json.data?.approved === false"),
      { ...telegram.send("send_done", "'Done. Every article in this batch for ' + $('store_temp').first().json.brand + ' has an approved post.'"), executeOnce: true },
    ],
    flow: [
      ["submit_form", "switch_mediahouse"],
      ...brandFlow("store_temp"),
      ["store_temp", "get_news", "limit_output", "for_each_news"],
      ["for_each_news:1", "generate_caption", "generate_image", "if_valid", "send_image", "send_caption", "wait_approval", "if_approved", "for_each_news"],
      ["if_valid:1", "generate_caption"],
      ["if_approved:1", "timeout", "generate_caption"],
      ["for_each_news:0", "send_done"],
    ],
    sections: [
      { title: "Generate news", nodes: ["submit_form", "switch_mediahouse", "mediahouse_1", "mediahouse_2", "mediahouse_3", "store_temp", "get_news", "limit_output"] },
      { title: "Generate result", nodes: ["for_each_news", "generate_caption", "generate_image", "if_valid", "send_done"] },
      { title: "Human in the loop", nodes: ["send_image", "send_caption", "wait_approval", "if_approved", "timeout"] },
    ],
    story: [
      { title: "A request names the brand", copy: "The form asks which media house the posts are for and how many. The switch sends the request to that brand's profile: its voice, its visual style, its hashtags and its feed.", nodes: ["submit_form", "switch_mediahouse", "mediahouse_1", "mediahouse_2", "mediahouse_3", "store_temp"] },
      { title: "The news is fetched", copy: "The brand's feed is read and cut to the number of posts asked for.", nodes: ["get_news", "limit_output"] },
      { title: "One article at a time", copy: "Each article gets a caption in the brand's voice and an image in its style, both from Gemini.", nodes: ["for_each_news", "generate_caption", "generate_image"] },
      { title: "It checks its own work", copy: "An empty caption, one that is too long, a refusal or a missing image never reaches a person. The draft is made again.", nodes: ["if_valid"] },
      { title: "A person decides", copy: "The image and the caption arrive on Telegram with Approve and Decline. The run waits for the answer.", nodes: ["send_image", "send_caption", "wait_approval"] },
      { title: "Approved moves on, rejected is redone", copy: "Approval moves to the next article. A rejection goes back to Gemini for a new draft of the same article. An unanswered request ends the run instead of looping.", nodes: ["if_approved", "timeout", "send_done"] },
    ],
    tests: [
      {
        name: "drafts each article and moves on when approved",
        routes: [{ path: "feeds.acme.example/northwind.xml", response: rssFeed(NEWS) }],
        llm: [CAPTION],
        input: [{ "Media house": "Northwind Daily", "How many posts": 2 }],
        ran: ["send_done"],
        callCount: { [PHOTO]: 2, [GEMINI_TEXT]: 2, [GEMINI_IMAGE]: 2 },
        calls: [{ to: "telegram", body: { text: "Stocks rose for a third day. Here is what moved. #news #daily\n\nhttps://feeds.acme.example/a1" } }],
      },
      {
        name: "a rejected draft is made again for the same article",
        routes: [{ path: "feeds.acme.example/northwind.xml", response: rssFeed(NEWS) }],
        seed: { telegram_replies: [{ approve: false }, { approve: true }] },
        llm: [CAPTION],
        input: [{ "Media house": "Northwind Daily", "How many posts": 1 }],
        ran: ["timeout", "send_done"],
        callCount: { [PHOTO]: 2, [GEMINI_TEXT]: 2 },
      },
      {
        name: "an empty caption is redone before anyone sees it",
        routes: [{ path: "feeds.acme.example/northwind.xml", response: rssFeed(NEWS) }],
        llm: [{ system: "social-caption", text: "" }, CAPTION],
        input: [{ "Media house": "Northwind Daily", "How many posts": 1 }],
        callCount: { [PHOTO]: 1, [GEMINI_TEXT]: 2 },
      },
      {
        name: "each brand reads its own feed with its own voice",
        routes: [{ path: "feeds.acme.example/harbor.xml", response: rssFeed(NEWS.slice(0, 1)) }],
        llm: [CAPTION],
        input: [{ "Media house": "Harbor Finance", "How many posts": 1 }],
        ran: ["mediahouse_2"],
        notRan: ["mediahouse_1", "mediahouse_3"],
        output: { node: "store_temp", json: { brand: "Harbor Finance", tags: "#markets #finance" } },
        calls: [{ to: "rss", path: "/harbor.xml" }],
      },
    ],
  }),

  define({
    ...real,
    folder: "production/social-content",
    id: "social-post-on-demand",
    name: "Social · On-demand post generator",
    summary: "A form takes a topic, a prompt or a link and a media brand. The workflow applies the brand's voice, keeps the link as the post's source, drafts a caption and an image with Gemini, checks them, and sends them to Telegram for approval. A rejection produces a new image.",
    nodes: [
      form("submit_form", { title: "Create one social post", fields: [{ label: "Media house", type: "dropdown", options: BRANDS.map((b) => b.name), required: true }, { label: "Topic, prompt or link", type: "textarea", required: true }] }),
      route("switch_mediahouse", brandRules),
      ...BRANDS.map(brandNode),
      set("store_temp", {
        brand: "$json.brand", voice: "$json.voice", look: "$json.look", tags: "$json.tags",
        request: "String($('submit_form').first().json['Topic, prompt or link'] ?? '').trim()",
        source_url: "(String($('submit_form').first().json['Topic, prompt or link'] ?? '').match(/https?:\\/\\/[^\\s]+/) ?? [''])[0]",
        kind: "/https?:\\/\\//.test(String($('submit_form').first().json['Topic, prompt or link'] ?? '')) ? 'article' : 'custom'",
      }),
      gemini.text("generate_caption", { system: `[task:social-caption] ${CAPTION_RULES} If a source link is given, the post is about that article: say so and end with the link on its own line.`, prompt: "'Brand: ' + $('store_temp').first().json.brand + '\\nVoice: ' + $('store_temp').first().json.voice + '\\nHashtags: ' + $('store_temp').first().json.tags + '\\nSource link: ' + ($('store_temp').first().json.source_url || 'none') + '\\n\\nRequest: ' + $('store_temp').first().json.request" }),
      gemini.image("generate_image", "'A social media graphic for: ' + $('store_temp').first().json.request.slice(0, 400) + '. Style: ' + $('store_temp').first().json.look + ' No text in the image.'"),
      iff("if_valid", VALID),
      telegram.photo("send_image"),
      telegram.send("send_caption", `${caption} + ($('store_temp').first().json.source_url && !${caption}.includes($('store_temp').first().json.source_url) ? '\\n\\n' + $('store_temp').first().json.source_url : '')`),
      telegram.approval("wait_approval", "'Post this for ' + $('store_temp').first().json.brand + '?'"),
      iff("if_approved", "$json.data?.approved === true"),
      filter("timeout", "$json.data?.approved === false"),
    ],
    flow: [
      ["submit_form", "switch_mediahouse"],
      ...brandFlow("store_temp"),
      ["store_temp", "generate_caption", "generate_image", "if_valid", "send_image", "send_caption", "wait_approval", "if_approved"],
      ["if_valid:1", "generate_caption"],
      ["if_approved:1", "timeout", "generate_image"],
    ],
    sections: [
      { title: "Input", nodes: ["submit_form", "switch_mediahouse", "mediahouse_1", "mediahouse_2", "mediahouse_3", "store_temp"] },
      { title: "Generate result", nodes: ["generate_caption", "generate_image", "if_valid"] },
      { title: "Human in the loop", nodes: ["send_image", "send_caption", "wait_approval", "if_approved", "timeout"] },
    ],
    story: [
      { title: "A topic, a prompt or a link", copy: "The form takes the request and the media house. The switch applies that brand's voice and visual style.", nodes: ["submit_form", "switch_mediahouse", "mediahouse_1", "mediahouse_2", "mediahouse_3"] },
      { title: "A link is kept as the source", copy: "If the request holds a link, it is pulled out, the post is marked as an article, and the link goes into the caption.", nodes: ["store_temp"] },
      { title: "Caption and image", copy: "Gemini drafts the caption and a matching image, and the workflow checks both before going further.", nodes: ["generate_caption", "generate_image", "if_valid"] },
      { title: "A person decides", copy: "The draft goes to the social manager on Telegram. Approval ends the run with the post ready. A rejection produces a new image for the same caption.", nodes: ["send_image", "send_caption", "wait_approval", "if_approved", "timeout"] },
    ],
    tests: [
      {
        name: "drafts a post from a topic and stops when approved",
        llm: [CAPTION],
        input: [{ "Media house": "Circuit Weekly", "Topic, prompt or link": "Why small language models are getting good" }],
        output: { node: "store_temp", json: { brand: "Circuit Weekly", kind: "custom", source_url: "" } },
        callCount: { [PHOTO]: 1, [GEMINI_TEXT]: 1, [GEMINI_IMAGE]: 1 },
        notRan: ["timeout"],
      },
      {
        name: "a link becomes the post's source and goes into the caption",
        llm: [{ system: "social-caption", text: "A new port is coming. #news #daily" }],
        input: [{ "Media house": "Northwind Daily", "Topic, prompt or link": "Cover this please https://news.example.com/port-expansion today" }],
        output: { node: "store_temp", json: { kind: "article", source_url: "https://news.example.com/port-expansion" } },
        calls: [{ to: "telegram", body: { text: "A new port is coming. #news #daily\n\nhttps://news.example.com/port-expansion" } }],
      },
      {
        name: "a rejection draws a new image for the same caption",
        seed: { telegram_replies: [{ approve: false }, { approve: true }] },
        llm: [CAPTION],
        input: [{ "Media house": "Harbor Finance", "Topic, prompt or link": "Rates held steady" }],
        ran: ["timeout"],
        callCount: { [PHOTO]: 2, [GEMINI_IMAGE]: 2, [GEMINI_TEXT]: 1 },
      },
      {
        name: "a refusal from the model is redone before anyone sees it",
        llm: [{ system: "social-caption", text: "As an AI I cannot write that." }, CAPTION],
        input: [{ "Media house": "Harbor Finance", "Topic, prompt or link": "Rates held steady" }],
        callCount: { [PHOTO]: 1, [GEMINI_TEXT]: 2 },
      },
    ],
  }),

  define({
    ...real,
    folder: "production/social-content",
    id: "rss-to-caption",
    name: "Social · RSS to caption",
    summary: "Watches an RSS feed. Each new article is turned into a summary-style caption by Gemini and sent to the social manager's Telegram, followed by the source link, ready to copy and post.",
    nodes: [
      triggers.rss("get_recent_news", "https://feeds.acme.example/news.xml"),
      filter("does_exist", "!!$json.link && !!($json.title || $json.contentSnippet)"),
      batches("for_each_news", 1),
      gemini.text("generate_caption", { system: "[task:social-caption] You turn a news article into one summary-style social media caption. Under 500 characters, the main fact first, no invented details, no link. Reply with the caption only.", prompt: "'Headline: ' + $('for_each_news').first().json.title + '\\n\\n' + String($('for_each_news').first().json.contentSnippet ?? $('for_each_news').first().json.content ?? '').slice(0, 3000)" }),
      telegram.send("send_caption", "String($json.content?.parts?.[0]?.text ?? '').trim() || $('for_each_news').first().json.title"),
      telegram.send("send_source", "$('for_each_news').first().json.link"),
    ],
    flow: [["get_recent_news", "does_exist", "for_each_news:1", "generate_caption", "send_caption", "send_source", "for_each_news"]],
    sections: [
      { title: "RSS", nodes: ["get_recent_news", "does_exist"] },
      { title: "Generate content", nodes: ["for_each_news", "generate_caption", "send_caption", "send_source"] },
    ],
    story: [
      { title: "The feed is watched", copy: "The trigger fires only for items it has not seen. An item with no link or no text is dropped.", nodes: ["get_recent_news", "does_exist"] },
      { title: "A caption per article", copy: "Each article goes to Gemini, which writes a short summary-style caption.", nodes: ["for_each_news", "generate_caption"] },
      { title: "Delivered to Telegram", copy: "The caption arrives first and the source link straight after it, as two messages, so each can be copied on its own.", nodes: ["send_caption", "send_source"] },
    ],
    tests: [
      {
        name: "sends a caption, then the source link, for each new article",
        llm: [{ system: "social-caption", text: "Stocks rose for a third day.", times: 3 }],
        input: [{ title: "Markets close higher", link: "https://feeds.acme.example/a1", contentSnippet: "Stocks rose for a third day." }, { title: "New chip announced", link: "https://feeds.acme.example/a2", contentSnippet: "A faster chip was shown." }],
        callCount: { [GEMINI_TEXT]: 2, "telegram /bot100000:test-telegram/sendMessage": 4 },
        calls: [{ to: "telegram", body: { text: "Stocks rose for a third day." } }, { to: "telegram", body: { text: "https://feeds.acme.example/a1" } }, { to: "telegram", body: { text: "https://feeds.acme.example/a2" } }],
      },
      {
        name: "an item with no link is dropped",
        llm: [{ system: "social-caption", text: "A caption.", times: 3 }],
        input: [{ title: "No link here", contentSnippet: "Text." }, { title: "Good item", link: "https://feeds.acme.example/a3", contentSnippet: "Text." }],
        callCount: { [GEMINI_TEXT]: 1, "telegram /bot100000:test-telegram/sendMessage": 2 },
      },
      {
        name: "an empty reply from the model sends the headline instead",
        llm: [{ system: "social-caption", text: "" }],
        input: [{ title: "Port expansion approved", link: "https://feeds.acme.example/a3", contentSnippet: "The council voted yes." }],
        calls: [{ to: "telegram", body: { text: "Port expansion approved" } }, { to: "telegram", body: { text: "https://feeds.acme.example/a3" } }],
      },
    ],
  }),

  define({
    ...real,
    folder: "production/publishing",
    id: "blog-conversion",
    name: "Publishing · Markdown to blog draft",
    summary: "A Markdown file sent to a Telegram bot is turned into a blog post. Gemini restructures the notes, picks a recent YouTube video fetched through Apify to embed, and works in the promotion of the week. The post is saved to Wix as a draft for an editor to review.",
    nodes: [
      triggers.telegram("get_file"),
      filter("check_file", "!!$json.message?.document && /\\.(md|markdown)$/i.test($json.message.document.file_name ?? '')"),
      telegram.file("download_md", "$json.message.document.file_id"),
      extractText("extract_md", "markdown"),
      apify.scrape("get_latest_yt_videos", "acme~youtube-latest-videos", { alwaysOutput: true }),
      chain("generate_content", {
        system: "[task:blog-convert] You turn internal research notes into a blog post for the public site. Keep every fact and add none. Give it a clear title, a two-sentence excerpt and a body of short paragraphs separated by blank lines. From the list of recent videos choose the one most relevant to the post and return its URL as video_url, or an empty string if none fits. Work this promotion into one paragraph near the end, in the post's own tone: 'Join the weekly briefing: one email, every Friday.'",
        prompt: "'Research notes:\\n' + $('extract_md').first().json.markdown + '\\n\\nRecent videos:\\n' + $('get_latest_yt_videos').all().map((i) => i.json).filter((v) => v.url).map((v) => '- ' + v.title + ' (' + v.url + ')').join('\\n')",
      }, { once: true }),
      geminiModel("Google Gemini Chat Model", "generate_content"),
      autofix("blog_parser", "generate_content"),
      groqModel("Groq Chat Model", "blog_parser"),
      shape("Structured Output Parser", "blog_parser", { title: "The post's title", excerpt: "Two sentences.", body: "Paragraph one.\n\nParagraph two.", video_url: "https://www.youtube.com/watch?v=..." }),
      wix.draft("draft_wix", "{ draftPost: { title: $json.output.title, excerpt: $json.output.excerpt, richContent: { nodes: String($json.output.body ?? '').split('\\n\\n').filter((text) => text.trim()).map((text) => ({ type: 'PARAGRAPH', nodes: [ { type: 'TEXT', textData: { text: text.trim() } } ] })).concat($json.output.video_url ? [ { type: 'VIDEO', videoData: { video: { src: { url: $json.output.video_url } } } } ] : []) } }, publish: false }"),
    ],
    flow: [["get_file", "check_file", "download_md", "extract_md", "get_latest_yt_videos", "generate_content", "draft_wix"]],
    story: [
      { title: "A file is sent to the bot", copy: "An editor sends a Markdown file to the Telegram bot. Anything that is not a Markdown file is ignored.", nodes: ["get_file", "check_file"] },
      { title: "The text is read", copy: "The file is downloaded from Telegram and its text extracted.", nodes: ["download_md", "extract_md"] },
      { title: "Recent videos are fetched", copy: "An Apify task returns the channel's latest YouTube videos, so the post can embed one that fits.", nodes: ["get_latest_yt_videos"] },
      { title: "The post is written", copy: "Gemini restructures the notes into a title, an excerpt and a body, chooses a video and works the promotion in. If its answer is not in the required shape, a second model on Groq repairs it.", nodes: ["generate_content", "Google Gemini Chat Model", "blog_parser", "Groq Chat Model", "Structured Output Parser"] },
      { title: "Saved as a draft", copy: "The post goes to Wix as a draft. Nothing is published until an editor has read it.", nodes: ["draft_wix"] },
    ],
    tests: [
      {
        name: "turns an uploaded Markdown file into a Wix draft with a video",
        seed: { telegram_files: [{ name: "2026-10-13 funding.md", content: "# Funding\nThe round closed on Monday." }], "apify_acme~youtube-latest-videos": [{ title: "Funding walkthrough", url: "https://youtube.example/watch?v=v1" }, { title: "Unrelated vlog", url: "https://youtube.example/watch?v=v2" }] },
        llm: [{ system: "blog-convert", json: { output: BLOG } }],
        input: [mdUpload()],
        output: { node: "extract_md", json: { markdown: "# Funding\nThe round closed on Monday." } },
        calls: [{ to: "wix", path: "/blog/v3/draft-posts", body: { publish: false, draftPost: { title: "What the funding round means", richContent: { nodes: [{ type: "PARAGRAPH", nodes: [{ textData: { text: "Here is why it matters." } }] }, { type: "VIDEO", videoData: { video: { src: { url: "https://youtube.example/watch?v=v1" } } } }] } } } }],
        callCount: { groq: 0 },
      },
      {
        name: "ignores a file that is not Markdown",
        input: [mdUpload("holiday-photo.png")],
        noCalls: ["wix", "gemini", "apify"],
        notRan: ["download_md"],
      },
      {
        name: "a reply in the wrong shape is repaired by the second model",
        seed: { telegram_files: [{ name: "notes.md", content: "# Notes\nBody." }], "apify_acme~youtube-latest-videos": [] },
        llm: [{ system: "blog-convert", text: "Sure, here is your blog post! It is about funding." }, { last: "^Instructions:", json: { output: { ...BLOG, video_url: "" } } }],
        input: [mdUpload("notes.md")],
        callCount: { groq: 1 },
        calls: [{ to: "wix", path: "/blog/v3/draft-posts", body: { draftPost: { title: "What the funding round means" } } }],
      },
      {
        name: "still drafts the post when no videos come back",
        seed: { telegram_files: [{ name: "notes.md", content: "# Notes\nBody." }] },
        llm: [{ system: "blog-convert", json: { output: { ...BLOG, video_url: "" } } }],
        input: [mdUpload("notes.md")],
        calls: [{ to: "wix", path: "/blog/v3/draft-posts", body: { draftPost: { excerpt: "A short read on the week's biggest round." } } }],
      },
    ],
  }),
];
