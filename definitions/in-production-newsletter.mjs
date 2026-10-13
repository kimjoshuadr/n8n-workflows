/**
 * Built and run in production, rebuilt here for publication: the workflow that
 * drafts a daily newsletter with an editor in the loop.
 *
 * It starts from the day's research (Markdown in Google Drive, indexed in
 * Supabase, put there by the research engine), proposes the top stories and a
 * subject line, takes the editor's written feedback on each over Telegram until
 * they approve, then writes every story, an intro and a round-up, and delivers
 * the draft as a file with a summary.
 *
 * Section names, node names and wiring follow the original canvas, which was
 * photographed in pieces. The prompts, the answer shapes and the table and
 * folder names were written again for this library. Gemini and Groq are the
 * models named on the sister workflow's canvas; this one's model nodes were out
 * of frame.
 */
import { batches, set, filter, iff, splitOut, aggregate, code, form, call, extractText, toTextFile, define } from "../lib/wf.mjs";
import { db, drive, telegram, chain, extractor, geminiModel, groqModel, autofix, shape } from "../lib/nodes.mjs";

const FOLDER = "research-folder";
const date = "$('submit_form').first().json['Newsletter date']";
const stories = "$('set_current_stories').first().json";
const subject = "$('set_current_subject_line').first().json";
const segment = "$('set_current_segment').first().json";
const research = "$('combine_markdown_content').first().json.research";

const EDITOR = "You are the editor of a daily industry newsletter. Use only what is in the research you are given: never add a fact, a number or a quote that is not there.";
const READ_FEEDBACK = "[task:read-feedback] Read the editor's reply to a proposal. approved is true only when they accept it as it is, with nothing they want changed. Otherwise approved is false and feedback is what they want changed, in their words.";

const CHAINS = ["pick_top_stories", "edit_top_stories", "write_subject_line", "edit_subject_line", "write_segment_content", "extract_image_urls", "write_intro", "write_other_top_stories"];
const STORY = { title: "The story's headline", content_ids: ["id-of-a-research-document"], external_urls: ["https://a-source-worth-reading"], why: "One sentence on why it leads." };

/* ---- test data ---- */
const DAY = "2026-10-13";
const doc = (id, title, text, more = {}) => ({ row: { id, date: DAY, type: "article", title, url: `https://news.example.com/${id}`, summary: text, external_urls: "", drive_file_id: `file-${id}`, file_name: `${DAY} ${id}.md`, ...more }, file: { id: `file-${id}`, name: `${DAY} ${id}.md`, content: `# ${title}\n\n${text}` } });
const RATES = doc("doc-rates", "Rates held", "The central bank held rates steady.");
const CHIP = doc("doc-chip", "Chip launch", "A faster chip was shown on Monday.");
const PORT = doc("doc-port", "Port expansion", "The council approved the port expansion.");
const store = (...docs) => ({ content_objects: docs.map((d) => d.row), drive_files: docs.map((d) => d.file) });
const pick = (...list) => ({ output: { stories: list.map(([d, urls = []]) => ({ title: d.row.title, content_ids: [d.row.id], external_urls: urls, why: "It leads the day." })), reasoning: "These are the clearest stories in today's research." } });
const PICK = { system: "pick-stories", json: pick([RATES], [CHIP]) };
const APPROVED = { system: "read-feedback", json: { approved: true, feedback: "" }, times: 4 };
const SUBJECT = { system: "task:subject-line", json: { output: { subject_line: "Rates hold, chips fly", preheader: "Two stories to start the day.", reasoning: "Short and concrete." } } };
const SEGMENT = { system: "write-segment", json: { output: { headline: "Rates stay where they are", body: "The central bank held rates steady.", sources: ["https://news.example.com/doc-rates"] } }, times: 6 };
const IMAGES = { system: "image-urls", json: { output: { image_urls: [] } }, times: 6 };
const INTRO = { system: "write-intro", json: { output: { intro: "Good morning. Two things matter today." } } };
const OTHER = { system: "other-stories", json: { output: { items: [{ title: "Port expansion", url: "https://news.example.com/doc-port", line: "The council said yes." }] } } };
const WRITING = [SUBJECT, SEGMENT, IMAGES, INTRO, OTHER];
const request = [{ "Newsletter date": DAY, "Focus for this issue": "" }];
const yes = { text: "Approve" };
const DOCUMENT = "telegram /bot100000:test-telegram/sendDocument";

export default [
  define({
    source: "production",
    id: "newsletter-drafting",
    folder: "production/newsletter-drafting",
    tier: "flagship",
    system: "newsletter-drafting",
    category: "Content and SEO",
    name: "Newsletter · AI drafting engine",
    summary: "For a chosen date, gathers that day's stored research, proposes the top stories and a subject line, and takes the editor's written feedback on each over Telegram until they approve. It then writes each story from its research and outside sources, adds an intro and a round-up, and sends the editor a draft file with a summary.",
    nodes: [
      /* ---- 1. Retrieve Markdown content ---- */
      form("submit_form", { title: "Draft a newsletter", description: "Drafts the issue for one date from that day's research.", fields: [{ label: "Newsletter date", type: "date", required: true }, { label: "Focus for this issue", type: "textarea" }] }),
      drive.search("get_files", { name: "$json['Newsletter date']", folder: FOLDER }),
      filter("filter_only_markdown", "String($json.name ?? '').endsWith('.md')"),
      db.find("get_markdown_object_info", "content_objects", { date }, { once: true }),
      filter("exclude_newsletters", "$json.type !== 'newsletter' && !!$json.drive_file_id && $('filter_only_markdown').all().some((f) => f.json.id === $json.drive_file_id)"),
      drive.download("download_markdown_object", "$json.drive_file_id"),
      extractText("get_markdown_file_content"),
      set("prepare_markdown_content", { content_id: "$('exclude_newsletters').item.json.id", title: "$('exclude_newsletters').item.json.title", url: "$('exclude_newsletters').item.json.url", text: "$json.text" }),
      aggregate("aggregate_markdown_content", "items"),
      set(
        "combine_markdown_content",
        {
          date,
          focus: "String($('submit_form').first().json['Focus for this issue'] ?? '').trim()",
          count: "$json.items.length",
          sparse: "$json.items.length < 3",
          research: "$json.items.map((d) => '[' + d.content_id + '] ' + d.title + ' (' + d.url + ')\\n' + String(d.text).slice(0, 6000)).join('\\n\\n---\\n\\n')",
        },
        { types: { count: "number", sparse: "boolean" } },
      ),

      /* ---- 2. Pick top stories ---- */
      set("stories_prompt", { prompt: "'Date: ' + $json.date + '\\nEditor focus: ' + ($json.focus || 'none given') + '\\n' + ($json.sparse ? 'Only ' + $json.count + ' research documents exist for this date. Choose fewer stories instead of padding: one strong story is enough.' : 'Choose the three or four strongest stories.') + '\\n\\nResearch:\\n' + $json.research" }),
      chain("pick_top_stories", { system: `[task:pick-stories] ${EDITOR} Choose the top stories for today's issue. For each, give a headline, the ids of the research documents it draws on (the ids in square brackets), any outside links in those documents worth reading in full, and why it leads. Then give your overall reasoning for the selection.`, prompt: "$json.prompt" }),
      chain("edit_top_stories", { system: `[task:edit-stories] ${EDITOR} The editor has asked for changes to the story selection. Apply exactly what they asked and keep everything else. Answer in the same shape, with your reasoning for the revised selection.`, prompt: `'Current selection:\\n' + JSON.stringify(${stories}.stories) + '\\n\\nEditor feedback: ' + $json.output.feedback + '\\n\\nResearch:\\n' + ${research}` }),
      set("set_current_stories", { stories: "$json.output.stories", reasoning: "$json.output.reasoning ?? ''" }, { types: { stories: "array" } }),
      telegram.send("share_selected_stories", `'Top stories for ' + ${date} + ':\\n' + $json.stories.map((s, i) => (i + 1) + '. ' + s.title).join('\\n')`),
      code("split_into_chunks", `// Telegram refuses a message over 4096 characters, so long reasoning is sent in parts.
const text = String($("set_current_stories").first().json.reasoning || "No reasoning was given.");
const chunks = [];
for (let i = 0; i < text.length; i += 3500) chunks.push(text.slice(i, i + 3500));
return chunks.map((chunk) => ({ json: { chunk } }));`),
      telegram.send("share_stories_reasoning", "$json.chunk"),
      telegram.feedback("share_stories_approval_feedback", "'Reply Approve to go on with these stories, or say what to change.'", { once: true }),
      extractor("extract_stories_approval_feedback", { text: "$json.data.text", system: READ_FEEDBACK, example: { approved: true, feedback: "" } }),
      iff("check_stories_feedback", "$json.output?.approved === true"),

      /* ---- 3. Subject line ---- */
      set("subject_examples", { examples: "'- Rates hold, markets shrug\\n- The chip that changes the maths\\n- Three deals you missed this week'" }),
      set("set_subject_line_prompt", { prompt: `'Stories in this issue:\\n' + ${stories}.stories.map((s) => '- ' + s.title + ': ' + s.why).join('\\n') + '\\n\\nSubject lines in the house style:\\n' + $json.examples` }),
      chain("write_subject_line", { system: `[task:subject-line] ${EDITOR} Write the subject line for this issue in the house style shown: under 50 characters, concrete, no clickbait and no emoji. Add a preheader of under 90 characters and one sentence of reasoning.`, prompt: "$json.prompt" }),
      chain("edit_subject_line", { system: `[task:edit-subject] ${EDITOR} The editor has asked for changes to the subject line. Apply exactly what they asked. Answer in the same shape.`, prompt: `'Current subject line: ' + ${subject}.subject_line + '\\nCurrent preheader: ' + ${subject}.preheader + '\\n\\nEditor feedback: ' + $json.output.feedback` }),
      set("set_current_subject_line", { subject_line: "$json.output.subject_line", preheader: "$json.output.preheader ?? ''", reasoning: "$json.output.reasoning ?? ''" }),
      telegram.send("share_subject_line", "'Subject line: ' + $json.subject_line + '\\nPreheader: ' + $json.preheader"),
      telegram.send("share_subject_line_reasoning", `${subject}.reasoning || 'No reasoning was given.'`),
      telegram.feedback("share_subject_line_approval_feedback", "'Reply Approve to use this subject line, or say what to change.'"),
      extractor("extract_subject_line_approval_feedback", { text: "$json.data.text", system: READ_FEEDBACK, example: { approved: true, feedback: "" } }),
      iff("check_subject_line_feedback", "$json.output?.approved === true"),

      /* ---- 4. Write each story ---- */
      set("set_selected_stories", { stories: `${stories}.stories` }, { types: { stories: "array" } }),
      splitOut("split_stories", "stories"),
      batches("iterate_stories", 1),
      set("set_current_segment", { title: "$json.title", why: "$json.why ?? ''", content_ids: "$json.content_ids ?? []", external_urls: "$json.external_urls ?? []" }, { types: { content_ids: "array", external_urls: "array" } }),
      splitOut("split_content_ids", "content_ids"),
      db.find("get_segment_content_info", "content_objects", { id: "$json.content_ids" }, { limit: 1 }),
      drive.search("get_segment_content", { name: "$json.file_name ?? 'no-such-file'", folder: FOLDER }),
      drive.download("download_segment_content", "$json.id ?? 'missing'", { onFail: "continue" }),
      extractText("get_segment_content_text"),
      set("prepare_segment_content_item", { text: "String($json.text ?? '').slice(0, 8000)" }),
      aggregate("aggregate_segment_text_content", { text: "texts" }),
      iff("check_external_urls", `${segment}.external_urls.length > 0`),
      set("set_segment_external_source_links", { url: `${segment}.external_urls.slice(0, 3)` }, { types: { url: "array" } }),
      splitOut("split_segment_external_source_urls", "url"),
      call("scrape_segment_external_source_url", "scrape-page", { onFail: "continue" }),
      filter("filter_segment_external_source_errors", "$json.ok === true", { alwaysOutput: true }),
      aggregate("aggregate_segment_external_source_content", { text: "sources" }),
      chain("write_segment_content", {
        system: `[task:write-segment] ${EDITOR} Write one story for the issue: a headline and a body of 120 to 200 words in plain, direct prose. List the addresses of the sources you used.`,
        prompt: `'Story: ' + ${segment}.title + '\\nWhy it leads: ' + ${segment}.why + '\\n\\nResearch:\\n' + $('aggregate_segment_text_content').first().json.texts.join('\\n\\n') + '\\n\\nOutside sources:\\n' + (($json.sources ?? []).filter((t) => t).map((t) => String(t).slice(0, 4000)).join('\\n\\n') || 'none')`,
      }),
      autofix("story_segment_auto_parser", "write_segment_content"),
      shape("story_segment_output_parser", "story_segment_auto_parser", { headline: "The story's headline", body: "The story.", sources: ["https://a-source-used"] }),
      chain("extract_image_urls", { system: "[task:image-urls] List the addresses of images that appear in this research and belong with the story: charts, product photos, screenshots. Only addresses that are in the text. An empty list is a fine answer.", prompt: `'Story: ' + ${segment}.title + '\\n\\nResearch:\\n' + $('aggregate_segment_text_content').first().json.texts.join('\\n\\n')` }),
      autofix("image_urls_auto_parser", "extract_image_urls"),
      shape("extract_image_urls_parser", "image_urls_auto_parser", { image_urls: ["https://an-image-in-the-research"] }),
      telegram.send("share_segment_msg", "$('write_segment_content').first().json.output.headline + '\\n\\n' + $('write_segment_content').first().json.output.body"),
      set("set_story_segment", { headline: "$('write_segment_content').first().json.output.headline", body: "$('write_segment_content').first().json.output.body", sources: "$('write_segment_content').first().json.output.sources ?? []", image_urls: "$('extract_image_urls').first().json.output.image_urls ?? []" }, { types: { sources: "array", image_urls: "array" } }),

      /* ---- 5. Write intro section ---- */
      chain("write_intro", { system: `[task:write-intro] ${EDITOR} Write the opening of the issue: two or three sentences that greet the reader and say what is in it, in the order the stories appear.`, prompt: `'Subject line: ' + ${subject}.subject_line + '\\n\\nStories:\\n' + $input.all().map((i) => '## ' + i.json.headline + '\\n' + i.json.body).join('\\n\\n')` }, { once: true }),
      autofix("intro_auto_parser", "write_intro"),
      shape("intro_parser", "intro_auto_parser", { intro: "The opening of the issue." }),

      /* ---- 6. Format full newsletter ---- */
      chain("write_other_top_stories", {
        system: `[task:other-stories] ${EDITOR} From the research that was not chosen as a top story, list up to five items worth a line each: the title, its address and one sentence. If nothing is left, answer with an empty list.`,
        prompt: `'Already covered: ' + ${stories}.stories.map((s) => s.title).join('; ') + '\\n\\nResearch not yet used:\\n' + ($('aggregate_markdown_content').first().json.items.filter((d) => !${stories}.stories.some((s) => (s.content_ids ?? []).includes(d.content_id))).map((d) => '- ' + d.title + ' (' + d.url + '): ' + String(d.text).slice(0, 600)).join('\\n') || 'none')`,
      }),
      autofix("other_top_stories_auto_parser", "write_other_top_stories"),
      shape("other_top_stories_parser", "other_top_stories_auto_parser", { items: [{ title: "A title", url: "https://its-address", line: "One sentence." }] }),
      set("set_full_newsletter", {
        file_name: `'newsletter-' + ${date} + '.md'`,
        subject_line: `${subject}.subject_line`,
        markdown: `'# ' + ${subject}.subject_line + '\\n\\n' + ${subject}.preheader + '\\n\\n' + $('write_intro').first().json.output.intro + '\\n\\n' + $('iterate_stories').all().map((i) => i.json).map((s) => '## ' + s.headline + '\\n\\n' + s.body + (s.image_urls.length ? '\\n\\n![](' + s.image_urls[0] + ')' : '') + (s.sources.length ? '\\n\\nSources: ' + s.sources.join(', ') : '')).join('\\n\\n') + (($json.output.items ?? []).length ? '\\n\\n## Also worth reading\\n\\n' + $json.output.items.map((o) => '- [' + o.title + '](' + o.url + '): ' + o.line).join('\\n') : '')`,
        summary: `'Draft for ' + ${date} + ' is attached. Subject line: ' + ${subject}.subject_line + '. ' + $('iterate_stories').all().length + ' stories: ' + $('iterate_stories').all().map((i) => i.json.headline).join('; ') + '. Also worth reading: ' + ($json.output.items ?? []).length + ' items.'`,
      }),
      toTextFile("create_newsletter_file", "markdown", "=$json.file_name"),
      telegram.document("upload_newsletter_file"),
      telegram.send("share_newsletter_msg", "$('set_full_newsletter').first().json.summary"),

      /* ---- the models every step shares ---- */
      geminiModel("Google Gemini Chat Model", [...CHAINS, "extract_stories_approval_feedback", "extract_subject_line_approval_feedback"]),
      shape("stories_parser", ["pick_top_stories", "edit_top_stories"], { stories: [STORY], reasoning: "Why these stories." }),
      shape("subject_line_parser", ["write_subject_line", "edit_subject_line"], { subject_line: "The subject line", preheader: "The preheader", reasoning: "One sentence." }),
      groqModel("Groq Chat Model", ["story_segment_auto_parser", "image_urls_auto_parser", "intro_auto_parser", "other_top_stories_auto_parser"]),
    ],
    flow: [
      ["submit_form", "get_files", "filter_only_markdown", "get_markdown_object_info", "exclude_newsletters", "download_markdown_object", "get_markdown_file_content", "prepare_markdown_content", "aggregate_markdown_content", "combine_markdown_content", "stories_prompt", "pick_top_stories", "set_current_stories"],
      ["set_current_stories", "share_selected_stories", "split_into_chunks", "share_stories_reasoning", "share_stories_approval_feedback", "extract_stories_approval_feedback", "check_stories_feedback"],
      ["check_stories_feedback:1", "edit_top_stories", "set_current_stories"],
      ["check_stories_feedback:0", "subject_examples", "set_subject_line_prompt", "write_subject_line", "set_current_subject_line"],
      ["set_current_subject_line", "share_subject_line", "share_subject_line_reasoning", "share_subject_line_approval_feedback", "extract_subject_line_approval_feedback", "check_subject_line_feedback"],
      ["check_subject_line_feedback:1", "edit_subject_line", "set_current_subject_line"],
      ["check_subject_line_feedback:0", "set_selected_stories", "split_stories", "iterate_stories"],
      ["iterate_stories:1", "set_current_segment", "split_content_ids", "get_segment_content_info", "get_segment_content", "download_segment_content", "get_segment_content_text", "prepare_segment_content_item", "aggregate_segment_text_content", "check_external_urls"],
      ["check_external_urls:0", "set_segment_external_source_links", "split_segment_external_source_urls", "scrape_segment_external_source_url", "filter_segment_external_source_errors", "aggregate_segment_external_source_content", "write_segment_content"],
      ["check_external_urls:1", "write_segment_content"],
      ["write_segment_content", "extract_image_urls", "share_segment_msg", "set_story_segment", "iterate_stories"],
      ["iterate_stories:0", "write_intro", "write_other_top_stories", "set_full_newsletter", "create_newsletter_file", "upload_newsletter_file", "share_newsletter_msg"],
    ],
    sections: [
      { title: "Retrieve Markdown content", note: "The research stored for the chosen date, read from Google Drive and joined into one text.", nodes: ["submit_form", "get_files", "filter_only_markdown", "get_markdown_object_info", "exclude_newsletters", "download_markdown_object", "get_markdown_file_content", "prepare_markdown_content", "aggregate_markdown_content", "combine_markdown_content"] },
      { title: "Pick top stories", note: "A proposal, the reasoning behind it, and the editor's reply. A reply that asks for changes goes round again.", nodes: ["stories_prompt", "pick_top_stories", "edit_top_stories", "set_current_stories", "share_selected_stories", "split_into_chunks", "share_stories_reasoning", "share_stories_approval_feedback", "extract_stories_approval_feedback", "check_stories_feedback"] },
      { title: "Subject line", note: "The same loop for the subject line: propose, explain, wait for the editor.", nodes: ["subject_examples", "set_subject_line_prompt", "write_subject_line", "edit_subject_line", "set_current_subject_line", "share_subject_line", "share_subject_line_reasoning", "share_subject_line_approval_feedback", "extract_subject_line_approval_feedback", "check_subject_line_feedback"] },
      { title: "Write each story", note: "One story per pass: its research, any outside sources, the story, its images.", nodes: ["set_selected_stories", "split_stories", "iterate_stories", "set_current_segment", "split_content_ids", "get_segment_content_info", "get_segment_content", "download_segment_content", "get_segment_content_text", "prepare_segment_content_item", "aggregate_segment_text_content", "check_external_urls", "set_segment_external_source_links", "split_segment_external_source_urls", "scrape_segment_external_source_url", "filter_segment_external_source_errors", "aggregate_segment_external_source_content", "write_segment_content", "extract_image_urls", "share_segment_msg", "set_story_segment"] },
      { title: "Write intro section", nodes: ["write_intro"] },
      { title: "Format full newsletter", note: "The round-up, the assembled draft, and delivery as a file with a summary.", nodes: ["write_other_top_stories", "set_full_newsletter", "create_newsletter_file", "upload_newsletter_file", "share_newsletter_msg"] },
    ],
    story: [
      { title: "An editor picks a date", copy: "The form takes the date of the issue and, if the editor wants, a focus for it.", nodes: ["submit_form"] },
      { title: "That day's research is gathered", copy: "Google Drive is searched for the date's Markdown files and Supabase for their index rows. Past newsletters stored alongside the research are left out.", nodes: ["get_files", "filter_only_markdown", "get_markdown_object_info", "exclude_newsletters"] },
      { title: "Every document is read", copy: "Each file is downloaded and its text extracted, then all of it is joined into one body of research, each document under its id.", nodes: ["download_markdown_object", "get_markdown_file_content", "prepare_markdown_content", "aggregate_markdown_content", "combine_markdown_content"] },
      { title: "A thin day is handled", copy: "With fewer than three documents, the prompt tells the model to choose fewer stories instead of padding the issue.", nodes: ["stories_prompt"] },
      { title: "The top stories are proposed", copy: "Gemini chooses the stories, names the documents each draws on, and explains the selection.", nodes: ["pick_top_stories", "set_current_stories", "Google Gemini Chat Model", "stories_parser"] },
      { title: "The editor sees the proposal and the reasoning", copy: "The selection arrives on Telegram, followed by the reasoning, cut into parts if it is too long for one message.", nodes: ["share_selected_stories", "split_into_chunks", "share_stories_reasoning"] },
      { title: "The run waits for a written reply", copy: "The editor answers in their own words. A model reads the reply and decides one thing: approved, or what to change.", nodes: ["share_stories_approval_feedback", "extract_stories_approval_feedback", "check_stories_feedback"] },
      { title: "Changes go round again", copy: "If the editor asked for changes, the selection is revised with exactly that feedback and shown again. This repeats until they approve.", nodes: ["edit_top_stories"] },
      { title: "The subject line gets the same treatment", copy: "A subject line and preheader are written in the house style, shown with their reasoning, and revised on the editor's feedback until approved.", nodes: ["subject_examples", "set_subject_line_prompt", "write_subject_line", "set_current_subject_line", "share_subject_line", "share_subject_line_reasoning", "share_subject_line_approval_feedback", "extract_subject_line_approval_feedback", "check_subject_line_feedback", "edit_subject_line", "subject_line_parser"] },
      { title: "Stories are written one at a time", copy: "The approved stories are split up and taken in order.", nodes: ["set_selected_stories", "split_stories", "iterate_stories", "set_current_segment"] },
      { title: "A story's own research is loaded", copy: "Only the documents that story draws on are fetched again and read, so the model writes from the right material and nothing else.", nodes: ["split_content_ids", "get_segment_content_info", "get_segment_content", "download_segment_content", "get_segment_content_text", "prepare_segment_content_item", "aggregate_segment_text_content"] },
      { title: "Outside sources are read too", copy: "If the story names outside links, each is scraped in full. A link that fails to load is dropped and the story is still written.", nodes: ["check_external_urls", "set_segment_external_source_links", "split_segment_external_source_urls", "scrape_segment_external_source_url", "filter_segment_external_source_errors", "aggregate_segment_external_source_content"] },
      { title: "The story is written", copy: "Gemini writes the headline and body and lists its sources, then a second pass pulls out any images in the research. An answer in the wrong shape is repaired by a second model on Groq.", nodes: ["write_segment_content", "story_segment_auto_parser", "story_segment_output_parser", "extract_image_urls", "image_urls_auto_parser", "extract_image_urls_parser", "Groq Chat Model"] },
      { title: "Each story is shared as it lands", copy: "The finished story goes to Telegram straight away, so the editor reads along while the rest is written.", nodes: ["share_segment_msg", "set_story_segment"] },
      { title: "An intro and a round-up", copy: "With every story written, the intro is written from them, and the research that was not chosen becomes a short list of other things worth reading.", nodes: ["write_intro", "intro_auto_parser", "intro_parser", "write_other_top_stories", "other_top_stories_auto_parser", "other_top_stories_parser"] },
      { title: "The draft is delivered", copy: "Everything is assembled into one Markdown file and sent to the editor on Telegram, followed by a summary of what is in it.", nodes: ["set_full_newsletter", "create_newsletter_file", "upload_newsletter_file", "share_newsletter_msg"] },
    ],
    tests: [
      {
        name: "drafts the issue and delivers it as a file when the editor approves",
        seed: { ...store(RATES, CHIP, PORT), telegram_replies: [yes, yes] },
        llm: [PICK, APPROVED, ...WRITING],
        input: request,
        notRan: ["edit_top_stories", "edit_subject_line", "scrape_segment_external_source_url"],
        output: [{ node: "combine_markdown_content", json: { count: 3, sparse: false } }, { node: "set_full_newsletter", json: { file_name: "newsletter-2026-10-13.md", subject_line: "Rates hold, chips fly" } }],
        callCount: { [DOCUMENT]: 1 },
        calls: [{ to: "telegram", body: { text: "Top stories for 2026-10-13:\n1. Rates held\n2. Chip launch" } }, { to: "telegram", body: { text: "Draft for 2026-10-13 is attached. Subject line: Rates hold, chips fly. 2 stories: Rates stay where they are; Rates stay where they are. Also worth reading: 1 items." } }],
      },
      {
        name: "the editor's feedback on the stories revises the selection before going on",
        seed: { ...store(RATES, CHIP, PORT), telegram_replies: [{ text: "Swap the chip story for the port one" }, yes, yes] },
        llm: [PICK, { system: "read-feedback", json: { approved: false, feedback: "Swap the chip story for the port one" } }, { system: "edit-stories", json: pick([RATES], [PORT]) }, APPROVED, ...WRITING],
        input: request,
        ran: ["edit_top_stories"],
        output: { node: "set_selected_stories", json: { stories: [{ title: "Port expansion", content_ids: ["doc-port"] }] } },
        calls: [{ to: "telegram", body: { text: "Top stories for 2026-10-13:\n1. Rates held\n2. Port expansion" } }],
        callCount: { [DOCUMENT]: 1 },
      },
      {
        name: "the editor's feedback on the subject line rewrites it",
        seed: { ...store(RATES, CHIP, PORT), telegram_replies: [yes, { text: "Too cute. Say what happened." }, yes] },
        llm: [PICK, { system: "read-feedback", json: { approved: true, feedback: "" } }, { system: "read-feedback", json: { approved: false, feedback: "Too cute. Say what happened." } }, { system: "edit-subject", json: { output: { subject_line: "Central bank holds rates", preheader: "And a new chip.", reasoning: "Plain." } } }, APPROVED, ...WRITING],
        input: request,
        ran: ["edit_subject_line"],
        notRan: ["edit_top_stories"],
        output: { node: "set_full_newsletter", json: { subject_line: "Central bank holds rates" } },
      },
      {
        name: "a thin day still produces a draft, with fewer stories asked for",
        seed: { ...store(RATES), telegram_replies: [yes, yes] },
        llm: [{ system: "pick-stories", json: pick([RATES]) }, APPROVED, ...WRITING],
        input: request,
        output: { node: "combine_markdown_content", json: { count: 1, sparse: true } },
        callCount: { [DOCUMENT]: 1 },
      },
      {
        name: "past newsletters stored with the research are left out",
        seed: { ...store(RATES, CHIP, doc("old-issue", "Yesterday's issue", "An old newsletter.", { type: "newsletter" })), telegram_replies: [yes, yes] },
        llm: [PICK, APPROVED, ...WRITING],
        input: request,
        output: { node: "combine_markdown_content", json: { count: 2 } },
      },
      {
        name: "outside sources are scraped, and one that fails does not stop the story",
        seed: { ...store(RATES, CHIP, PORT), telegram_replies: [yes, yes] },
        routes: [{ path: "/page/report", response: { __raw: "<html><body><p>The full report says rates stay at five percent.</p></body></html>", type: "text/html" } }],
        fail: [{ path: "/page/gone", times: 1, status: 404 }],
        llm: [{ system: "pick-stories", json: pick([RATES, ["http://mocks:4010/page/report", "http://mocks:4010/page/gone"]]) }, APPROVED, ...WRITING],
        input: request,
        output: { node: "aggregate_segment_external_source_content", json: { sources: ["The full report says rates stay at five percent."] } },
        callCount: { [DOCUMENT]: 1 },
      },
      {
        name: "a story in the wrong shape is repaired by the second model",
        seed: { ...store(RATES, CHIP, PORT), telegram_replies: [yes, yes] },
        llm: [{ system: "pick-stories", json: pick([RATES]) }, APPROVED, SUBJECT, { system: "write-segment", text: "Here is the story you asked for: rates were held." }, { last: "^Instructions:", json: { output: { headline: "Repaired headline", body: "The central bank held rates steady.", sources: [] } } }, IMAGES, INTRO, OTHER],
        input: request,
        callCount: { groq: 1, [DOCUMENT]: 1 },
        output: { node: "set_story_segment", json: { headline: "Repaired headline" } },
      },
    ],
  }),
];
