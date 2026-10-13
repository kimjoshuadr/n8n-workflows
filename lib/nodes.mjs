/**
 * The platform nodes: one helper per thing a workflow does on a platform.
 *
 * Each helper builds the platform's own n8n node (so the canvas shows the
 * platform, and its credential is the platform's credential) and tags it with
 * the platform it belongs to. That tag is where a workflow's list of platforms
 * comes from, in the README, the catalogue and the sticky note: it is read off
 * the nodes, never typed.
 *
 * Every value argument here is a JavaScript expression, evaluated per item. A
 * literal is written as a quoted string inside it: "'#sales'".
 */
import { uid } from "./wf.mjs";

const ex = (v) => `={{ ${v} }}`;
const B = "n8n-nodes-base.";
const L = "@n8n/n8n-nodes-langchain.";

/** Retries, failure branches and "keep going on an empty answer", the same on every platform node. */
function behave({ retry = true, onFail, alwaysOutput = false, once = false } = {}) {
  const extra = {};
  if (retry) Object.assign(extra, { retryOnFail: true, maxTries: 3, waitBetweenTries: 1000 });
  if (alwaysOutput) extra.alwaysOutputData = true;
  if (once) extra.executeOnce = true;
  if (onFail === "branch") extra.onError = "continueErrorOutput";
  if (onFail === "continue") extra.onError = "continueRegularOutput";
  return extra;
}

const app = (platform, name, type, typeVersion, parameters, opts) => ({ name, type: (type.includes(".") ? "" : B) + type, typeVersion, parameters, platform, ...behave(opts) });

const fields = (map) => ({ fieldValues: Object.entries(map).map(([fieldId, v]) => ({ fieldId, fieldValue: ex(v) })) });

/* ------------------------------------------------------------------ Supabase */

/**
 * Filters are written as { column: expression } for "equals", or
 * { column: [operator, expression] } for gt, gte, lt, lte, neq, is, like.
 * They are sent as the node's own structured conditions. The node's free-text
 * filter is not used: given several items, it sends a corrupted filter for
 * every item after the first.
 */
const where = (filter) => ({
  filterType: "manual",
  matchType: "allFilters",
  filters: { conditions: Object.entries(filter).map(([keyName, v]) => (Array.isArray(v) ? { keyName, condition: v[0], keyValue: ex(v[1]) } : { keyName, condition: "eq", keyValue: ex(v) })) },
});

export const db = {
  /** One row in. With a unique constraint on the table, a repeat fails: use `onFail: "branch"`. */
  insert: (name, table, row, opts) => app("supabase", name, "supabase", 1, { resource: "row", operation: "create", tableId: table, dataToSend: "defineBelow", fieldsUi: fields(row) }, opts),
  find: (name, table, filter, { limit, ...opts } = {}) =>
    app("supabase", name, "supabase", 1, { resource: "row", operation: "getAll", tableId: table, ...(limit ? { returnAll: false, limit } : { returnAll: true }), ...(filter && Object.keys(filter).length ? where(filter) : {}) }, { alwaysOutput: true, ...opts }),
  update: (name, table, filter, row, opts) =>
    app("supabase", name, "supabase", 1, { resource: "row", operation: "update", tableId: table, ...where(filter), dataToSend: "defineBelow", fieldsUi: fields(row) }, { alwaysOutput: true, ...opts }),
  /**
   * Insert, or update the row that already holds this value of `on`. The node
   * has no upsert, so this goes to Supabase's REST API with the same credential.
   * `body` is one row or a list of rows, sent as one request.
   */
  upsert: (name, table, on, body, opts) =>
    api("supabase", "supabaseApi", name, "POST", `'https://acme.supabase.co/rest/v1/${table}'`, { query: { on_conflict: `'${on}'` }, headers: { Prefer: "'resolution=merge-duplicates,return=representation'" }, body, ...opts }),
  remove: (name, table, filter, opts) => app("supabase", name, "supabase", 1, { resource: "row", operation: "delete", tableId: table, ...where(filter) }, { alwaysOutput: true, ...opts }),
};

/* --------------------------------------------------------------------- Slack */

export const slack = {
  post: (name, channel, text, opts) =>
    app("slack", name, "slack", 2.3, { resource: "message", operation: "post", select: "channel", channelId: { __rl: true, mode: "name", value: ex(channel) }, text: ex(text), otherOptions: { includeLinkToWorkflow: false } }, opts),
};

/* ------------------------------------------------------------------ SendGrid */

export const sendgrid = {
  /** A dynamic template, so the wording lives in SendGrid where a person can edit it. */
  send: (name, { to, template, data = {}, sendAt, from = "'hello@example.com'", fromName = "'Acme'" }, opts) =>
    app("sendgrid", name, "sendGrid", 1, {
      resource: "mail", operation: "send", fromEmail: ex(from), fromName: ex(fromName), toEmail: ex(to),
      dynamicTemplate: true, templateId: ex(template),
      dynamicTemplateFields: { fields: Object.entries(data).map(([key, v]) => ({ key, value: ex(v) })) },
      additionalFields: sendAt ? { sendAt: ex(sendAt) } : {},
    }, opts),
  /** Plain text, for messages written by the workflow itself. */
  text: (name, { to, subject, text, from = "'hello@example.com'", fromName = "'Acme'" }, opts) =>
    app("sendgrid", name, "sendGrid", 1, { resource: "mail", operation: "send", fromEmail: ex(from), fromName: ex(fromName), toEmail: ex(to), subject: ex(subject), dynamicTemplate: false, contentType: "text/plain", contentValue: ex(text), additionalFields: {} }, opts),
};

/* ------------------------------------------------------------------- HubSpot */

export const hubspot = {
  contact: (name, email, props, opts) => app("hubspot", name, "hubspot", 2.1, { authentication: "appToken", resource: "contact", operation: "upsert", email: ex(email), additionalFields: Object.fromEntries(Object.entries(props).map(([k, v]) => [k, ex(v)])), options: {} }, opts),
  deal: (name, stage, props, opts) => app("hubspot", name, "hubspot", 2.1, { authentication: "appToken", resource: "deal", operation: "create", stage: ex(stage), additionalFields: Object.fromEntries(Object.entries(props).map(([k, v]) => [k, ex(v)])) }, opts),
  /** Something that happened, recorded on the CRM timeline as a completed task. HubSpot's node has no plain note. */
  note: (name, body, { deals, contacts } = {}, opts) =>
    app("hubspot", name, "hubspot", 2.1, { authentication: "appToken", resource: "engagement", operation: "create", type: "task", metadata: { subject: ex(body), body: ex(body), status: "COMPLETED" }, additionalFields: { associations: { ...(deals ? { dealIds: ex(deals) } : {}), ...(contacts ? { contactIds: ex(contacts) } : {}) } } }, opts),
  task: (name, { subject, body = "''" }, { deals } = {}, opts) =>
    app("hubspot", name, "hubspot", 2.1, { authentication: "appToken", resource: "engagement", operation: "create", type: "task", metadata: { subject: ex(subject), body: ex(body), status: "NOT_STARTED" }, additionalFields: { associations: deals ? { dealIds: ex(deals) } : {} } }, opts),
  search: (name, query, opts) => app("hubspot", name, "hubspot", 2.1, { authentication: "appToken", resource: "contact", operation: "search", returnAll: false, limit: 100, filterGroupsUi: {}, additionalFields: { query: ex(query) } }, { alwaysOutput: true, ...opts }),
};

/* ------------------------------------------------------------------- Zendesk */

export const zendesk = {
  create: (name, { subject, body, ...more }, opts) => app("zendesk", name, "zendesk", 1, { resource: "ticket", operation: "create", description: ex(body), additionalFields: { subject: ex(subject), ...Object.fromEntries(Object.entries(more).map(([k, v]) => [k, Array.isArray(v) ? v : ex(v)])) } }, opts),
  update: (name, id, changes, opts) => app("zendesk", name, "zendesk", 1, { resource: "ticket", operation: "update", id: ex(id), updateFields: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, Array.isArray(v) ? v : ex(v)])) }, opts),
  search: (name, query, opts) => app("zendesk", name, "zendesk", 1, { resource: "ticket", operation: "getAll", returnAll: true, options: { query: ex(query) } }, { alwaysOutput: true, ...opts }),
};

/* ------------------------------------------------------------------- Discord */

const rl = (v) => ({ __rl: true, mode: "id", value: ex(v) });
export const GUILD = "'100000000000000001'";
export const discord = {
  send: (name, channel, content, opts) => app("discord", name, "discord", 2, { authentication: "botToken", resource: "message", operation: "send", guildId: rl(GUILD), channelId: rl(channel), content: ex(content), options: {} }, opts),
  remove: (name, channel, message, opts) => app("discord", name, "discord", 2, { authentication: "botToken", resource: "message", operation: "deleteMessage", guildId: rl(GUILD), channelId: rl(channel), messageId: ex(message) }, opts),
  addRole: (name, user, role, opts) => app("discord", name, "discord", 2, { authentication: "botToken", resource: "member", operation: "roleAdd", guildId: rl(GUILD), userId: rl(user), role: [role] }, opts),
};

/* -------------------------------------------------------------------- others */

export const wordpress = {
  publish: (name, { title, content, status = "'publish'" }, opts) => app("wordpress", name, "wordpress", 1, { resource: "post", operation: "create", title: ex(title), additionalFields: { content: ex(content), status: ex(status) } }, opts),
};

export const drive = {
  /** Files in a folder whose name contains `name`. */
  search: (name, { name: query, folder }, opts) =>
    app("googleDrive", name, "googleDrive", 3, { resource: "fileFolder", operation: "search", searchMethod: "name", queryString: ex(query), returnAll: true, filter: { folderId: { __rl: true, mode: "id", value: folder } }, options: {} }, { alwaysOutput: true, ...opts }),
  /** The file itself, as binary data on the item. */
  download: (name, file, opts) => app("googleDrive", name, "googleDrive", 3, { resource: "file", operation: "download", fileId: { __rl: true, mode: "id", value: ex(file) }, options: {} }, opts),
  /** A new text file in a folder. */
  createText: (name, { content, as, folder }, opts) =>
    app("googleDrive", name, "googleDrive", 3, { resource: "file", operation: "createFromText", content: ex(content), name: ex(as), driveId: { __rl: true, mode: "list", value: "My Drive" }, folderId: { __rl: true, mode: "id", value: folder }, options: {} }, opts),
  /** Copies a file into a folder, under a new name. */
  copy: (name, { file, folder, as }, opts) =>
    app("googleDrive", name, "googleDrive", 3, { resource: "file", operation: "copy", fileId: { __rl: true, mode: "id", value: ex(file) }, name: ex(as), sameFolder: false, driveId: { __rl: true, mode: "list", value: "My Drive" }, folderId: { __rl: true, mode: "id", value: folder }, options: {} }, opts),
};

export const bamboohr = {
  /** One employee's record. The node has no way to ask for chosen fields only, so this is BambooHR's API with its credential. */
  employee: (name, id, opts) =>
    api("bamboohr", "bambooHrApi", name, "GET", `'https://api.bamboohr.com/api/gateway.php/acme/v1/employees/' + ${id}`, { query: { fields: "'firstName,lastName,workEmail,jobTitle,supervisorEmail,hireDate,location'" }, headers: { Accept: "'application/json'" }, ...opts }),
};

export const twilio = {
  sms: (name, to, message, opts) => app("twilio", name, "twilio", 1, { resource: "sms", operation: "send", from: "+15550000", to: ex(to), message: ex(message), options: {} }, opts),
};

export const clearbit = {
  person: (name, email, opts) => app("clearbit", name, "clearbit", 1, { resource: "person", operation: "enrich", email: ex(email), additionalFields: {} }, opts),
};

export const calendar = {
  today: (name, opts) => app("googleCalendar", name, "googleCalendar", 1.3, { resource: "event", operation: "getAll", calendar: { __rl: true, mode: "id", value: "kim@example.com" }, returnAll: true, timeMin: "={{ $now.startOf('day').toISO() }}", timeMax: "={{ $now.endOf('day').toISO() }}", options: {} }, { alwaysOutput: true, ...opts }),
  book: (name, { title, start, end, attendees }, opts) => app("googleCalendar", name, "googleCalendar", 1.3, { resource: "event", operation: "create", calendar: { __rl: true, mode: "id", value: "kim@example.com" }, start: ex(start), end: ex(end), additionalFields: { summary: ex(title), attendees: [ex(attendees)] } }, opts),
};

export const gmail = {
  send: (name, { to, subject, text }, opts) => app("gmail", name, "gmail", 2.1, { resource: "message", operation: "send", sendTo: ex(to), subject: ex(subject), emailType: "text", message: ex(text), options: { appendAttribution: false } }, opts),
  reply: (name, messageId, text, opts) => app("gmail", name, "gmail", 2.1, { resource: "message", operation: "reply", messageId: ex(messageId), emailType: "text", message: ex(text), options: {} }, opts),
  archive: (name, messageId, opts) => app("gmail", name, "gmail", 2.1, { resource: "message", operation: "removeLabels", messageId: ex(messageId), labelIds: ["INBOX"] }, opts),
  label: (name, messageId, label, opts) => app("gmail", name, "gmail", 2.1, { resource: "message", operation: "addLabels", messageId: ex(messageId), labelIds: [label] }, opts),
};

export const mailchimp = {
  subscribe: (name, email, { status = "subscribed", tags } = {}, opts) => app("mailchimp", name, "mailchimp", 1, { resource: "member", operation: "create", list: "main-list", email: ex(email), status, options: tags ? { tags: ex(tags) } : {} }, opts),
};

/**
 * A call to a platform's API where its node has no operation for the job. It
 * still signs with the platform's own credential, and is still tagged with the
 * platform. `url` is an expression.
 */
export const api = (platform, credentialType, name, method, url, { body, query, headers = {}, ...opts } = {}) => ({
  ...app(platform, name, "httpRequest", 4.2, {
    method,
    url: ex(url),
    ...(credentialType === "httpHeaderAuth" ? { authentication: "genericCredentialType", genericAuthType: "httpHeaderAuth" } : { authentication: "predefinedCredentialType", nodeCredentialType: credentialType }),
    ...(Object.keys(headers).length ? { sendHeaders: true, headerParameters: { parameters: Object.entries(headers).map(([k, v]) => ({ name: k, value: ex(v) })) } } : {}),
    ...(query ? { sendQuery: true, queryParameters: { parameters: Object.entries(query).map(([k, v]) => ({ name: k, value: ex(v) })) } } : {}),
    ...(body !== undefined ? { sendBody: true, specifyBody: "json", jsonBody: `={{ JSON.stringify(${body}) }}` } : {}),
    options: { timeout: 15000 },
  }, opts),
});

export const stripe = {
  refund: (name, { charge, amount, key }, opts) => api("stripe", "stripeApi", name, "POST", "'https://api.stripe.com/v1/refunds'", { body: `{ charge: ${charge}, amount: ${amount} }`, headers: { "Idempotency-Key": key }, ...opts }),
  charges: (name, { from, to }, opts) => api("stripe", "stripeApi", name, "GET", "'https://api.stripe.com/v1/charges'", { query: { "created[gte]": from, "created[lt]": to, limit: "'100'" }, ...opts }),
};

export const SHOP = "'https://acme-store.myshopify.com/admin/api/2025-01'";
export const shopify = {
  adjustStock: (name, { sku, by }, opts) => api("shopify", "shopifyAccessTokenApi", name, "POST", `${SHOP} + '/inventory_levels/adjust.json'`, { body: `{ sku: ${sku}, available_adjustment: ${by} }`, ...opts }),
  setStock: (name, { sku, to }, opts) => api("shopify", "shopifyAccessTokenApi", name, "POST", `${SHOP} + '/inventory_levels/set.json'`, { body: `{ sku: ${sku}, available: ${to} }`, ...opts }),
};

export const elevenlabs = {
  speak: (name, { voice, text }, opts) => api("elevenlabs", "httpHeaderAuth", name, "POST", `'https://api.elevenlabs.io/v1/text-to-speech/' + ${voice}`, { body: `{ text: ${text}, model_id: 'eleven_multilingual_v2' }`, ...opts }),
};

export const serp = {
  search: (name, query, opts) => api("serpapi", "serpApi", name, "GET", "'https://serpapi.com/search.json'", { query: { q: query, num: "'10'" }, ...opts }),
};

export const social = {
  linkedin: (name, text, opts) => app("linkedin", name, "linkedIn", 1, { resource: "post", operation: "create", postAs: "organization", organization: "1234567", text: ex(text), additionalFields: {} }, opts),
  x: (name, text, opts) => app("x", name, "twitter", 2, { resource: "tweet", operation: "create", text: ex(text), additionalFields: {} }, opts),
  facebook: (name, text, opts) => app("facebook", name, "facebookGraphApi", 1, { hostUrl: "graph.facebook.com", httpRequestMethod: "POST", graphApiVersion: "v23.0", node: "acme-page", edge: "feed", options: { queryParameters: { parameter: [{ name: "message", value: ex(text) }] } } }, opts),
};

export const QB = "'https://sandbox-quickbooks.api.intuit.com/v3/company/123'";
export const quickbooks = {
  bill: (name, body, opts) => api("quickbooks", "quickBooksOAuth2Api", name, "POST", `${QB} + '/bill'`, { body, ...opts }),
  bankLines: (name, since, opts) => api("quickbooks", "quickBooksOAuth2Api", name, "GET", `${QB} + '/query'`, { query: { query: `"select * from Purchase where TxnDate >= '" + ${since} + "'"` }, ...opts }),
};

const tab = (documentId, sheet) => ({ documentId: { __rl: true, mode: "id", value: documentId }, sheetName: { __rl: true, mode: "name", value: sheet } });
export const sheets = {
  read: (name, documentId, sheet, opts) => app("googleSheets", name, "googleSheets", 4.5, { resource: "sheet", operation: "read", ...tab(documentId, sheet), options: {} }, { alwaysOutput: true, ...opts }),
  /** Empties a tab, keeping its header row. */
  clear: (name, documentId, sheet, opts) => app("googleSheets", name, "googleSheets", 4.5, { resource: "sheet", operation: "clear", ...tab(documentId, sheet), clear: "wholeSheet", keepFirstRow: true }, opts),
  /** One row per item: updates the row whose `match` column has the same value, appends otherwise. */
  upsert: (name, documentId, sheet, match, columns, opts) =>
    app("googleSheets", name, "googleSheets", 4.5, {
      resource: "sheet", operation: "appendOrUpdate", ...tab(documentId, sheet),
      columns: { mappingMode: "defineBelow", value: Object.fromEntries(Object.entries(columns).map(([k, v]) => [k, ex(v)])), matchingColumns: [match], schema: Object.keys(columns).map((id) => ({ id, displayName: id, required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true })) },
      options: {},
    }, opts),
  /** Appends the incoming items as rows; the sheet's header row names the columns. */
  append: (name, documentId, sheet, opts) => app("googleSheets", name, "googleSheets", 4.5, { resource: "sheet", operation: "append", documentId: { __rl: true, mode: "id", value: documentId }, sheetName: { __rl: true, mode: "name", value: sheet }, columns: { mappingMode: "autoMapInputData", value: {}, matchingColumns: [], schema: [] }, options: {} }, opts),
};

export const openaiApi = {
  image: (name, prompt, opts) => api("openai", "openAiApi", name, "POST", "'https://api.openai.com/v1/images/generations'", { body: `{ model: 'gpt-image-1', prompt: ${prompt}, size: '1536x1024', n: 1 }`, ...opts }),
};

export const posthog = {
  pageviews: (name, path, opts) => api("posthog", "postHogApi", name, "POST", "'https://app.posthog.com/api/projects/@current/query/'", { body: `{ query: { kind: 'HogQLQuery', query: "select count() from events where event = '$pageview' and properties.$pathname = '" + ${path} + "' and timestamp > now() - interval 30 day" } }`, ...opts }),
};

/* ------------------------------------------------------------------ Telegram */

/** The chat a team reviews drafts in. */
export const REVIEW_CHAT = "'-1000000000001'";
export const telegram = {
  send: (name, text, opts) => app("telegram", name, "telegram", 1.2, { resource: "message", operation: "sendMessage", chatId: ex(REVIEW_CHAT), text: ex(text), additionalFields: { appendAttribution: false } }, opts),
  /** The image or file carried on the item as binary data. */
  photo: (name, opts) => app("telegram", name, "telegram", 1.2, { resource: "message", operation: "sendPhoto", chatId: ex(REVIEW_CHAT), binaryData: true, binaryPropertyName: "data", additionalFields: {} }, opts),
  document: (name, opts) => app("telegram", name, "telegram", 1.2, { resource: "message", operation: "sendDocument", chatId: ex(REVIEW_CHAT), binaryData: true, binaryPropertyName: "data", additionalFields: {} }, opts),
  /** Sends Approve and Decline buttons and holds the run until one is pressed, or `hours` pass. */
  approval: (name, message, { hours = 12, ...opts } = {}) => ({
    ...app("telegram", name, "telegram", 1.2, { resource: "message", operation: "sendAndWait", chatId: ex(REVIEW_CHAT), message: ex(message), responseType: "approval", approvalOptions: { values: { approvalType: "double" } }, options: { appendAttribution: false, limitWaitTime: { values: { limitType: "afterTimeInterval", resumeAmount: hours, resumeUnit: "hours" } } } }, { retry: false, ...opts }),
    webhookId: uid(`telegram:${name}`),
  }),
  /** Asks for a written reply and holds the run until it arrives. */
  feedback: (name, message, opts) => ({
    ...app("telegram", name, "telegram", 1.2, { resource: "message", operation: "sendAndWait", chatId: ex(REVIEW_CHAT), message: ex(message), responseType: "freeText", options: { appendAttribution: false } }, { retry: false, ...opts }),
    webhookId: uid(`telegram:${name}`),
  }),
  /** Downloads a file someone sent to the bot. */
  file: (name, fileId, opts) => app("telegram", name, "telegram", 1.2, { resource: "file", operation: "get", fileId: ex(fileId), download: true }, opts),
};

/* -------------------------------------------------------------------- Bubble */

export const bubble = {
  /** Every object of a type. `filled` names fields that must not be empty, checked by Bubble itself. */
  all: (name, type, { filled = [], ...opts } = {}) =>
    app("bubble", name, "bubble", 1, { resource: "object", operation: "getAll", typeName: type, returnAll: true, options: filled.length ? { filters: { filter: filled.map((key) => ({ key, constraint_type: "is_not_empty" })) } } : {} }, opts),
  create: (name, type, properties, opts) => app("bubble", name, "bubble", 1, { resource: "object", operation: "create", typeName: type, properties: { property: Object.entries(properties).map(([key, v]) => ({ key, value: ex(v) })) } }, opts),
  remove: (name, type, id, opts) => app("bubble", name, "bubble", 1, { resource: "object", operation: "delete", typeName: type, objectId: ex(id) }, opts),
};

/* ----------------------------------------------------------------------- RSS */

export const rss = {
  read: (name, url, opts) => app("rss", name, "rssFeedRead", 1.2, { url: ex(url), options: {} }, opts),
};

/* --------------------------------------------------------------------- Apify */

const APIFY = "@apify/n8n-nodes-apify.apify";
const taskInput = (input) => (input ? { useCustomBody: true, customBody: `={{ JSON.stringify(${input}) }}` } : {});
export const apify = {
  /** Runs a saved task, waits for it, and returns its dataset as items. */
  scrape: (name, task, { input, ...opts } = {}) => app("apify", name, APIFY, 2, { resource: "Actor tasks", operation: "Run task and get dataset", actorTaskId: task, ...taskInput(input) }, opts),
  /** Runs a saved task for at most `timeout` seconds and returns the run, not its data. */
  run: (name, task, { input, timeout = 600, ...opts } = {}) => app("apify", name, APIFY, 2, { resource: "Actor tasks", operation: "Run task", actorTaskId: task, waitForFinish: true, timeout, ...taskInput(input) }, opts),
  /** Stops a run. The node has no operation for it, so this is Apify's API with its credential. */
  abort: (name, run, opts) => api("apify", "apifyApi", name, "POST", `'https://api.apify.com/v2/actor-runs/' + ${run} + '/abort'`, opts),
  dataset: (name, id, opts) => app("apify", name, APIFY, 2, { resource: "Datasets", operation: "Get items", datasetId: ex(id), offset: 0, limit: 200, options: {} }, { alwaysOutput: true, ...opts }),
};

/* ----------------------------------------------------------- Wix and Skool */

export const wix = {
  /** A blog post saved as a draft: Wix has no n8n node. `body` is an expression for the request. */
  draft: (name, body, opts) => api("wix", "httpHeaderAuth", name, "POST", "'https://www.wixapis.com/blog/v3/draft-posts'", { body, ...opts }),
};

export const skool = {
  /** An email invitation to a Skool group: Skool has no n8n node. */
  invite: (name, { group, email }, opts) => api("skool", "httpHeaderAuth", name, "POST", `'https://api.skool.com/groups/' + ${group} + '/invites'`, { body: `{ email: ${email} }`, ...opts }),
};

/* ----------------------------------------------------------- platform triggers */

export const triggers = {
  stripe: (name, events) => ({ name, type: B + "stripeTrigger", typeVersion: 1, parameters: { events }, platform: "stripe", webhookId: uid(`stripe:${name}`) }),
  shopify: (name, topic) => ({ name, type: B + "shopifyTrigger", typeVersion: 1, parameters: { authentication: "accessToken", topic }, platform: "shopify", webhookId: uid(`shopify:${name}`) }),
  calendly: (name, events = ["invitee.created"]) => ({ name, type: B + "calendlyTrigger", typeVersion: 1, parameters: { scope: "user", events }, platform: "calendly", webhookId: uid(`calendly:${name}`) }),
  typeform: (name, formId) => ({ name, type: B + "typeformTrigger", typeVersion: 1.1, parameters: { authentication: "accessToken", formId, simplifyAnswers: true, onlyAnswers: false }, platform: "typeform", webhookId: uid(`typeform:${name}`) }),
  gmail: (name) => ({ name, type: B + "gmailTrigger", typeVersion: 1.2, parameters: { pollTimes: { item: [{ mode: "everyMinute" }] }, simple: true, filters: { readStatus: "unread" } }, platform: "gmail" }),
  zendesk: (name) => ({ name, type: B + "zendeskTrigger", typeVersion: 1, parameters: { service: "support", options: {}, conditions: { all: [{ resource: "ticket", field: "status", operation: "is", value: "new" }] } }, platform: "zendesk", webhookId: uid(`zendesk:${name}`) }),
  telegram: (name, updates = ["message"]) => ({ name, type: B + "telegramTrigger", typeVersion: 1.2, parameters: { updates, additionalFields: {} }, platform: "telegram", webhookId: uid(`telegram:${name}`) }),
  rss: (name, feedUrl) => ({ name, type: B + "rssFeedReadTrigger", typeVersion: 1, parameters: { pollTimes: { item: [{ mode: "everyMinute" }] }, feedUrl }, platform: "rss" }),
};

/* --------------------------------------------------------------------- AI */

/**
 * An agent: a model that can use tools until it has an answer. `system` is its
 * standing instructions, `prompt` an expression for what it is asked each time.
 * Its model, tools, memory and output shape are separate nodes attached to it
 * with `model()`, `tool*()`, `memory()` and `shape()`.
 */
export const agent = (name, { system, prompt, structured = false, maxIterations = 6 }, opts) => ({
  name, type: L + "agent", typeVersion: 3.1,
  parameters: { promptType: "define", text: ex(prompt), hasOutputParser: structured, options: { systemMessage: system, maxIterations } },
  ...behave({ retry: false, ...opts }),
});

const part = (to, as) => ({ attach: { to, as } });

export const claude = (name, to, model = "claude-sonnet-4-5") => ({ name, type: L + "lmChatAnthropic", typeVersion: 1.3, parameters: { model: { __rl: true, mode: "id", value: model }, options: { temperature: 0.2 } }, platform: "anthropic", ...part(to, "ai_languageModel") });
export const gpt = (name, to, model = "gpt-4o-mini") => ({ name, type: L + "lmChatOpenAi", typeVersion: 1.2, parameters: { model: { __rl: true, mode: "id", value: model }, options: { temperature: 0 } }, platform: "openai", ...part(to, "ai_languageModel") });

const partOf = (tos, as) => ({ attach: [tos].flat().map((to) => ({ to, as })) });

/** One model node can serve several steps: `to` is a name or a list of names. */
export const geminiModel = (name, to, model = "models/gemini-2.5-flash") => ({ name, type: L + "lmChatGoogleGemini", typeVersion: 1, parameters: { modelName: model, options: { temperature: 0.4 } }, platform: "gemini", ...partOf(to, "ai_languageModel") });
export const groqModel = (name, to, model = "llama-3.3-70b-versatile") => ({ name, type: L + "lmChatGroq", typeVersion: 1, parameters: { model, options: { temperature: 0 } }, platform: "groq", ...partOf(to, "ai_languageModel") });
export const gptModel = (name, to, model = "gpt-4o-mini") => ({ name, type: L + "lmChatOpenAi", typeVersion: 1.2, parameters: { model: { __rl: true, mode: "id", value: model }, options: { temperature: 0.2 } }, platform: "openai", ...partOf(to, "ai_languageModel") });

/** Gemini's own node, for a single message or an image. The text is at `$json.content.parts[0].text`; an image arrives as binary data. */
export const gemini = {
  text: (name, { system, prompt, model = "models/gemini-2.5-flash" }, opts) =>
    ({ name, type: L + "googleGemini", typeVersion: 1.2, platform: "gemini", parameters: { resource: "text", operation: "message", modelId: { __rl: true, mode: "id", value: model }, messages: { values: [{ content: ex(prompt), role: "user" }] }, simplify: true, options: { systemMessage: system } }, ...behave(opts) }),
  image: (name, prompt, { model = "models/gemini-2.5-flash-image", ...opts } = {}) =>
    ({ name, type: L + "googleGemini", typeVersion: 1.2, platform: "gemini", parameters: { resource: "image", operation: "generate", modelId: { __rl: true, mode: "id", value: model }, prompt: ex(prompt), options: {} }, ...behave(opts) }),
};

/**
 * A prompt to a model with no tools: n8n's Basic LLM Chain. Its model and, when
 * `structured`, its output parser are separate nodes attached to it. A
 * structured answer arrives as `$json.output`.
 */
export const chain = (name, { system, prompt, structured = true }, opts) => ({
  name, type: L + "chainLlm", typeVersion: 1.7,
  parameters: { promptType: "define", text: ex(prompt), hasOutputParser: structured, messages: { messageValues: [{ type: "SystemMessagePromptTemplate", message: system }] }, batching: {} },
  ...behave({ retry: false, ...opts }),
});

/** Reads a piece of text into the given shape. The answer arrives as `$json.output`. */
export const extractor = (name, { text, system, example }, opts) => ({
  name, type: L + "informationExtractor", typeVersion: 1.2,
  parameters: { text: ex(text), schemaType: "fromJson", jsonSchemaExample: JSON.stringify(example, null, 2), options: { systemPromptTemplate: system } },
  ...behave({ retry: false, ...opts }),
});

/** A parser that, given an answer in the wrong shape, asks a second model to repair it. It wraps a `shape()`. */
export const autofix = (name, to) => ({ name, type: L + "outputParserAutofixing", typeVersion: 1, parameters: { options: {} }, ...partOf(to, "ai_outputParser") });

/** The knowledge base in Supabase, as a tool an agent can search. Needs `embeddings()` attached. */
export const toolSupabaseKnowledge = (name, to, description, table = "documents") => ({ name, type: L + "vectorStoreSupabase", typeVersion: 1.3, platform: "supabase", parameters: { mode: "retrieve-as-tool", toolName: name, toolDescription: description, tableName: { __rl: true, mode: "id", value: table }, topK: 4, options: { queryName: "match_documents" } }, ...part(to, "ai_tool") });

/** The JSON an agent must answer in, given as an example of it. */
export const shape = (name, to, example) => ({ name, type: L + "outputParserStructured", typeVersion: 1.3, parameters: { schemaType: "fromJson", jsonSchemaExample: JSON.stringify(example, null, 2) }, ...partOf(to, "ai_outputParser") });

/** Short-term memory for one conversation, keyed by an expression. */
export const memory = (name, to, sessionKey, window = 10) => ({ name, type: L + "memoryBufferWindow", typeVersion: 1.3, parameters: { sessionIdType: "customKey", sessionKey: ex(sessionKey), contextWindowLength: window }, ...part(to, "ai_memory") });

/** A tool written as code. The agent passes one string, `query`; return a string. */
export const toolCode = (name, to, description, jsCode) => ({ name, type: L + "toolCode", typeVersion: 1.3, parameters: { description, jsCode }, ...part(to, "ai_tool") });

/** A tool that is another workflow in this library. */
export const toolWorkflow = (name, to, description, workflowId) => ({ name, type: L + "toolWorkflow", typeVersion: 2.2, parameters: { description, workflowId: { __rl: true, mode: "id", value: `__WF:${workflowId}__` }, workflowInputs: { mappingMode: "defineBelow", value: {}, matchingColumns: [], schema: [] } }, ...part(to, "ai_tool") });

/** A value the agent fills in when it uses a tool. */
export const fromAI = (key, description, type = "string") => `={{ $fromAI('${key}', \`${description}\`, '${type}') }}`;

/**
 * A platform's own node, handed to an agent as a tool. The agent decides when
 * to use it and fills in the `fromAI()` values; everything else is fixed here,
 * so an agent can only do with a platform what this node allows.
 */
export const toolNode = (platform, name, to, description, type, typeVersion, parameters) => ({
  name, type: `${B}${type}Tool`, typeVersion, platform,
  parameters: { descriptionType: "manual", toolDescription: description, ...parameters },
  ...part(to, "ai_tool"),
});

/** The knowledge base, as a tool the agent can search. */
export const toolKnowledge = (name, to, description, index = "kb-index") => ({ name, type: L + "vectorStorePinecone", typeVersion: 1.3, platform: "pinecone", parameters: { mode: "retrieve-as-tool", toolDescription: description, pineconeIndex: { __rl: true, mode: "id", value: index }, topK: 4, options: {} }, ...part(to, "ai_tool") });
export const embeddings = (name, to) => ({ name, type: L + "embeddingsOpenAi", typeVersion: 1.2, platform: "openai", parameters: { model: "text-embedding-3-small", options: {} }, ...part(to, "ai_embedding") });

/** A scratchpad: lets the agent reason in steps without acting. */
export const toolThink = (name, to) => ({ name, type: L + "toolThink", typeVersion: 1, parameters: {}, ...part(to, "ai_tool") });

/* ------------------------------------------------- one question to a model */

/**
 * One question to a model, with no tools: classify this, extract that, draft
 * this. Returns the nodes to spread into a workflow: the step itself, its model
 * and, when `example` is given, the JSON shape it must answer in.
 *
 * Classification and extraction go to OpenAI; writing goes to Claude. `task`
 * is the prompt's id, written into the system prompt so a run can be traced to
 * the prompt that produced it.
 */
export const ask = (name, { task, system, prompt, example, writer = !example }, opts) => [
  agent(name, { system: `[task:${task}] ${system}`, prompt, structured: !!example, maxIterations: 2 }, { onFail: "continue", ...opts }),
  writer ? claude(`${name} · Claude`, name) : gpt(`${name} · GPT`, name),
  ...(example ? [shape(`${name} · shape`, name, example)] : []),
];

/**
 * Reads a model's structured answer without trusting it: an answer that did not
 * arrive in the required shape becomes `fallback` plus `parse_error: true`, so
 * one bad reply is a branch to handle and not a crashed run. `from` names the
 * node whose fields are carried forward, matched to answers by position.
 */
export const readAnswer = (name, { from, fallback = {} }) => ({
  name, type: B + "code", typeVersion: 2,
  parameters: {
    jsCode: `const before = $(${JSON.stringify(from)}).all();
const out = [];
for (const [i, item] of $input.all().entries()) {
  const answer = item.json.output;
  const ok = answer && typeof answer === "object" && !Array.isArray(answer);
  out.push({ json: { ...(before[i]?.json ?? {}), ...(ok ? answer : ${JSON.stringify(fallback)}), parse_error: !ok } });
}
return out;`,
  },
});
