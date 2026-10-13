/**
 * Built and run in production, rebuilt here for publication: the scraper that
 * feeds a social media analytics dashboard.
 *
 * One schedule starts five tracks, one per network. Each runs a saved Apify
 * task, sorts what comes back by account, and writes every post to that
 * account's spreadsheet, which is what the dashboard reads.
 *
 * The tracks, the node names and the wiring follow the original canvas. The
 * account handles, task names and column mappings are placeholders written
 * for this library.
 */
import { schedule, batches, splitOut, set, route, define } from "../lib/wf.mjs";
import { apify, sheets } from "../lib/nodes.mjs";

/* The accounts that are tracked: the brand's own and its competitors'. */
const OWN = "ourbrand";
const INSTAGRAM = [OWN, "rival_one", "rival_two", "rival_three", "rival_four", "rival_five"];
const X = [OWN, "rival_one"];
const YOUTUBE = [OWN, "rival_one"];
const FACEBOOK = [OWN, "rival_one", "rival_two", "rival_three"];

const list = (handles) => `[${handles.map((h) => `'${h}'`).join(", ")}]`;
const accounts = (name, handles) => set(name, { accounts: list(handles) }, { types: { accounts: "array" } });
const rules = (handles, field) => Object.fromEntries(handles.map((h) => [h, `String(${field} ?? '').toLowerCase() === '${h}'`]));

/** One "write to this account's sheet" node per account, numbered as on the canvas. */
const rows = (from, handles, tab, columns) => handles.map((h, i) => sheets.upsert(`create_row_${from + i}`, `social-${h}`, tab, "url", columns));
const rowFlow = (switchName, from, handles, then) => handles.map((_, i) => [`${switchName}:${i}`, `create_row_${from + i}`, ...(then ? [then] : [])]);
const names = (from, n) => Array.from({ length: n }, (_, i) => `create_row_${from + i}`);

const COLUMNS = ["url", "account", "text", "likes", "comments", "views", "posted"];
const HEADER = { sheet_header: [{ columns: COLUMNS }] };
const put = (handle, row) => ({ to: "googleSheets", method: "PUT", path: `/v4/spreadsheets/social-${handle}/values/*`, body: { values: [row] } });
const RUNS = (task) => `apify /v2/actor-tasks/${task}/runs`;

export default [
  define({
    source: "production",
    id: "social-intelligence-scraper",
    folder: "production/social-intelligence",
    tier: "flagship",
    system: "social-intelligence",
    category: "Reporting and monitoring",
    name: "Social intelligence · Omnichannel scraper",
    summary: "Every morning, Apify tasks collect posts from Instagram (posts and reels), X, TikTok, YouTube and Facebook for the brand's own accounts and its competitors'. Each post is routed by account and written to that account's Google Sheet, which is the source a Tableau dashboard reads.",
    nodes: [
      schedule("schedule", "0 6 * * *"),

      /* ---- Instagram: posts, then reels ---- */
      accounts("set_instagram_accounts", INSTAGRAM),
      apify.scrape("scrape_post", "acme~instagram-posts", { input: "{ username: $json.accounts, resultsLimit: 30 }" }),
      route("switch_accounts_1", rules(INSTAGRAM, "$json.ownerUsername")),
      ...rows(1, INSTAGRAM, "Instagram posts", { url: "$json.url", account: "$json.ownerUsername", text: "String($json.caption ?? '').slice(0, 500)", likes: "$json.likesCount ?? 0", comments: "$json.commentsCount ?? 0", views: "''", posted: "$json.timestamp ?? ''" }),
      apify.run("scrape_reel", "acme~instagram-reels", { input: "{ username: $json.accounts, resultsLimit: 30 }" }),
      apify.abort("abort", "$json.id"),
      apify.dataset("get_dataset_1", "$('scrape_reel').first().json.defaultDatasetId", { alwaysOutput: false }),
      route("switch_accounts_2", rules(INSTAGRAM, "$json.ownerUsername")),
      ...rows(7, INSTAGRAM, "Instagram reels", { url: "$json.url", account: "$json.ownerUsername", text: "String($json.caption ?? '').slice(0, 500)", likes: "$json.likesCount ?? 0", comments: "$json.commentsCount ?? 0", views: "$json.videoViewCount ?? 0", posted: "$json.timestamp ?? ''" }),

      /* ---- X: one account at a time ---- */
      accounts("set_x_accounts", X),
      splitOut("split_accounts_1", "accounts"),
      batches("for_each_account_1", 1),
      apify.scrape("scrape_tweet", "acme~x-posts", { input: "{ twitterHandles: [$json.accounts], maxItems: 50 }", alwaysOutput: true }),
      route("switch_accounts_3", rules(X, "$json.author?.userName")),
      ...rows(13, X, "X posts", { url: "$json.url", account: "$json.author.userName", text: "String($json.text ?? '').slice(0, 500)", likes: "$json.likeCount ?? 0", comments: "$json.replyCount ?? 0", views: "$json.viewCount ?? 0", posted: "$json.createdAt ?? ''" }),

      /* ---- TikTok: the brand's own account ---- */
      accounts("set_tiktok_accounts", [OWN]),
      apify.scrape("scrape_tiktok", "acme~tiktok-videos", { input: "{ profiles: $json.accounts, resultsPerPage: 30 }" }),
      sheets.upsert("create_row_15", `social-${OWN}`, "TikTok videos", "url", { url: "$json.webVideoUrl", account: "$json.authorMeta?.name ?? ''", text: "String($json.text ?? '').slice(0, 500)", likes: "$json.diggCount ?? 0", comments: "$json.commentCount ?? 0", views: "$json.playCount ?? 0", posted: "$json.createTimeISO ?? ''" }),

      /* ---- YouTube ---- */
      accounts("set_youtube_accounts", YOUTUBE),
      apify.scrape("scrape_yt", "acme~youtube-videos", { input: "{ channels: $json.accounts, maxResults: 30 }" }),
      route("switch_accounts_4", rules(YOUTUBE, "$json.channelUsername")),
      ...rows(16, YOUTUBE, "YouTube videos", { url: "$json.url", account: "$json.channelUsername", text: "String($json.title ?? '').slice(0, 500)", likes: "$json.likes ?? 0", comments: "$json.commentsCount ?? 0", views: "$json.viewCount ?? 0", posted: "$json.date ?? ''" }),

      /* ---- Facebook: one page at a time ---- */
      accounts("set_facebook_accounts", FACEBOOK),
      splitOut("split_accounts_2", "accounts"),
      batches("for_each_account_2", 1),
      apify.run("scrape_fb", "acme~facebook-posts", { input: "{ startUrls: [ { url: 'https://www.facebook.com/' + $json.accounts } ], resultsLimit: 30 }" }),
      apify.abort("abort1", "$json.id"),
      apify.dataset("get_dataset_2", "$('scrape_fb').first().json.defaultDatasetId"),
      set("set_postdate", { posted: "$json.time ? new Date($json.time).toISOString().slice(0, 10) : ''" }, { keep: true }),
      route("switch_accounts_5", rules(FACEBOOK, "$json.pageName")),
      ...rows(18, FACEBOOK, "Facebook posts", { url: "$json.url", account: "$json.pageName", text: "String($json.text ?? '').slice(0, 500)", likes: "$json.likes ?? 0", comments: "$json.comments ?? 0", views: "''", posted: "$json.posted" }),
    ],
    flow: [
      ["schedule", "set_instagram_accounts", "scrape_post", "switch_accounts_1"],
      ...rowFlow("switch_accounts_1", 1, INSTAGRAM),
      ["set_instagram_accounts", "scrape_reel", "abort", "get_dataset_1", "switch_accounts_2"],
      ...rowFlow("switch_accounts_2", 7, INSTAGRAM),

      ["schedule", "set_x_accounts", "split_accounts_1", "for_each_account_1"],
      ["for_each_account_1:1", "scrape_tweet", "switch_accounts_3"],
      ...rowFlow("switch_accounts_3", 13, X, "for_each_account_1"),
      // An account with nothing new still has to hand the loop back.
      [`switch_accounts_3:${X.length}`, "for_each_account_1"],

      ["schedule", "set_tiktok_accounts", "scrape_tiktok", "create_row_15"],

      ["schedule", "set_youtube_accounts", "scrape_yt", "switch_accounts_4"],
      ...rowFlow("switch_accounts_4", 16, YOUTUBE),

      ["schedule", "set_facebook_accounts", "split_accounts_2", "for_each_account_2"],
      ["for_each_account_2:1", "scrape_fb", "abort1", "get_dataset_2", "set_postdate", "switch_accounts_5"],
      ...rowFlow("switch_accounts_5", 18, FACEBOOK, "for_each_account_2"),
      [`switch_accounts_5:${FACEBOOK.length}`, "for_each_account_2"],
    ],
    sections: [
      { title: "Instagram", note: "Posts in one Apify task, reels in another. Each is sorted by account.", nodes: ["schedule", "set_instagram_accounts", "scrape_post", "switch_accounts_1", ...names(1, 6), "scrape_reel", "abort", "get_dataset_1", "switch_accounts_2", ...names(7, 6)] },
      { title: "X", note: "One account per pass.", nodes: ["set_x_accounts", "split_accounts_1", "for_each_account_1", "scrape_tweet", "switch_accounts_3", ...names(13, 2)] },
      { title: "TikTok", nodes: ["set_tiktok_accounts", "scrape_tiktok", "create_row_15"] },
      { title: "YouTube", nodes: ["set_youtube_accounts", "scrape_yt", "switch_accounts_4", ...names(16, 2)] },
      { title: "Facebook", note: "One page per pass. The post date is normalised before it is written.", nodes: ["set_facebook_accounts", "split_accounts_2", "for_each_account_2", "scrape_fb", "abort1", "get_dataset_2", "set_postdate", "switch_accounts_5", ...names(18, 4)] },
    ],
    story: [
      { title: "One schedule, five networks", copy: "Each morning the schedule starts a track for Instagram, X, TikTok, YouTube and Facebook at the same time. Each track starts from its own list of accounts.", nodes: ["schedule", "set_instagram_accounts", "set_x_accounts", "set_tiktok_accounts", "set_youtube_accounts", "set_facebook_accounts"] },
      { title: "Instagram posts", copy: "A saved Apify task scrapes the latest posts for all six accounts and hands back its dataset.", nodes: ["scrape_post"] },
      { title: "Sorted by account", copy: "A switch sends each post to the branch for the account it belongs to. A post from an account that is not on the list goes nowhere.", nodes: ["switch_accounts_1"] },
      { title: "Written to that account's sheet", copy: "Each account has its own spreadsheet. A post already in the sheet is updated with today's numbers instead of being added twice.", nodes: names(1, 6) },
      { title: "Instagram reels", copy: "Reels run as a separate task with a time limit. The run is stopped through Apify's API, then whatever it collected is read and sorted the same way.", nodes: ["scrape_reel", "abort", "get_dataset_1", "switch_accounts_2", ...names(7, 6)] },
      { title: "X, one account at a time", copy: "The X accounts are looped over. An account with nothing new hands the loop straight back so the next one still runs.", nodes: ["split_accounts_1", "for_each_account_1", "scrape_tweet", "switch_accounts_3", ...names(13, 2)] },
      { title: "TikTok and YouTube", copy: "TikTok covers the brand's own account. YouTube covers the brand and one competitor, split by channel.", nodes: ["scrape_tiktok", "create_row_15", "scrape_yt", "switch_accounts_4", ...names(16, 2)] },
      { title: "Facebook, one page at a time", copy: "Each page is scraped in turn. The post date is put in one format before the row is written, so the dashboard can chart every network on the same axis.", nodes: ["split_accounts_2", "for_each_account_2", "scrape_fb", "abort1", "get_dataset_2", "set_postdate", "switch_accounts_5", ...names(18, 4)] },
    ],
    tests: [
      {
        name: "writes each Instagram post to the sheet of the account it belongs to",
        seed: { ...HEADER, "apify_acme~instagram-posts": [{ ownerUsername: "ourbrand", url: "https://instagram.example/p/1", caption: "Our launch", likesCount: 120, commentsCount: 8, timestamp: "2026-10-12T10:00:00Z" }, { ownerUsername: "rival_two", url: "https://instagram.example/p/2", caption: "Their sale", likesCount: 45, commentsCount: 2, timestamp: "2026-10-12T11:00:00Z" }] },
        input: [{}],
        ran: ["create_row_1", "create_row_3"],
        notRan: ["create_row_2", "create_row_4"],
        calls: [put("ourbrand", ["https://instagram.example/p/1", "ourbrand", "Our launch", 120, 8]), put("rival_two", ["https://instagram.example/p/2", "rival_two", "Their sale", 45, 2])],
      },
      {
        name: "a post from an account that is not tracked is not written",
        seed: { ...HEADER, "apify_acme~instagram-posts": [{ ownerUsername: "someone_else", url: "https://instagram.example/p/9", caption: "Not ours", likesCount: 1 }] },
        input: [{}],
        ran: ["switch_accounts_1"],
        noCalls: ["googleSheets"],
      },
      {
        name: "stops the reels run, then reads what it collected",
        seed: { ...HEADER, "apify_acme~instagram-reels": [{ ownerUsername: "rival_one", url: "https://instagram.example/reel/5", caption: "A reel", likesCount: 300, commentsCount: 12, videoViewCount: 9000, timestamp: "2026-10-12T12:00:00Z" }] },
        input: [{}],
        ran: ["create_row_8"],
        calls: [{ to: "apify", method: "POST", path: "/v2/actor-runs/run_acme~instagram-reels/abort" }, put("rival_one", ["https://instagram.example/reel/5", "rival_one", "A reel", 300, 12, 9000])],
      },
      {
        name: "every X account is scraped even when one has nothing new",
        seed: { ...HEADER },
        input: [{}],
        callCount: { [RUNS("acme~x-posts")]: 2 },
        notRan: ["create_row_13", "create_row_14"],
      },
      {
        name: "writes tweets, TikTok and YouTube videos with one set of columns",
        seed: {
          ...HEADER,
          "apify_acme~x-posts": [{ author: { userName: "rival_one" }, url: "https://x.example/s/1", text: "A tweet", likeCount: 7, replyCount: 1, viewCount: 400, createdAt: "2026-10-12" }],
          "apify_acme~tiktok-videos": [{ authorMeta: { name: "ourbrand" }, webVideoUrl: "https://tiktok.example/v/1", text: "A video", diggCount: 50, commentCount: 3, playCount: 2000, createTimeISO: "2026-10-12" }],
          "apify_acme~youtube-videos": [{ channelUsername: "ourbrand", url: "https://youtube.example/watch?v=1", title: "A talk", likes: 9, commentsCount: 0, viewCount: 150, date: "2026-10-11" }],
        },
        input: [{}],
        ran: ["create_row_14", "create_row_15", "create_row_16"],
        calls: [put("rival_one", ["https://x.example/s/1", "rival_one", "A tweet", 7, 1, 400]), put("ourbrand", ["https://tiktok.example/v/1", "ourbrand", "A video", 50, 3, 2000]), put("ourbrand", ["https://youtube.example/watch?v=1", "ourbrand", "A talk", 9, 0, 150])],
      },
      {
        name: "Facebook pages are scraped one at a time and the post date is normalised",
        seed: { ...HEADER, "apify_acme~facebook-posts": [{ pageName: "rival_three", url: "https://facebook.example/posts/1", text: "A post", likes: 21, comments: 4, time: "2026-10-12T15:30:00.000Z" }] },
        input: [{}],
        callCount: { [RUNS("acme~facebook-posts")]: 4 },
        output: { node: "set_postdate", json: { posted: "2026-10-12", pageName: "rival_three" } },
        calls: [put("rival_three", ["https://facebook.example/posts/1", "rival_three", "A post", 21, 4, "", "2026-10-12"])],
      },
    ],
  }),
];
