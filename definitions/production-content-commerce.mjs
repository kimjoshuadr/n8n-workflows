/** Production workflows for content, SEO, e-commerce and payments. */
import { define, webhook, schedule, http, llm, parseLlm, code, iff, route, call, respond, noop } from "../lib/wf.mjs";

const content = { folder: "workflows/content", tier: "production", category: "Content and SEO" };
const commerce = { folder: "workflows/commerce", tier: "production", category: "E-commerce and payments" };

export default [
  define({
    ...content,
    id: "feed-digest",
    name: "Content · Industry news digest",
    summary: "Each Friday, reads the feeds you follow, drops what was already sent, and emails a short digest of what is new.",
    integrations: ["Schedule", "Datastore", "LLM", "Email"],
    nodes: [
      schedule("Friday 15:00", "0 15 * * 5"),
      http("Feeds to read", "DB:/feeds", { method: "GET", alwaysOutput: true }),
      http("Fetch the feed", "=$json.url", { method: "GET", onFail: "continue", retry: false }),
      code("Collect the items", `const items = $input.all().flatMap((i) => i.json.items ?? []).filter((x) => x && x.url && x.title);
const unique = [...new Map(items.map((x) => [x.url, x])).values()];
return unique.map((x) => ({ json: { url: x.url, title: x.title, summary: String(x.summary ?? "").slice(0, 500) } }));`),
      http("Claim as seen", "DB:/seen_items", { query: { on_conflict: "'url'" }, body: "{ url: $json.url, title: $json.title, summary: $json.summary }", alwaysOutput: true }),
      code("Only the new ones", `const fresh = $input.all().map((i) => i.json).filter((r) => r && r.url);
return [{ json: { count: fresh.length, list: fresh.map((r) => "- " + r.title + " (" + r.url + "): " + r.summary).join("\\n") } }];`),
      iff("Anything new?", "$json.count > 0"),
      llm("Write the digest", { task: "summarise", json: false, system: "Write a short weekly digest from these items: one line per item saying why it matters, grouped under at most three headings. Keep every link. Add nothing that is not in the items.", user: "$json.list", onFail: "continue" }),
      http("Send the digest", "EMAIL:/emails", { body: "{ to: 'team@example.com', subject: 'This week: ' + $('Only the new ones').first().json.count + ' things worth reading', text: $json.choices?.[0]?.message?.content ?? $('Only the new ones').first().json.list }" }),
      noop("Quiet week"),
    ],
    flow: [
      ["Friday 15:00", "Feeds to read", "Fetch the feed", "Collect the items", "Claim as seen", "Only the new ones", "Anything new?", "Write the digest", "Send the digest"],
      ["Anything new?:1", "Quiet week"],
    ],
    story: [
      { title: "It reads your feeds", copy: "One dead feed does not stop the others.", nodes: ["Friday 15:00", "Feeds to read", "Fetch the feed", "Collect the items"] },
      { title: "Seen once, sent once", copy: "Each link is claimed in the datastore. Only links that were new this run go forward.", nodes: ["Claim as seen", "Only the new ones", "Anything new?", "Quiet week"] },
      { title: "A digest, or the plain list", copy: "If the model is down the raw list is sent instead of nothing.", nodes: ["Write the digest", "Send the digest"] },
    ],
    tests: [
      { name: "sends only items not seen before", seed: { feeds: [{ url: "http://mocks:4010/feed/a" }], seen_items: [{ url: "https://x.example/old", title: "Old" }] }, routes: [{ path: "/feed/a", response: { items: [{ url: "https://x.example/old", title: "Old" }, { url: "https://x.example/new", title: "New thing", summary: "It is new." }] } }], input: [{}], output: { node: "Only the new ones", json: { count: 1 } }, calls: [{ path: "/email/emails", body: { subject: "This week: 1 things worth reading" } }] },
      { name: "sends nothing in a quiet week", seed: { feeds: [{ url: "http://mocks:4010/feed/a" }], seen_items: [{ url: "https://x.example/old" }] }, routes: [{ path: "/feed/a", response: { items: [{ url: "https://x.example/old", title: "Old" }] } }], input: [{}], ran: ["Quiet week"], noCalls: ["/email", "/llm"] },
      { name: "sends the plain list when the model is down", seed: { feeds: [{ url: "http://mocks:4010/feed/a" }] }, routes: [{ path: "/feed/a", response: { items: [{ url: "https://x.example/n", title: "New thing", summary: "S" }] } }], fail: [{ path: "/llm", times: 3 }], input: [{}], calls: [{ path: "/email/emails", body: { text: "- New thing (https://x.example/n): S" } }] },
    ],
  }),

  define({
    ...content,
    id: "broken-link-check",
    name: "SEO · Broken link check",
    summary: "Every Sunday night, visits each page in the sitemap list and reports the ones that no longer load, with the status each returned.",
    integrations: ["Schedule", "Datastore", "Chat"],
    nodes: [
      schedule("Sunday 23:00", "0 23 * * 0"),
      http("Pages to check", "DB:/site_pages", { method: "GET", alwaysOutput: true }),
      http("Visit the page", "=$json.url", { method: "GET", fullResponse: true, retry: false, onFail: "continue" }),
      code("Find the broken ones", `const pages = $("Pages to check").all();
const results = $input.all().map((item, i) => ({ url: pages[i]?.json.url, status: item.json.statusCode ?? 0 })).filter((r) => r.url);
const broken = results.filter((r) => r.status === 0 || r.status >= 400);
return [{ json: { checked: results.length, broken, any: broken.length > 0, text: broken.length + " of " + results.length + " pages are broken:\\n" + broken.map((b) => "- " + b.url + " (" + (b.status || "no response") + ")").join("\\n") } }];`),
      iff("Any broken?", "$json.any"),
      http("Report them", "CHAT:/chat.postMessage", { body: "{ channel: '#website', text: ':link: ' + $json.text }" }),
      http("Save the run", "DB:/link_checks", { body: "{ checked: $('Find the broken ones').first().json.checked, broken: $('Find the broken ones').first().json.broken.length, at: $now.toISO() }" }),
    ],
    flow: [
      ["Sunday 23:00", "Pages to check", "Visit the page", "Find the broken ones", "Any broken?", "Report them", "Save the run"],
      ["Any broken?:1", "Save the run"],
    ],
    story: [
      { title: "Every page, once a week", copy: "Each page is requested once. A page that errors is a result, not a crash.", nodes: ["Sunday 23:00", "Pages to check", "Visit the page"] },
      { title: "Broken means 4xx, 5xx or no answer", copy: "Each broken page is listed with the status it returned.", nodes: ["Find the broken ones", "Any broken?"] },
      { title: "Reported, and the run is saved", copy: "A clean week posts nothing, but the run is still recorded so the trend is there.", nodes: ["Report them", "Save the run"] },
    ],
    tests: [
      { name: "reports a page that returns an error", seed: { site_pages: [{ url: "http://mocks:4010/page/ok" }, { url: "http://mocks:4010/page/gone" }] }, fail: [{ path: "/page/gone", times: 1, status: 404 }], input: [{}], output: { node: "Find the broken ones", json: { checked: 2, broken: [{ url: "http://mocks:4010/page/gone", status: 404 }] } }, calls: [{ path: "/chat/chat.postMessage", body: { channel: "#website" } }, { path: "/db/link_checks", body: { broken: 1, checked: 2 } }] },
      { name: "a clean site posts nothing and records the run", seed: { site_pages: [{ url: "http://mocks:4010/page/ok" }] }, input: [{}], noCalls: ["/chat"], calls: [{ path: "/db/link_checks", body: { broken: 0 } }] },
    ],
  }),

  define({
    ...content,
    id: "rank-tracker",
    name: "SEO · Keyword rank tracker",
    summary: "Records where the site ranks for each tracked keyword every day, and alerts when one falls five places or drops off the first page.",
    integrations: ["Schedule", "Datastore", "Search", "Chat"],
    nodes: [
      schedule("05:00 daily", "0 5 * * *"),
      http("Tracked keywords", "DB:/keywords", { method: "GET", alwaysOutput: true }),
      http("Search for it", "SEARCH:/serp", { body: "{ query: $json.keyword, num: 30 }", onFail: "continue" }),
      code("Find our position", `const kws = $("Tracked keywords").all();
return $input.all().map((item, i) => {
  const k = kws[i]?.json;
  if (!k?.keyword) return null;
  const results = item.json.results;
  if (!Array.isArray(results)) return { json: { ...k, position: null, checked: false } };
  const idx = results.findIndex((r) => String(r.url ?? "").includes(k.domain));
  const position = idx === -1 ? null : idx + 1;
  const before = k.last_position ?? null;
  const fell = before !== null && (position === null || position - before >= 5);
  const offFirstPage = before !== null && before <= 10 && (position === null || position > 10);
  return { json: { ...k, position, before, checked: true, alert: fell || offFirstPage } };
}).filter(Boolean);`),
      iff("Got a result?", "$json.checked"),
      http("Record today", "DB:/rank_history", { body: "{ keyword: $json.keyword, position: $json.position, at: $now.toISO() }" }),
      http("Update the keyword", "DB:/keywords", { method: "PATCH", query: { keyword: "'eq.' + $('Got a result?').item.json.keyword" }, body: "{ last_position: $('Got a result?').item.json.position, checked_at: $now.toISO() }" }),
      code("Gather the drops", `const drops = $("Got a result?").all().map((i) => i.json).filter((k) => k.alert);
if (!drops.length) return [];
return [{ json: { channel: "#seo", level: "warn", text: drops.length + " keyword(s) dropped: " + drops.map((d) => "\\"" + d.keyword + "\\" " + d.before + " to " + (d.position ?? "not in top 30")).join("; ") } }];`),
      call("Alert", "notify"),
      noop("Search failed, keep yesterday"),
    ],
    flow: [
      ["05:00 daily", "Tracked keywords", "Search for it", "Find our position", "Got a result?", "Record today", "Update the keyword", "Gather the drops", "Alert"],
      ["Got a result?:1", "Search failed, keep yesterday"],
    ],
    story: [
      { title: "One search per keyword", copy: "The top thirty results are fetched for each.", nodes: ["05:00 daily", "Tracked keywords", "Search for it"] },
      { title: "Where are we?", copy: "A failed search is not recorded as 'not ranking'. Yesterday's position is kept until a real answer arrives.", nodes: ["Find our position", "Got a result?", "Search failed, keep yesterday"] },
      { title: "History is kept", copy: "Every day's position is stored, so the chart exists when someone asks for it.", nodes: ["Record today", "Update the keyword"] },
      { title: "Drops are raised together", copy: "Five places down, or off the first page. One message lists them all.", nodes: ["Gather the drops", "Alert"] },
    ],
    tests: [
      { name: "records the position and alerts on a fall off page one", seed: { keywords: [{ keyword: "prop firm reviews", domain: "oursite.com", last_position: 4 }] }, routes: [{ path: "/search/serp", response: { results: [...Array(11).fill({ url: "https://other.com" }), { url: "https://oursite.com/reviews" }] } }], input: [{}], calls: [{ path: "/db/rank_history", body: { keyword: "prop firm reviews", position: 12 } }, { path: "/chat/chat.postMessage" }], table: { keywords: [{ keyword: "prop firm reviews", last_position: 12 }] } },
      { name: "a small move is recorded without an alert", seed: { keywords: [{ keyword: "k", domain: "oursite.com", last_position: 3 }] }, routes: [{ path: "/search/serp", response: { results: [{ url: "https://a.com" }, { url: "https://b.com" }, { url: "https://c.com" }, { url: "https://oursite.com" }] } }], input: [{}], calls: [{ path: "/db/rank_history", body: { position: 4 } }], noCalls: ["/chat"] },
      { name: "a failed search keeps yesterday's position", seed: { keywords: [{ keyword: "k", domain: "oursite.com", last_position: 3 }] }, fail: [{ path: "/search", times: 3 }], input: [{}], ran: ["Search failed, keep yesterday"], noCalls: ["/db/rank_history", "/chat"] },
    ],
  }),

  define({
    ...content,
    id: "mention-monitor",
    name: "Brand · Mention monitor",
    summary: "Checks hourly for new mentions of the brand, and raises the negative ones straight away with the text and the link.",
    integrations: ["Schedule", "Search", "Datastore", "LLM", "Chat"],
    nodes: [
      schedule("Hourly", { hours: 1 }),
      http("Search for mentions", "SEARCH:/mentions", { body: "{ query: 'YourBrand', since_hours: 2 }" }),
      code("One item per mention", `return ($input.first().json.mentions ?? []).filter((m) => m.url && m.text).map((m) => ({ json: { url: m.url, text: String(m.text).slice(0, 1500), author: m.author ?? "unknown" } }));`),
      http("Claim as seen", "DB:/seen_mentions", { query: { on_conflict: "'url'" }, body: "{ url: $json.url, text: $json.text, author: $json.author }", alwaysOutput: true }),
      iff("New mention?", "!!$json.url"),
      llm("Read the tone", { task: "classify", system: "Classify a public mention of a brand. Reply with JSON: { label: string, urgent: boolean, sentiment: 'negative'|'neutral'|'positive' }.", user: "$json.text", onFail: "continue" }),
      parseLlm("Read the verdict", { from: "New mention?", fallback: { sentiment: "unknown" } }),
      iff("Needs attention?", "$json.sentiment === 'negative' || $json.sentiment === 'unknown'"),
      code("Write the alert", `return $input.all().map((i) => ({ json: { channel: "#brand", level: "warn", text: (i.json.sentiment === "unknown" ? "Unclassified" : "Negative") + " mention by " + i.json.author + ": \\"" + i.json.text.slice(0, 240) + "\\" " + i.json.url } }));`),
      call("Raise it", "notify"),
    ],
    flow: [["Hourly", "Search for mentions", "One item per mention", "Claim as seen", "New mention?", "Read the tone", "Read the verdict", "Needs attention?", "Write the alert", "Raise it"]],
    story: [
      { title: "New mentions, hourly", copy: "The search window overlaps the last run on purpose, and each link is claimed so overlap costs nothing.", nodes: ["Hourly", "Search for mentions", "One item per mention", "Claim as seen", "New mention?"] },
      { title: "A model reads the tone", copy: "A mention it could not read is treated as needing attention, not as fine.", nodes: ["Read the tone", "Read the verdict", "Needs attention?"] },
      { title: "Negative ones are raised with the link", copy: "Positive and neutral mentions are kept in the datastore and nobody is interrupted.", nodes: ["Write the alert", "Raise it"] },
    ],
    tests: [
      { name: "raises a negative mention once", routes: [{ path: "/search/mentions", response: { mentions: [{ url: "https://x.example/1", text: "Worst service, terrible", author: "sam" }, { url: "https://x.example/2", text: "Loved it", author: "ana" }] } }], repeat: 2, input: [{}], callCount: { "/chat/chat.postMessage": 1 }, calls: [{ path: "/chat/chat.postMessage", body: { channel: "#brand" } }] },
      { name: "a mention it cannot classify is raised too", routes: [{ path: "/search/mentions", response: { mentions: [{ url: "https://x.example/3", text: "Hmm", author: "sam" }] } }], fail: [{ path: "/llm", times: 3 }], input: [{}], calls: [{ path: "/chat/chat.postMessage", body: { channel: "#brand" } }] },
    ],
  }),

  define({
    ...commerce,
    id: "inventory-sync",
    name: "Inventory · Supplier stock sync",
    summary: "Pulls the supplier's stock feed every two hours and updates the store only for products whose quantity changed, refusing a feed that looks wrong.",
    integrations: ["Schedule", "Supplier", "Datastore", "Shop", "Chat"],
    nodes: [
      schedule("Every 2 hours", { hours: 2 }),
      http("Supplier feed", "SUPPLIER:/stock", { method: "GET" }),
      http("Last known stock", "DB:/stock_snapshot", { method: "GET", alwaysOutput: true, once: true }),
      code("What changed?", `const feed = ($("Supplier feed").first().json.items ?? []).filter((i) => i.sku && Number.isFinite(Number(i.quantity)));
const known = new Map($input.all().map((i) => i.json).filter((r) => r.sku).map((r) => [r.sku, r.quantity]));
const changes = feed.map((i) => ({ sku: String(i.sku), quantity: Number(i.quantity), before: known.get(String(i.sku)) ?? null })).filter((c) => c.before !== c.quantity);
const zeroed = changes.filter((c) => c.quantity === 0 && c.before > 0).length;
// A feed that empties most of the catalogue at once is far more likely to be broken than true.
const suspicious = feed.length === 0 || (known.size >= 10 && zeroed / known.size > 0.5);
return [{ json: { feed_size: feed.length, changes, suspicious, zeroed } }];`),
      iff("Feed looks sane?", "!$json.suspicious"),
      code("One item per change", `return $input.first().json.changes.map((json) => ({ json }));`),
      http("Update the store", "SHOP:/inventory_levels/set", { body: "{ sku: $json.sku, available: $json.quantity }", onFail: "continue" }),
      http("Update the snapshot", "DB:/stock_snapshot", { query: { on_conflict: "'sku'" }, headers: { Prefer: "resolution=merge-duplicates" }, body: "{ sku: $('One item per change').item.json.sku, quantity: $('One item per change').item.json.quantity, at: $now.toISO() }" }),
      code("Refused message", `const r = $input.first().json;
return [{ json: { level: "critical", text: "Supplier stock feed refused: " + (r.feed_size === 0 ? "it was empty" : r.zeroed + " products went to zero at once") + ". The store was not changed. Check the feed." } }];`),
      call("Alert", "notify"),
    ],
    flow: [
      ["Every 2 hours", "Supplier feed", "Last known stock", "What changed?", "Feed looks sane?", "One item per change", "Update the store", "Update the snapshot"],
      ["Feed looks sane?:1", "Refused message", "Alert"],
    ],
    story: [
      { title: "The supplier's numbers, and ours", copy: "The feed is compared with the last snapshot.", nodes: ["Every 2 hours", "Supplier feed", "Last known stock", "What changed?"] },
      { title: "A broken feed is refused", copy: "An empty feed, or one that zeroes most of the catalogue, changes nothing and raises an alert. That one check is what stops a supplier outage from taking every product off sale.", nodes: ["Feed looks sane?", "Refused message", "Alert"] },
      { title: "Only the differences are written", copy: "Ten changed products means ten calls, not ten thousand.", nodes: ["One item per change", "Update the store", "Update the snapshot"] },
    ],
    tests: [
      { name: "updates only what changed", routes: [{ path: "/supplier/stock", response: { items: [{ sku: "A", quantity: 5 }, { sku: "B", quantity: 9 }] } }], seed: { stock_snapshot: [{ sku: "A", quantity: 5 }, { sku: "B", quantity: 12 }] }, input: [{}], callCount: { "/shop/inventory_levels/set": 1 }, calls: [{ path: "/shop/inventory_levels/set", body: { sku: "B", available: 9 } }], table: { stock_snapshot: [{ sku: "B", quantity: 9 }] } },
      { name: "refuses an empty feed", routes: [{ path: "/supplier/stock", response: { items: [] } }], seed: { stock_snapshot: [{ sku: "A", quantity: 5 }] }, input: [{}], ran: ["Alert"], noCalls: ["/shop"] },
      { name: "refuses a feed that zeroes most of the catalogue", routes: [{ path: "/supplier/stock", response: { items: Array.from({ length: 12 }, (_, i) => ({ sku: "S" + i, quantity: 0 })) } }], seed: { stock_snapshot: Array.from({ length: 12 }, (_, i) => ({ sku: "S" + i, quantity: 8 })) }, input: [{}], ran: ["Alert"], noCalls: ["/shop"] },
    ],
  }),

  define({
    ...commerce,
    id: "refund-approval",
    name: "Payments · Refund requests",
    summary: "Refunds small amounts on recent orders automatically, and sends anything larger, older or repeated to a person with the facts attached.",
    integrations: ["Webhook", "Datastore", "Payments", "Email", "Chat"],
    nodes: [
      webhook("Refund requested", "refund-request"),
      code("Read the request", `const b = $input.first().json.body ?? {};
return [{ json: { order_id: String(b.order_id ?? ""), reason: String(b.reason ?? "").slice(0, 500), valid: !!b.order_id } }];`),
      iff("Valid?", "$json.valid"),
      respond("Invalid", "{ ok: false, error: 'order_id is required' }", { status: 400 }),
      http("Load the order", "DB:/orders", { method: "GET", query: { order_id: "'eq.' + $json.order_id" }, alwaysOutput: true }),
      iff("Order found?", "!!$json.order_id"),
      respond("Unknown order", "{ ok: false, error: 'Order not found' }", { status: 404 }),
      http("Past refunds", "DB:/refunds", { method: "GET", query: { email: "'eq.' + $json.email" }, alwaysOutput: true }),
      code("Apply the policy", `const o = $("Order found?").first().json;
const past = $input.all().map((i) => i.json).filter((r) => r.email);
const ageDays = (Date.now() - new Date(o.created_at).getTime()) / 864e5;
const reasons = [];
if (o.status === "refunded") reasons.push("already refunded");
if (Number(o.total) > 100) reasons.push("over the 100 auto-refund limit");
if (ageDays > 30) reasons.push("order is older than 30 days");
if (past.length >= 2) reasons.push("third refund for this customer");
return [{ json: { order_id: o.order_id, email: o.email, amount: Number(o.total), charge_id: o.charge_id ?? null, auto: reasons.length === 0, already: o.status === "refunded", reasons, request_reason: $("Read the request").first().json.reason } }];`),
      route("Decision", { already: "$json.already", auto: "$json.auto" }),
      respond("Already refunded", "{ ok: true, status: 'already_refunded' }"),
      http("Refund at the processor", "PAYMENTS:/refunds", { body: "{ charge: $json.charge_id, amount: Math.round($json.amount * 100) }", headers: { "Idempotency-Key": "='refund-' + $json.order_id" } }),
      http("Record the refund", "DB:/refunds", { body: "{ order_id: $('Decision').first().json.order_id, email: $('Decision').first().json.email, amount: $('Decision').first().json.amount, auto: true, at: $now.toISO() }" }),
      http("Mark the order", "DB:/orders", { method: "PATCH", query: { order_id: "'eq.' + $('Decision').first().json.order_id" }, body: "{ status: 'refunded' }" }),
      respond("Refunded", "{ ok: true, status: 'refunded' }"),
      code("Review message", `const d = $input.first().json;
return [{ json: { channel: "#finance", level: "warn", text: "Refund request for order " + d.order_id + " (" + d.amount + ", " + d.email + ") needs a decision: " + d.reasons.join(", ") + ". Customer says: \\"" + d.request_reason + "\\"" } }];`),
      call("Ask finance", "notify"),
      respond("Under review", "{ ok: true, status: 'under_review' }"),
    ],
    flow: [
      ["Refund requested", "Read the request", "Valid?", "Load the order", "Order found?", "Past refunds", "Apply the policy", "Decision"],
      ["Valid?:1", "Invalid"],
      ["Order found?:1", "Unknown order"],
      ["Decision:0", "Already refunded"],
      ["Decision:1", "Refund at the processor", "Record the refund", "Mark the order", "Refunded"],
      ["Decision:2", "Review message", "Ask finance", "Under review"],
    ],
    story: [
      { title: "A refund is asked for", copy: "The order is loaded, along with every refund this customer has had before.", nodes: ["Refund requested", "Read the request", "Valid?", "Invalid", "Load the order", "Order found?", "Unknown order", "Past refunds"] },
      { title: "The policy is written down", copy: "Under 100, within 30 days, and not a third refund. Each rule that fails is named.", nodes: ["Apply the policy", "Decision", "Already refunded"] },
      { title: "Inside the policy: refunded now", copy: "The processor call carries an idempotency key, so a retry can never refund twice.", nodes: ["Refund at the processor", "Record the refund", "Mark the order", "Refunded"] },
      { title: "Outside it: a person decides", copy: "Finance gets the amount, the rules it failed and what the customer said.", nodes: ["Review message", "Ask finance", "Under review"] },
    ],
    tests: [
      { name: "a small recent order is refunded automatically", seed: { orders: [{ order_id: "1", email: "a@b.co", total: 40, charge_id: "ch_1", status: "delivered", created_at: new Date().toISOString() }] }, request: { body: { order_id: 1, reason: "Wrong size" } }, response: { body: { status: "refunded" } }, calls: [{ path: "/payments/refunds", body: { charge: "ch_1", amount: 4000 } }], table: { orders: [{ order_id: "1", status: "refunded" }] } },
      { name: "a large order goes to finance", seed: { orders: [{ order_id: "2", email: "a@b.co", total: 450, status: "delivered", created_at: new Date().toISOString() }] }, request: { body: { order_id: 2 } }, response: { body: { status: "under_review" } }, noCalls: ["/payments"], ran: ["Ask finance"] },
      { name: "a third refund goes to finance", seed: { orders: [{ order_id: "3", email: "a@b.co", total: 20, status: "delivered", created_at: new Date().toISOString() }], refunds: [{ email: "a@b.co" }, { email: "a@b.co" }] }, request: { body: { order_id: 3 } }, response: { body: { status: "under_review" } }, noCalls: ["/payments"] },
      { name: "asking twice refunds once", seed: { orders: [{ order_id: "4", email: "a@b.co", total: 40, charge_id: "ch_4", status: "delivered", created_at: new Date().toISOString() }] }, repeat: 2, request: { body: { order_id: 4 } }, response: { body: { status: "already_refunded" } }, callCount: { "/payments/refunds": 1 } },
      { name: "an unknown order is a 404", request: { body: { order_id: 999 } }, response: { status: 404 }, noCalls: ["/payments"] },
    ],
  }),

  define({
    ...commerce,
    id: "renewal-reminder",
    name: "Subscriptions · Renewal reminders",
    summary: "Tells subscribers a week before an annual renewal, once, with the amount and the date, so the charge is never a surprise.",
    integrations: ["Schedule", "Datastore", "Email"],
    nodes: [
      schedule("08:00 daily", "0 8 * * *"),
      http("Active subscriptions", "DB:/subscriptions", { method: "GET", query: { status: "'eq.active'", interval: "'eq.year'" }, alwaysOutput: true }),
      code("Renewing in a week", `const now = Date.now();
return $input.all().map((i) => i.json).filter((s) => s.email && s.renews_at).filter((s) => {
  const days = (new Date(s.renews_at).getTime() - now) / 864e5;
  return days > 0 && days <= 7 && s.reminded_for !== s.renews_at;
}).map((json) => ({ json }));`),
      http("Send the notice", "EMAIL:/emails", { body: "{ to: $json.email, subject: 'Your plan renews on ' + $json.renews_at.slice(0, 10), template: 'renewal-notice', data: { amount: $json.amount, currency: $json.currency, renews_at: $json.renews_at, manage_url: $json.manage_url } }" }),
      http("Mark reminded", "DB:/subscriptions", { method: "PATCH", query: { id: "'eq.' + $('Renewing in a week').item.json.id" }, body: "{ reminded_for: $('Renewing in a week').item.json.renews_at }" }),
    ],
    flow: [["08:00 daily", "Active subscriptions", "Renewing in a week", "Send the notice", "Mark reminded"]],
    story: [
      { title: "Annual plans only", copy: "Monthly subscribers do not need a notice every month.", nodes: ["08:00 daily", "Active subscriptions"] },
      { title: "Inside the last seven days", copy: "The reminder is tied to the renewal date itself, so next year's renewal gets its own.", nodes: ["Renewing in a week"] },
      { title: "One notice, with the amount", copy: "And a link to change or cancel.", nodes: ["Send the notice", "Mark reminded"] },
    ],
    tests: [
      { name: "reminds once for a renewal five days away", seed: { subscriptions: [{ id: "s1", email: "a@b.co", status: "active", interval: "year", amount: 290, renews_at: new Date(Date.now() + 5 * 864e5).toISOString() }] }, repeat: 2, input: [{}], callCount: { "/email/emails": 1 } },
      { name: "a renewal a month away is left alone", seed: { subscriptions: [{ id: "s1", email: "a@b.co", status: "active", interval: "year", renews_at: new Date(Date.now() + 30 * 864e5).toISOString() }] }, input: [{}], noCalls: ["/email"] },
    ],
  }),

  define({
    ...commerce,
    id: "invoice-intake",
    name: "Finance · Supplier invoice intake",
    summary: "Reads a supplier invoice with a model, checks the arithmetic and the duplicate history itself, and files it or sends it for review.",
    integrations: ["Webhook", "LLM", "Datastore", "Chat"],
    nodes: [
      webhook("Invoice received", "invoice-received", { respond: "immediately" }),
      code("Read the upload", `const b = $input.first().json.body ?? {};
return [{ json: { file_url: b.file_url ?? null, text: String(b.text ?? "").slice(0, 12000), received_from: b.from ?? null } }];`),
      llm("Extract the fields", { task: "extract", system: "Extract from this supplier invoice. Reply with JSON: { vendor: string, invoice_number: string, total: number, currency: string, due_date: 'YYYY-MM-DD', confidence: 0-1 }. Use null for anything not present. Do not guess.", user: "$json.text", onFail: "continue" }),
      parseLlm("Read the fields", { from: "Read the upload", fallback: { vendor: null, invoice_number: null, total: null, confidence: 0 } }),
      http("Seen this invoice?", "DB:/supplier_invoices", { method: "GET", query: { vendor: "'eq.' + $json.vendor", invoice_number: "'eq.' + $json.invoice_number" }, alwaysOutput: true }),
      code("Check it", `const f = $("Read the fields").first().json;
const duplicate = $input.all().some((i) => i.json.invoice_number);
const problems = [];
if (f.parse_error) problems.push("the model reply could not be read");
if (!f.vendor || !f.invoice_number) problems.push("vendor or invoice number missing");
if (typeof f.total !== "number" || !(f.total > 0)) problems.push("total is missing or not positive");
if (f.due_date && Number.isNaN(Date.parse(f.due_date))) problems.push("due date is not a date");
if ((f.confidence ?? 0) < 0.8) problems.push("low confidence (" + (f.confidence ?? 0) + ")");
if (duplicate) problems.push("an invoice with this number from this vendor already exists");
return [{ json: { ...f, duplicate, problems, ok: problems.length === 0 } }];`),
      iff("Clean?", "$json.ok"),
      http("File it", "DB:/supplier_invoices", { body: "{ vendor: $json.vendor, invoice_number: $json.invoice_number, total: $json.total, currency: $json.currency, due_date: $json.due_date, file_url: $json.file_url, status: 'awaiting_payment', at: $now.toISO() }" }),
      http("Queue for review", "DB:/invoice_review", { body: "{ file_url: $json.file_url, extracted: { vendor: $json.vendor, invoice_number: $json.invoice_number, total: $json.total }, problems: $json.problems, at: $now.toISO() }" }),
      code("Review message", `const f = $("Clean?").first().json;
return [{ json: { channel: "#finance", level: "warn", text: "An invoice" + (f.vendor ? " from " + f.vendor : "") + " needs a manual check: " + f.problems.join("; ") + "." } }];`),
      call("Tell finance", "notify"),
    ],
    flow: [
      ["Invoice received", "Read the upload", "Extract the fields", "Read the fields", "Seen this invoice?", "Check it", "Clean?", "File it"],
      ["Clean?:1", "Queue for review", "Review message", "Tell finance"],
    ],
    story: [
      { title: "An invoice arrives", copy: "As text from the upload or the email it came in.", nodes: ["Invoice received", "Read the upload"] },
      { title: "A model reads the fields", copy: "Vendor, number, total, due date, and how sure it is. It is told to return null and never to guess.", nodes: ["Extract the fields", "Read the fields"] },
      { title: "Code checks the model's work", copy: "Is the total a positive number? Is the date a date? Has this vendor sent this number before? None of that is left to the model.", nodes: ["Seen this invoice?", "Check it", "Clean?"] },
      { title: "Clean invoices are filed", copy: "Ready for the payment run.", nodes: ["File it"] },
      { title: "Anything doubtful goes to a person", copy: "With the list of what was wrong, so the check takes seconds.", nodes: ["Queue for review", "Review message", "Tell finance"] },
    ],
    tests: [
      { name: "a clean invoice is filed", request: { body: { text: "Invoice INV-1042 from Acme Supplies. Total 1280.50 USD due 2026-11-15", file_url: "https://f.example/1.pdf" } }, calls: [{ path: "/db/supplier_invoices", body: { vendor: "Acme Supplies", invoice_number: "INV-1042", total: 1280.5, status: "awaiting_payment" } }], notRan: ["Queue for review"] },
      { name: "a duplicate is caught and sent for review", seed: { supplier_invoices: [{ vendor: "Acme Supplies", invoice_number: "INV-1042" }] }, request: { body: { text: "Invoice INV-1042 from Acme Supplies" } }, ran: ["Tell finance"], output: { node: "Check it", json: { duplicate: true, ok: false } } },
      { name: "low confidence goes for review", routes: [{ path: "/llm/chat/completions", response: { choices: [{ message: { content: JSON.stringify({ vendor: "Acme", invoice_number: "9", total: 10, confidence: 0.4 }) } }] } }], request: { body: { text: "blurry" } }, ran: ["Queue for review"], notRan: ["File it"] },
      { name: "a negative total goes for review", routes: [{ path: "/llm/chat/completions", response: { choices: [{ message: { content: JSON.stringify({ vendor: "Acme", invoice_number: "9", total: -10, confidence: 0.95 }) } }] } }], request: { body: { text: "x" } }, ran: ["Queue for review"], notRan: ["File it"] },
    ],
  }),
];
