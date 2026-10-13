/**
 * Built and run in production, rebuilt here for publication: the data and
 * operations workflows.
 *
 * Node names, order and branches follow the original canvases. What is inside
 * each node (field names, addresses, product ids) was written again for this
 * library, and every name that belonged to the business is a placeholder.
 */
import { webhook, schedule, manual, http, respond, batches, splitOut, set, filter, removeDuplicates, aggregate, sort, define } from "../lib/wf.mjs";
import { api, bubble, sheets, triggers } from "../lib/nodes.mjs";

const real = { source: "production", folder: "production/operations", category: "Data and operations" };

const soon = (days) => new Date(Date.now() + days * 864e5).toISOString();
const EVENTS_LOGIN = { path: "/events/api/auth/login", response: { token: "session-token" } };

export default [
  define({
    ...real,
    tier: "production",
    id: "unified-event-api",
    name: "Events · Unified event API",
    summary: "One web address that returns every active event. It signs in to the self-hosted event platform, reads its events, adds the Luma events kept in a Google Sheet, drops the past and inactive ones, and answers with one list in one format.",
    nodes: [
      webhook("get_request", "events", { method: "GET" }),
      http("platform_login", "=$env.EVENTS_BASE_URL + '/api/auth/login'", { body: "{ email: $env.EVENTS_EMAIL, password: $env.EVENTS_PASSWORD }" }),
      http("get_events", "=$env.EVENTS_BASE_URL + '/api/events'", { method: "GET", headers: { Authorization: "='Bearer ' + $json.token" } }),
      sheets.read("get_external_events", "luma-events-sheet", "Luma events", { once: true }),
      {
        ...set(
          "set_data",
          {
            events: "($('get_events').first().json.events ?? []).map((e) => Object.assign({}, e, { source: 'platform' })).concat($('get_external_events').all().map((i) => i.json).filter((e) => e.name).map((e) => ({ id: e.api_id, title: e.name, starts_at: e.start_at, ends_at: e.end_at, url: e.url, status: 'active', source: 'luma' })))",
          },
          { types: { events: "array" } },
        ),
        executeOnce: true,
      },
      { ...splitOut("split_data", "events"), alwaysOutputData: true },
      filter("check_active", "$json.status === 'active' && new Date($json.ends_at ?? $json.starts_at) >= new Date()", { alwaysOutput: true }),
      set("data_manipulation", { id: "$json.id", title: "$json.title", starts_at: "$json.starts_at", ends_at: "$json.ends_at ?? ''", url: "$json.url ?? ''", source: "$json.source" }),
      respond("respond", "{ count: $input.all().filter((i) => i.json.id).length, events: $input.all().map((i) => i.json).filter((e) => e.id) }"),
    ],
    flow: [["get_request", "platform_login", "get_events", "get_external_events", "set_data", "split_data", "check_active", "data_manipulation", "respond"]],
    sections: [
      { title: "Authentication", nodes: ["get_request", "platform_login"] },
      { title: "Get events", nodes: ["get_events", "get_external_events"] },
      { title: "Data manipulation", nodes: ["set_data", "split_data", "check_active", "data_manipulation", "respond"] },
    ],
    story: [
      { title: "A request comes in", copy: "The workflow signs in to the event platform with its own account and keeps the session token for the next call.", nodes: ["get_request", "platform_login"] },
      { title: "Two sources are read", copy: "The platform's own events come from its API. The Luma events are read from the Google Sheet they are kept in.", nodes: ["get_events", "get_external_events"] },
      { title: "One list goes back", copy: "Both sets are put in one shape and split into single events. Past and inactive ones are dropped, and what is left is the answer. No active events is an empty list, not an error.", nodes: ["set_data", "split_data", "check_active", "data_manipulation", "respond"] },
    ],
    tests: [
      {
        name: "answers with platform and Luma events in one list",
        seed: { sheet_data: [{ api_id: "evt-luma-1", name: "Community meetup", start_at: soon(3), end_at: soon(3.1), url: "https://lu.ma/meetup" }] },
        routes: [EVENTS_LOGIN, { path: "/events/api/events", response: { events: [{ id: "p1", title: "Product workshop", starts_at: soon(2), ends_at: soon(2.1), url: "https://events.example.com/p1", status: "active" }] } }],
        request: {},
        response: { status: 200, body: { count: 2, events: [{ id: "p1", source: "platform" }, { id: "evt-luma-1", title: "Community meetup", source: "luma" }] } },
        calls: [{ path: "/events/api/events", method: "GET" }],
      },
      {
        name: "leaves out past and inactive events",
        seed: { sheet_data: [{ api_id: "old-luma", name: "Last month's meetup", start_at: soon(-30), end_at: soon(-29.9), url: "https://lu.ma/old" }] },
        routes: [EVENTS_LOGIN, { path: "/events/api/events", response: { events: [{ id: "p1", title: "Workshop", starts_at: soon(2), ends_at: soon(2.1), status: "active" }, { id: "p2", title: "Cancelled talk", starts_at: soon(4), ends_at: soon(4.1), status: "cancelled" }] } }],
        request: {},
        response: { status: 200, body: { count: 1, events: [{ id: "p1" }] } },
      },
      {
        name: "answers with an empty list when nothing is active",
        routes: [EVENTS_LOGIN, { path: "/events/api/events", response: { events: [] } }],
        request: {},
        response: { status: 200, body: { count: 0, events: [] } },
      },
      {
        name: "sends the session token it was given",
        routes: [EVENTS_LOGIN, { path: "/events/api/events", response: { events: [] } }],
        request: {},
        calls: [{ path: "/events/api/auth/login", body: { email: "automation@example.com" } }],
        output: { node: "platform_login", json: { token: "session-token" } },
      },
    ],
  }),

  define({
    ...real,
    tier: "production",
    id: "post-purchase-email",
    name: "Payments · Post-purchase email",
    summary: "When a Stripe checkout completes, reads the line items, checks which product was bought, and sends that product's email through SendGrid. A purchase of anything else sends nothing.",
    nodes: [
      triggers.stripe("on_checkout_success", ["checkout.session.completed"]),
      api("stripe", "stripeApi", "get_line_items", "GET", "'https://api.stripe.com/v1/checkout/sessions/' + $json.data.object.id + '/line_items'"),
      filter("if_product", "($json.data ?? []).some((line) => line.price?.product === 'prod_course')"),
      api("sendgrid", "sendGridApi", "send_email", "POST", "'https://api.sendgrid.com/v3/mail/send'", {
        body: "{ from: { email: 'hello@example.com', name: 'Acme' }, template_id: 'd-course-welcome', personalizations: [ { to: [ { email: $('on_checkout_success').first().json.data.object.customer_details.email } ], dynamic_template_data: { name: $('on_checkout_success').first().json.data.object.customer_details.name ?? '' } } ] }",
      }),
    ],
    flow: [["on_checkout_success", "get_line_items", "if_product", "send_email"]],
    sections: [
      { title: "Get checkout details", nodes: ["on_checkout_success", "get_line_items"] },
      { title: "Email", nodes: ["if_product", "send_email"] },
    ],
    story: [
      { title: "A checkout completes", copy: "Stripe sends the event. The event does not say what was bought, so the line items are fetched from Stripe.", nodes: ["on_checkout_success", "get_line_items"] },
      { title: "Only the right product", copy: "The line items are checked for the product this email belongs to. Anything else stops here.", nodes: ["if_product"] },
      { title: "The email goes out", copy: "SendGrid sends the product's template to the buyer's address. The call retries if SendGrid is briefly down.", nodes: ["send_email"] },
    ],
    tests: [
      {
        name: "sends the product's email to the buyer",
        routes: [{ path: "/v1/checkout/sessions/cs_1/line_items", response: { data: [{ price: { product: "prod_course" }, quantity: 1 }] } }],
        input: [{ type: "checkout.session.completed", data: { object: { id: "cs_1", customer_details: { email: "buyer@example.com", name: "Sam" } } } }],
        calls: [{ to: "sendgrid", path: "/v3/mail/send", body: { template_id: "d-course-welcome", personalizations: [{ to: [{ email: "buyer@example.com" }], dynamic_template_data: { name: "Sam" } }] } }],
      },
      {
        name: "a different product sends nothing",
        routes: [{ path: "/v1/checkout/sessions/cs_2/line_items", response: { data: [{ price: { product: "prod_other" }, quantity: 1 }] } }],
        input: [{ type: "checkout.session.completed", data: { object: { id: "cs_2", customer_details: { email: "buyer@example.com" } } } }],
        noCalls: ["sendgrid"],
      },
      {
        name: "retries when SendGrid is briefly down",
        routes: [{ path: "/v1/checkout/sessions/cs_3/line_items", response: { data: [{ price: { product: "prod_course" } }] } }],
        fail: [{ path: "/v3/mail/send", times: 2 }],
        input: [{ type: "checkout.session.completed", data: { object: { id: "cs_3", customer_details: { email: "buyer@example.com" } } } }],
        callCount: { "sendgrid /v3/mail/send": 3 },
      },
    ],
  }),

  define({
    ...real,
    tier: "production",
    id: "cross-team-data-sync",
    name: "Data · Cross-team data sync",
    summary: "On a schedule, reads claims and users from the Bubble app's database, joins and sorts them, then clears a shared Google Sheet and refills it, so people without database access always see current data.",
    nodes: [
      schedule("schedule", { hours: 1 }),
      bubble.all("get_claims", "claim"),
      bubble.all("get_users", "user"),
      { name: "merge", type: "n8n-nodes-base.merge", typeVersion: 3, parameters: { mode: "combine", combineBy: "combineByFields", advanced: true, mergeByFields: { values: [{ field1: "user", field2: "_id" }] }, joinMode: "enrichInput1", options: { clashHandling: { values: { resolveClash: "preferInput1" } } } } },
      sort("sort", "Created Date", "descending"),
      sheets.clear("clear_sheet", "team-dashboard-sheet", "Dashboard", { once: true }),
      { name: "merge_2", type: "n8n-nodes-base.merge", typeVersion: 3, parameters: { mode: "chooseBranch", chooseBranchMode: "waitForAll", output: "specifiedInput", useDataOfInput: 1 } },
      sheets.upsert("create_row", "team-dashboard-sheet", "Dashboard", "claim_id", { claim_id: "$json._id", email: "$json.email ?? ''", status: "$json.status ?? ''", amount: "$json.amount ?? ''", created: "$json['Created Date'] ?? ''" }),
    ],
    flow: [
      ["schedule", "get_claims", "merge"],
      ["schedule", "get_users", "merge@1"],
      ["merge", "sort", "merge_2"],
      ["sort", "clear_sheet", "merge_2@1"],
      ["merge_2", "create_row"],
    ],
    story: [
      { title: "Two tables are read", copy: "On each run the claims and the users are read from the Bubble database.", nodes: ["schedule", "get_claims", "get_users"] },
      { title: "Joined and sorted", copy: "Each claim is matched to its user, and the result is sorted newest first.", nodes: ["merge", "sort"] },
      { title: "The sheet is replaced", copy: "The old rows are cleared, and only once that has finished are the new rows written. If the database returns nothing, the sheet is left as it was.", nodes: ["clear_sheet", "merge_2", "create_row"] },
    ],
    tests: [
      {
        name: "clears the sheet, then writes each claim with its user",
        seed: {
          bubble_claim: [{ _id: "c1", user: "u1", status: "open", amount: 120, "Created Date": "2026-10-01T09:00:00Z" }, { _id: "c2", user: "u2", status: "paid", amount: 80, "Created Date": "2026-10-03T09:00:00Z" }],
          bubble_user: [{ _id: "u1", email: "ana@example.com" }, { _id: "u2", email: "ben@example.com" }],
          sheet_header: [{ columns: ["claim_id", "email", "status", "amount", "created"] }],
          sheet_data: [{ claim_id: "stale", email: "old@example.com", status: "open", amount: 1, created: "2026-01-01" }],
        },
        input: [{}],
        ran: ["clear_sheet", "create_row"],
        calls: [{ to: "googleSheets", method: "POST", path: "/v4/spreadsheets/team-dashboard-sheet/values/'Dashboard':clear" }, { to: "googleSheets", method: "PUT", body: { values: [["c1", "ana@example.com", "open", 120]] } }, { to: "googleSheets", method: "PUT", body: { values: [["c2", "ben@example.com", "paid", 80]] } }],
      },
      {
        name: "sorts the newest claim first",
        seed: {
          bubble_claim: [{ _id: "c1", user: "u1", "Created Date": "2026-10-01T09:00:00Z" }, { _id: "c2", user: "u1", "Created Date": "2026-10-03T09:00:00Z" }],
          bubble_user: [{ _id: "u1", email: "ana@example.com" }],
          sheet_header: [{ columns: ["claim_id", "email", "status", "amount", "created"] }],
        },
        input: [{}],
        output: { node: "merge_2", json: { _id: "c2" } },
        callCount: { "googleSheets /v4/spreadsheets/team-dashboard-sheet/values/'Dashboard':clear": 1 },
      },
      {
        name: "an empty database leaves the sheet alone",
        seed: { bubble_claim: [], bubble_user: [{ _id: "u1", email: "ana@example.com" }] },
        input: [{}],
        notRan: ["clear_sheet", "create_row"],
        noCalls: ["googleSheets"],
      },
    ],
  }),

  define({
    ...real,
    tier: "block",
    id: "bulk-object-creator",
    name: "Data · Bulk object creator",
    summary: "One click reads every row of a sheet and creates an object in the Bubble database for each, one at a time.",
    nodes: [
      manual("When clicking 'Execute workflow'"),
      sheets.read("get_data", "import-sheet", "Import", { alwaysOutput: false }),
      batches("for_each_data", 1),
      bubble.create("create_object", "event", { title: "$json.title", date: "$json.date ?? ''", location: "$json.location ?? ''" }),
    ],
    flow: [["When clicking 'Execute workflow'", "get_data", "for_each_data:1", "create_object", "for_each_data"]],
    story: [
      { title: "One click", copy: "The rows to import are read from the sheet.", nodes: ["When clicking 'Execute workflow'", "get_data"] },
      { title: "One object per row", copy: "Each row becomes an object in Bubble, with its columns mapped to the object's fields. A row at a time keeps the app's rate limit safe.", nodes: ["for_each_data", "create_object"] },
    ],
    tests: [
      {
        name: "creates one object per row",
        seed: { sheet_data: [{ title: "Launch party", date: "2026-11-01", location: "Manila" }, { title: "Workshop", date: "2026-11-08", location: "Online" }, { title: "Meetup", date: "2026-11-15", location: "Cebu" }] },
        input: [{}],
        callCount: { "bubble /api/1.1/obj/event": 3 },
        table: { bubble_event: [{ title: "Launch party", location: "Manila" }, { title: "Meetup", date: "2026-11-15" }] },
      },
      { name: "an empty sheet creates nothing", seed: { sheet_header: [{ columns: ["title", "date", "location"] }] }, input: [{}], noCalls: ["bubble"] },
    ],
  }),

  define({
    ...real,
    tier: "block",
    id: "database-cleansing",
    name: "Data · Database cleansing",
    summary: "On demand, reads every object of one type from the Bubble database, keeps the first of each set of duplicates as the master, and deletes the rest.",
    nodes: [
      manual("execute"),
      bubble.all("get_objects_1", "contact", { filled: ["email"] }),
      removeDuplicates("remove_duplicates", "email"),
      filter("filter_criteria_1", "!!$json.email"),
      aggregate("aggregate", { _id: "master_ids" }),
      bubble.all("get_objects_2", "contact"),
      filter("filter_criteria_3", "!!$json.email && !$('aggregate').first().json.master_ids.includes($json._id)"),
      bubble.remove("delete_object", "contact", "$json._id"),
    ],
    flow: [["execute", "get_objects_1", "remove_duplicates", "filter_criteria_1", "aggregate", "get_objects_2", "filter_criteria_3", "delete_object"]],
    story: [
      { title: "Find the masters", copy: "Every object that has an email is read, and the first one for each email is kept as the master. Objects with no email are never asked for: they cannot be called duplicates of anything.", nodes: ["execute", "get_objects_1", "remove_duplicates", "filter_criteria_1", "aggregate"] },
      { title: "Isolate the duplicates", copy: "The objects are read again and compared with the list of masters. Only an object that has an email and is not a master goes forward.", nodes: ["get_objects_2", "filter_criteria_3"] },
      { title: "Delete them", copy: "Each duplicate is deleted by its id. With no duplicates, nothing is deleted.", nodes: ["delete_object"] },
    ],
    tests: [
      {
        name: "deletes the duplicates and keeps the first of each",
        seed: { bubble_contact: [{ _id: "a1", email: "ana@example.com" }, { _id: "b1", email: "ben@example.com" }, { _id: "a2", email: "ana@example.com" }, { _id: "a3", email: "ana@example.com" }] },
        input: [{}],
        calls: [{ to: "bubble", method: "DELETE", path: "/api/1.1/obj/contact/a2" }, { to: "bubble", method: "DELETE", path: "/api/1.1/obj/contact/a3" }],
        table: { bubble_contact: [{ _id: "a1" }, { _id: "b1" }] },
        callCount: { "bubble /api/1.1/obj/contact/a1": 0, "bubble /api/1.1/obj/contact/b1": 0 },
      },
      {
        name: "deletes nothing when there are no duplicates",
        seed: { bubble_contact: [{ _id: "a1", email: "ana@example.com" }, { _id: "b1", email: "ben@example.com" }] },
        input: [{}],
        notRan: ["delete_object"],
        table: { bubble_contact: [{ _id: "a1" }, { _id: "b1" }] },
      },
      {
        name: "never deletes an object that has no email",
        seed: { bubble_contact: [{ _id: "n1" }, { _id: "n2" }, { _id: "a1", email: "ana@example.com" }] },
        input: [{}],
        notRan: ["delete_object"],
        table: { bubble_contact: [{ _id: "n1" }, { _id: "n2" }, { _id: "a1" }] },
      },
    ],
  }),
];
