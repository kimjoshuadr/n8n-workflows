/**
 * AI sales development team: one canvas, four ways in.
 *
 *   a lead fills in the form   -> researched, scored, started on a sequence
 *   every hour                 -> the next email in each sequence is written,
 *                                 reviewed and sent
 *   a lead replies             -> the reply is read and acted on
 *   every Monday               -> the funnel is counted and summarised
 *
 * Seven agents do the reading and writing. Every decision that costs money or
 * reputation is checked in code after the model has had its say.
 */
import { define, schedule, code, iff, route, call, noop, batches } from "../lib/wf.mjs";
import { db, slack, sendgrid, hubspot, clearbit, serp, gmail, mailchimp, triggers, agent, claude, gpt, shape, toolCode, toolThink, toolKnowledge, embeddings, toolNode, fromAI } from "../lib/nodes.mjs";

const lead = "$('One lead at a time').first().json";
const reply = "$('Find the sequence').first().json";
const read = "$('Read the reply').first().json";

const RESEARCH = { system: "Research agent", final: { summary: "North Clinic runs three clinics and is replacing its website.", pains: ["Bookings handled by phone at each clinic"], hooks: ["Three clinics, one deadline in spring"], thin: false } };
const SEQ = { email: "maria@northclinic.co", name: "Maria", company: "North Clinic", research: RESEARCH.final, score: 84, step: 0, status: "active", next_touch_at: "2020-01-01T00:00:00Z" };

export default [
  define({
    id: "ai-sales-team",
    folder: "systems/ai-sales-team",
    tier: "flagship",
    system: "ai-sales-team",
    category: "AI agents",
    name: "AI sales team · Research, outreach and replies",
    summary: "Seven agents run outbound end to end: research each new lead, score it, write and review every email, read the replies, propose meeting times and answer objections from the case studies. A person is asked whenever an agent is unsure.",
    nodes: [
      /* ---- 1. A new lead ---- */
      triggers.typeform("New lead form", "lead-form"),
      code("Read the form", `return $input.all().map((item) => {
  const f = item.json;
  const email = String(f.email ?? f["Work email"] ?? "").trim().toLowerCase();
  if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)) throw new Error("The form sent no usable email");
  const domain = email.split("@")[1];
  return { json: {
    email, domain,
    name: String(f.name ?? f["Your name"] ?? "").trim() || email.split("@")[0],
    company: String(f.company ?? f["Company"] ?? "").trim() || null,
    message: String(f.message ?? f["What do you need?"] ?? "").slice(0, 3000),
    free_email: /^(gmail|yahoo|hotmail|outlook|icloud|proton)\\./.test(domain),
    scope: "sales-lead", key: email,
  } };
});`),
      call("Seen this lead?", "idempotency-guard"),
      iff("New lead?", "!$json.duplicate"),
      noop("Already in a sequence"),
      clearbit.person("Enrich the person", "$json.email", { onFail: "continue", retry: false }),
      serp.search("Search company news", "($('New lead?').first().json.company ?? $('New lead?').first().json.domain) + ' news'", { onFail: "continue", retry: false }),
      code("Build the dossier", `const l = $("New lead?").first().json;
const person = $("Enrich the person").first().json ?? {};
const found = $input.first().json ?? {};
const news = (found.organic_results ?? []).slice(0, 5).map((r) => ({ title: r.title, snippet: String(r.snippet ?? "").slice(0, 240), link: r.link }));
return [{ json: { ...l, dossier: {
  name: l.name, company: l.company ?? person.employment?.name ?? null, domain: l.domain,
  title: person.employment?.title ?? null, seniority: person.employment?.seniority ?? null,
  employees: person.company?.metrics?.employees ?? null, industry: person.company?.category?.industry ?? null,
  said: l.message, news,
  enriched: !person.error && !!person.employment, searched: !found.error && news.length > 0,
} } }];`),
      agent("Research agent", {
        system: "You are the Research agent on a sales team. From the dossier, write what a salesperson needs before a first email: a two-sentence summary of the company, the likely pains this person has in their role, and one or two specific hooks taken from the news or from what they wrote. Use only what is in the dossier. If the dossier is thin, say so in the summary and return fewer hooks. Never invent a fact, a number or a news item.",
        prompt: "JSON.stringify($json.dossier)",
        structured: true,
      }, { onFail: "continue" }),
      claude("Claude · research", "Research agent"),
      toolThink("Scratchpad", "Research agent"),
      toolCode("Company size band", "Research agent", "Turns an employee count into a size band. Pass the number of employees.", "const n = Number(query); if (!Number.isFinite(n)) return 'unknown'; return n < 11 ? 'micro (1-10)' : n < 51 ? 'small (11-50)' : n < 251 ? 'mid (51-250)' : 'large (250+)';"),
      shape("Research brief", "Research agent", { summary: "Two sentences about the company.", pains: ["A pain this role has"], hooks: ["A specific hook from the dossier"], thin: false }),
      code("Attach the research", `const l = $("Build the dossier").first().json;
const out = $input.first().json.output;
const research = out && typeof out.summary === "string" ? out : null;
return [{ json: { ...l, research, research_failed: !research } }];`),
      agent("Scoring agent", {
        system: "You are the Scoring agent. Score how well this lead fits a services business that sells website and automation projects to companies with a team and a budget. Reply with a score from 0 to 100, whether it is a fit, and one sentence of reasoning that quotes the evidence. Judge only what is in front of you.",
        prompt: "JSON.stringify({ dossier: $json.dossier, research: $json.research })",
        structured: true,
      }, { onFail: "continue" }),
      gpt("GPT · scoring", "Scoring agent"),
      shape("Score", "Scoring agent", { score: 72, fit: true, reason: "One sentence quoting the evidence." }),
      code("Apply the ICP rules", `const l = $("Attach the research").first().json;
const m = $input.first().json.output;
const modelOk = m && typeof m.score === "number" && typeof m.fit === "boolean";
// Rules the model does not get to overrule.
const reasons = [];
if (l.free_email) reasons.push("personal email address");
if (l.dossier.employees !== null && l.dossier.employees < 3) reasons.push("fewer than three employees");
if (String(l.message).trim().length < 15) reasons.push("said almost nothing");
const score = modelOk ? Math.max(0, Math.min(100, Math.round(m.score))) : null;
const path = !modelOk || l.research_failed ? "review" : reasons.length || !m.fit || score < 60 ? "nurture" : "qualified";
return [{ json: { ...l, score, path, reason: modelOk ? m.reason : "An agent could not finish, so a person should look.", rule_hits: reasons } }];`),
      route("Which path?", { qualified: "$json.path === 'qualified'", nurture: "$json.path === 'nurture'" }),
      hubspot.contact("Create HubSpot contact", "$json.email", { firstName: "$json.name", companyName: "$json.dossier.company ?? ''", jobTitle: "$json.dossier.title ?? ''" }, { onFail: "branch" }),
      db.insert("Start the sequence", "lead_sequences", { email: "$('Which path?').first().json.email", name: "$('Which path?').first().json.name", company: "$('Which path?').first().json.dossier.company", research: "$('Which path?').first().json.research", score: "$('Which path?').first().json.score", step: "0", status: "'active'", next_touch_at: "$now.toISO()", created_at: "$now.toISO()" }),
      code("Qualified message", `const l = $("Which path?").first().json;
return [{ json: { channel: "#sales", level: "info", text: "New qualified lead: " + l.name + (l.dossier.company ? " (" + l.dossier.company + ")" : "") + ", score " + l.score + ". " + l.reason + " A sequence has started." } }];`),
      call("Tell sales", "notify"),
      code("Lost contact payload", `const l = $("Which path?").first().json;
return [{ json: { source: "ai-sales-team", reason: "HubSpot contact could not be created", payload: { email: l.email, name: l.name, score: l.score } } }];`),
      call("Park for replay", "dead-letter"),
      mailchimp.subscribe("Add to the newsletter", "$json.email", {}, { onFail: "continue" }),
      db.insert("Record as nurture", "lead_sequences", { email: "$('Which path?').first().json.email", name: "$('Which path?').first().json.name", score: "$('Which path?').first().json.score", status: "'nurture'", reason: "$('Which path?').first().json.rule_hits.concat($('Which path?').first().json.reason).join('; ')", created_at: "$now.toISO()" }),
      code("Needs a look message", `const l = $input.first().json;
return [{ json: { channel: "#sales", level: "warn", text: "A new lead needs a person (" + l.email + "): " + l.reason } }];`),
      call("Ask sales to look", "notify"),

      /* ---- 2. Outreach ---- */
      schedule("Every hour", { hours: 1 }),
      db.find("Due sequences", "lead_sequences", { status: "'active'", next_touch_at: ["lte", "$now.toISO()"] }),
      code("Cap the run", `// Twenty an hour: enough to be useful, slow enough that a mistake is caught before it is sent to everyone.
return $input.all().map((i) => i.json).filter((s) => s.email).slice(0, 20).map((json) => ({ json }));`),
      iff("Touches left?", "Number($json.step ?? 0) < 4"),
      db.update("Close the sequence", "lead_sequences", { email: "$json.email" }, { status: "'finished'", finished_at: "$now.toISO()" }),
      batches("One lead at a time", 1),
      noop("Outreach done"),
      db.find("Earlier messages", "outreach_messages", { email: "$json.email" }),
      code("Brief the writer", `const l = $("One lead at a time").first().json;
const earlier = $input.all().map((i) => i.json).filter((m) => m.subject).map((m) => ({ step: m.step, subject: m.subject }));
const goals = ["Open the conversation with one specific observation and one question.", "Share one relevant proof point and ask if it is worth a call.", "Offer a short, concrete next step.", "A polite last note that leaves the door open."];
const step = Number(l.step ?? 0);
return [{ json: { email: l.email, step, attempt: 1, brief: { name: l.name, company: l.company, research: l.research, goal: goals[step], touch: step + 1, of: goals.length, earlier } } }];`),
      agent("Writer agent", {
        system: "You are the Writer agent. Write one short outreach email for the brief you are given: under 120 words, plain text, one idea, one question or next step, signed 'Kim'. Use the research for something specific to this person. You may search the case studies for one relevant proof point, and you may only cite a result that the search returned. No hype, no 'I hope this finds you well', no invented numbers. Do not repeat an earlier subject line.",
        prompt: "JSON.stringify($json.brief)",
        structured: true,
      }, { onFail: "continue" }),
      claude("Claude · writing", "Writer agent"),
      toolKnowledge("Case studies", "Writer agent", "Search the company's case studies for a relevant proof point. Pass a short description of the lead's industry or problem."),
      embeddings("Embeddings · case studies", "Case studies"),
      shape("Email draft", "Writer agent", { subject: "A short subject line", body: "The email body in plain text." }),
      code("Read the draft", `const b = $("Brief the writer").first().json;
const out = $input.first().json.output;
const ok = out && typeof out.subject === "string" && typeof out.body === "string";
return [{ json: { ...b, subject: ok ? out.subject.trim() : null, body: ok ? out.body.trim() : null, draft_failed: !ok } }];`),
      agent("Reviewer agent", {
        system: "You are the Reviewer agent. You did not write this email and you are not trying to be kind about it. Approve it only if it is specific to this person, makes no claim the brief does not support, has one clear ask, and sounds like a person wrote it. List every problem you find.",
        prompt: "JSON.stringify({ brief: $json.brief, subject: $json.subject, body: $json.body })",
        structured: true,
      }, { onFail: "continue" }),
      gpt("GPT · review", "Reviewer agent"),
      shape("Review", "Reviewer agent", { approve: true, issues: ["A specific problem, if any"] }),
      code("Check it in code too", `const d = $("Read the draft").first().json;
const r = $input.first().json.output;
// The checks a model should not be trusted to make about its colleague.
const hard = [];
const body = String(d.body ?? "");
if (d.draft_failed) hard.push("no draft was produced");
if (body.split(/\\s+/).filter(Boolean).length > 150) hard.push("over 150 words");
if (/\\{\\{|\\}\\}|\\[(name|company|first name)\\]/i.test(d.subject + " " + body)) hard.push("an unfilled placeholder");
if (/guarantee|100%|risk[- ]free|act now/i.test(body)) hard.push("a promise we do not make");
if ((d.brief.earlier ?? []).some((m) => m.subject && m.subject.toLowerCase() === String(d.subject).toLowerCase())) hard.push("repeats an earlier subject line");
const reviewed = r && typeof r.approve === "boolean";
const issues = [...hard, ...(reviewed ? (r.issues ?? []).filter(Boolean) : ["the reviewer could not be reached"])];
return [{ json: { ...d, approved: reviewed && r.approve === true && hard.length === 0, issues } }];`),
      iff("Approved?", "$json.approved"),
      sendgrid.text("Send the email", { to: "$json.email", subject: "$json.subject", text: "$json.body", from: "'kim@example.com'", fromName: "'Kim'" }),
      db.insert("Log the message", "outreach_messages", { email: `${lead}.email`, step: `${lead}.step ?? 0`, subject: "$('Send the email').first().json.subject ?? $('Approved?').first().json.subject ?? $('Recheck in code').first().json.subject", sent_at: "$now.toISO()" }),
      db.update("Advance the sequence", "lead_sequences", { email: `${lead}.email` }, { step: `Number(${lead}.step ?? 0) + 1`, next_touch_at: "$now.plus({ days: 3 }).toISO()", last_touch_at: "$now.toISO()" }),
      hubspot.note("Note on the contact", `'Outreach email ' + (Number(${lead}.step ?? 0) + 1) + ' sent by the sales agents.'`, {}, { onFail: "continue" }),
      iff("First attempt?", "$json.attempt < 2 && !$json.draft_failed"),
      agent("Reviser agent", {
        system: "You are the Reviser agent. Rewrite the email so that every listed issue is fixed, and change nothing else about what it says. Same rules as before: under 120 words, plain text, one ask, nothing the brief does not support.",
        prompt: "JSON.stringify({ brief: $json.brief, subject: $json.subject, body: $json.body, issues: $json.issues })",
        structured: true,
      }, { onFail: "continue" }),
      claude("Claude · revising", "Reviser agent"),
      shape("Revised draft", "Reviser agent", { subject: "A short subject line", body: "The email body in plain text." }),
      code("Recheck in code", `const d = $("First attempt?").first().json;
const out = $input.first().json.output;
const ok = out && typeof out.subject === "string" && typeof out.body === "string";
const body = ok ? out.body.trim() : "";
const hard = [];
if (!ok) hard.push("no revision was produced");
if (body.split(/\\s+/).filter(Boolean).length > 150) hard.push("over 150 words");
if (/\\{\\{|\\}\\}|\\[(name|company|first name)\\]/i.test(body)) hard.push("an unfilled placeholder");
if (/guarantee|100%|risk[- ]free|act now/i.test(body)) hard.push("a promise we do not make");
return [{ json: { ...d, attempt: 2, subject: ok ? out.subject.trim() : d.subject, body: ok ? body : d.body, approved: hard.length === 0, issues: hard.length ? hard : d.issues } }];`),
      iff("Passes now?", "$json.approved"),
      code("Human review message", `const d = $input.first().json;
return [{ json: { channel: "#sales", level: "warn", text: "An outreach email to " + d.email + " was held back: " + d.issues.join("; ") + ". The sequence is paused until someone looks." } }];`),
      call("Send to a person", "notify"),
      db.update("Pause for review", "lead_sequences", { email: `${lead}.email` }, { status: "'needs_review'" }),

      /* ---- 3. Replies ---- */
      triggers.gmail("Reply received"),
      code("Read the reply", `return $input.all().map((item) => {
  const m = item.json;
  const from = String(m.From ?? m.from ?? "").toLowerCase();
  const email = (/[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+/.exec(from) ?? [""])[0];
  // Keep what they wrote; drop the quoted email underneath it.
  const text = String(m.snippet ?? m.text ?? "").split(/\\nOn .+ wrote:|\\n>|\\n-----Original Message-----/)[0].trim().slice(0, 2000);
  return { json: { email, message_id: String(m.id ?? ""), thread_id: String(m.threadId ?? ""), subject: String(m.Subject ?? m.subject ?? ""), text } };
}).filter((i) => i.json.email && i.json.text);`),
      db.find("Find the sequence", "lead_sequences", { email: "$json.email" }),
      iff("One of ours?", "!!$json.email"),
      noop("Not a lead, leave it"),
      agent("Reply classifier", {
        system: "You are the Reply classifier. Read a reply to a sales email and say what the person wants: 'interested' (wants to talk or asks for times), 'objection' (a concern or a question about the offer), 'not_now' (maybe later), 'unsubscribe' (stop writing), or 'out_of_office' (an automatic reply). Give your confidence from 0 to 1. If it could be two of these, pick the more cautious one and lower your confidence.",
        prompt: `${read}.text`,
        structured: true,
      }, { onFail: "continue" }),
      gpt("GPT · classifying", "Reply classifier"),
      shape("Intent", "Reply classifier", { intent: "interested", confidence: 0.9 }),
      code("Read the intent", `const s = $("Find the sequence").first().json;
const r = $("Read the reply").first().json;
const out = $input.first().json.output;
const known = ["interested", "objection", "not_now", "unsubscribe", "out_of_office"];
let intent = out && known.includes(out.intent) && Number(out.confidence) >= 0.7 ? out.intent : "unknown";
// "Stop" is honoured whatever the model made of it.
if (/\\b(unsubscribe|stop emailing|remove me|do not contact)\\b/i.test(r.text)) intent = "unsubscribe";
return [{ json: { ...s, reply: r, intent, confidence: out?.confidence ?? null } }];`),
      route("What do they want?", { interested: "$json.intent === 'interested'", objection: "$json.intent === 'objection'", not_now: "$json.intent === 'not_now'", unsubscribe: "$json.intent === 'unsubscribe'", out_of_office: "$json.intent === 'out_of_office'" }),

      agent("Booking agent", {
        system: "You are the Booking agent. The person is interested. Look up free time in the calendar for the next five working days and reply offering exactly three slots of 30 minutes, in their words' tone, in under 80 words, signed 'Kim'. Offer only times the calendar returned as free.",
        prompt: "'Their reply: ' + $json.reply.text",
        structured: true,
      }, { onFail: "continue" }),
      claude("Claude · booking", "Booking agent"),
      toolNode("googleCalendar", "Free slots", "Booking agent", "Checks whether the calendar is free between two times. Call it once per candidate slot.", "googleCalendar", 1.3, { resource: "calendar", operation: "availability", calendar: { __rl: true, mode: "id", value: "kim@example.com" }, timeMin: fromAI("from", "Start of the slot, ISO 8601"), timeMax: fromAI("to", "End of the slot, ISO 8601"), options: {} }),
      shape("Proposed times", "Booking agent", { reply: "The reply offering three times.", slots: ["2026-11-02T10:00:00Z"] }),
      iff("Got three times?", "Array.isArray($json.output?.slots) && $json.output.slots.length === 3 && typeof $json.output.reply === 'string'"),
      gmail.reply("Reply with times", `${read}.message_id`, "$json.output.reply"),
      db.update("Mark as meeting proposed", "lead_sequences", { email: `${read}.email` }, { status: "'meeting_proposed'", replied_at: "$now.toISO()" }),
      hubspot.deal("Open a deal", "'appointmentscheduled'", { dealName: `'Intro call: ' + ${reply}.name` }, { onFail: "continue" }),
      code("Interested message", `const s = $("Find the sequence").first().json;
return [{ json: { channel: "#sales", level: "info", text: s.name + " replied and is interested. Three times were offered and a deal is open in HubSpot." } }];`),
      call("Tell the owner", "notify"),

      agent("Objection agent", {
        system: "You are the Objection agent. Answer the person's concern or question honestly, using only what the product and case study search returns. If the search does not cover it, say you will find out and set your confidence low. Under 100 words, signed 'Kim'. Never argue, never discount, never promise a result.",
        prompt: "'Their reply: ' + $json.reply.text",
        structured: true,
      }, { onFail: "continue" }),
      claude("Claude · objections", "Objection agent"),
      toolKnowledge("Product answers", "Objection agent", "Search the product documentation and case studies to answer a prospect's question or concern."),
      embeddings("Embeddings · answers", "Product answers"),
      shape("Answer", "Objection agent", { reply: "The answer.", confidence: 0.8 }),
      iff("Confident answer?", "Number($json.output?.confidence) >= 0.75 && typeof $json.output?.reply === 'string'"),
      gmail.reply("Answer the objection", `${read}.message_id`, "$json.output.reply"),
      db.update("Keep the sequence going", "lead_sequences", { email: `${read}.email` }, { last_reply_at: "$now.toISO()", next_touch_at: "$now.plus({ days: 4 }).toISO()" }),

      code("Hand over message", `const s = $("Read the intent").first().json;
return [{ json: { channel: "#sales", level: "warn", text: s.name + " (" + s.email + ") replied and an agent was not sure how to answer: \\"" + s.reply.text.slice(0, 240) + "\\". The sequence is paused." } }];`),
      call("Hand to a person", "notify"),
      db.update("Pause: needs a person", "lead_sequences", { email: `${read}.email` }, { status: "'needs_review'", replied_at: "$now.toISO()" }),

      db.update("Snooze for 30 days", "lead_sequences", { email: "$json.email" }, { next_touch_at: "$now.plus({ days: 30 }).toISO()", replied_at: "$now.toISO()" }),
      db.update("Stop the sequence", "lead_sequences", { email: "$json.email" }, { status: "'unsubscribed'", replied_at: "$now.toISO()" }),
      hubspot.contact("Mark opted out in HubSpot", `${read}.email`, {}, { onFail: "continue" }),
      db.update("Push the next touch a week", "lead_sequences", { email: "$json.email" }, { next_touch_at: "$now.plus({ days: 7 }).toISO()" }),

      /* ---- 4. Weekly report ---- */
      schedule("Monday 08:00", "0 8 * * 1"),
      db.find("This week's messages", "outreach_messages", { sent_at: ["gte", "$now.minus({ days: 7 }).toISO()"] }),
      db.find("All sequences", "lead_sequences", null, { once: true }),
      code("Count the funnel", `const sent = $("This week's messages").all().filter((i) => i.json.sent_at).length;
const seqs = $input.all().map((i) => i.json).filter((s) => s.email);
const by = (status) => seqs.filter((s) => s.status === status).length;
const weekAgo = Date.now() - 7 * 864e5;
const replied = seqs.filter((s) => s.replied_at && new Date(s.replied_at).getTime() >= weekAgo).length;
return [{ json: { sent, replied, reply_rate: sent ? Math.round((replied / sent) * 100) : 0, active: by("active"), meetings: by("meeting_proposed"), needs_review: by("needs_review"), unsubscribed: by("unsubscribed"), nurture: by("nurture") } }];`),
      agent("Analyst agent", {
        system: "You are the Analyst agent. Write three sentences for a sales lead about last week's outbound numbers: what moved, what needs attention, and one thing to try. Use only the numbers given. Do not invent a cause.",
        prompt: "JSON.stringify($json)",
      }, { onFail: "continue" }),
      claude("Claude · analysis", "Analyst agent"),
      slack.post("Post the weekly report", "'#sales'", "'*Outbound last week*\\n' + ($json.output ?? 'The written summary is unavailable this week.') + '\\nSent ' + $('Count the funnel').first().json.sent + ' · replies ' + $('Count the funnel').first().json.replied + ' (' + $('Count the funnel').first().json.reply_rate + '%) · meetings proposed ' + $('Count the funnel').first().json.meetings + ' · waiting on a person ' + $('Count the funnel').first().json.needs_review"),
    ],
    flow: [
      ["New lead form", "Read the form", "Seen this lead?", "New lead?", "Enrich the person", "Search company news", "Build the dossier", "Research agent", "Attach the research", "Scoring agent", "Apply the ICP rules", "Which path?"],
      ["New lead?:1", "Already in a sequence"],
      ["Which path?:0", "Create HubSpot contact", "Start the sequence", "Qualified message", "Tell sales"],
      ["Create HubSpot contact:1", "Lost contact payload", "Park for replay"],
      ["Which path?:1", "Add to the newsletter", "Record as nurture"],
      ["Which path?:2", "Needs a look message", "Ask sales to look"],

      ["Every hour", "Due sequences", "Cap the run", "Touches left?", "One lead at a time"],
      ["Touches left?:1", "Close the sequence"],
      ["One lead at a time:0", "Outreach done"],
      ["One lead at a time:1", "Earlier messages", "Brief the writer", "Writer agent", "Read the draft", "Reviewer agent", "Check it in code too", "Approved?", "Send the email", "Log the message", "Advance the sequence", "Note on the contact", "One lead at a time"],
      ["Approved?:1", "First attempt?", "Reviser agent", "Recheck in code", "Passes now?", "Send the email"],
      ["First attempt?:1", "Human review message"],
      ["Passes now?:1", "Human review message", "Send to a person", "Pause for review", "One lead at a time"],

      ["Reply received", "Read the reply", "Find the sequence", "One of ours?", "Reply classifier", "Read the intent", "What do they want?"],
      ["One of ours?:1", "Not a lead, leave it"],
      ["What do they want?:0", "Booking agent", "Got three times?", "Reply with times", "Mark as meeting proposed", "Open a deal", "Interested message", "Tell the owner"],
      ["Got three times?:1", "Hand over message"],
      ["What do they want?:1", "Objection agent", "Confident answer?", "Answer the objection", "Keep the sequence going"],
      ["Confident answer?:1", "Hand over message", "Hand to a person", "Pause: needs a person"],
      ["What do they want?:2", "Snooze for 30 days"],
      ["What do they want?:3", "Stop the sequence", "Mark opted out in HubSpot"],
      ["What do they want?:4", "Push the next touch a week"],
      ["What do they want?:5", "Hand over message"],

      ["Monday 08:00", "This week's messages", "All sequences", "Count the funnel", "Analyst agent", "Post the weekly report"],
    ],
    sections: [
      { title: "A new lead: research, score, start", note: "Typeform in. Clearbit and SerpAPI gather facts, two agents read them, and code applies the rules a model may not overrule.", nodes: ["New lead form", "Read the form", "Seen this lead?", "New lead?", "Already in a sequence", "Enrich the person", "Search company news", "Build the dossier", "Research agent", "Attach the research", "Scoring agent", "Apply the ICP rules", "Which path?", "Create HubSpot contact", "Start the sequence", "Qualified message", "Tell sales", "Lost contact payload", "Park for replay", "Add to the newsletter", "Record as nurture", "Needs a look message", "Ask sales to look"] },
      { title: "Outreach: write, review, send", note: "Hourly. One agent writes, a second one reviews, code checks both. A rejected email gets one rewrite, then a person.", nodes: ["Every hour", "Due sequences", "Cap the run", "Touches left?", "Close the sequence", "One lead at a time", "Outreach done", "Earlier messages", "Brief the writer", "Writer agent", "Read the draft", "Reviewer agent", "Check it in code too", "Approved?", "Send the email", "Log the message", "Advance the sequence", "Note on the contact", "First attempt?", "Reviser agent", "Recheck in code", "Passes now?", "Human review message", "Send to a person", "Pause for review"] },
      { title: "Replies: read, decide, act", note: "Gmail in. A classifier reads the reply, then a booking agent or an objection agent answers, or a person is asked.", nodes: ["Reply received", "Read the reply", "Find the sequence", "One of ours?", "Not a lead, leave it", "Reply classifier", "Read the intent", "What do they want?", "Booking agent", "Got three times?", "Reply with times", "Mark as meeting proposed", "Open a deal", "Interested message", "Tell the owner", "Objection agent", "Confident answer?", "Answer the objection", "Keep the sequence going", "Hand over message", "Hand to a person", "Pause: needs a person", "Snooze for 30 days", "Stop the sequence", "Mark opted out in HubSpot", "Push the next touch a week"] },
      { title: "Weekly report", note: "The funnel is counted in code. An agent writes three sentences about it.", nodes: ["Monday 08:00", "This week's messages", "All sequences", "Count the funnel", "Analyst agent", "Post the weekly report"] },
    ],
    story: [
      { title: "A lead fills in the form", copy: "Typeform sends it in. A lead already in a sequence is not started twice.", nodes: ["New lead form", "Read the form", "Seen this lead?", "New lead?", "Already in a sequence"] },
      { title: "Facts are gathered first", copy: "Clearbit looks up the person and SerpAPI finds recent company news. Either can fail without stopping the run; the dossier records what it could not find.", nodes: ["Enrich the person", "Search company news", "Build the dossier"] },
      { title: "A research agent reads the dossier", copy: "Claude writes the brief a salesperson would want: the company, the likely pains, and a specific hook. It is told to say when the dossier is thin instead of filling the gap.", nodes: ["Research agent", "Claude · research", "Scratchpad", "Company size band", "Research brief", "Attach the research"] },
      { title: "A scoring agent, then the rules", copy: "A second model scores the fit. Then code applies the rules it may not overrule: a personal address or a two-person company is not qualified, whatever the score.", nodes: ["Scoring agent", "GPT · scoring", "Score", "Apply the ICP rules", "Which path?"] },
      { title: "Three ways forward", copy: "Qualified leads go to HubSpot and start a sequence. The rest join the Mailchimp newsletter. Anything an agent could not finish goes to a person in Slack.", nodes: ["Create HubSpot contact", "Start the sequence", "Qualified message", "Tell sales", "Lost contact payload", "Park for replay", "Add to the newsletter", "Record as nurture", "Needs a look message", "Ask sales to look"] },
      { title: "Every hour, the next email is due", copy: "At most twenty an hour, one lead at a time. A sequence that has had its four touches is closed.", nodes: ["Every hour", "Due sequences", "Cap the run", "Touches left?", "Close the sequence", "One lead at a time", "Outreach done"] },
      { title: "A writer agent drafts it", copy: "Claude writes from the research and the earlier subject lines, and may search the case studies in Pinecone for one proof point it is allowed to cite.", nodes: ["Earlier messages", "Brief the writer", "Writer agent", "Claude · writing", "Case studies", "Embeddings · case studies", "Email draft", "Read the draft"] },
      { title: "A different model reviews it", copy: "The reviewer did not write the email and is told not to be kind. Then code checks what neither model should be trusted on: length, unfilled placeholders, promises.", nodes: ["Reviewer agent", "GPT · review", "Review", "Check it in code too", "Approved?"] },
      { title: "Approved emails are sent and recorded", copy: "SendGrid sends it. The message is logged, the sequence moves on three days, and HubSpot gets a note.", nodes: ["Send the email", "Log the message", "Advance the sequence", "Note on the contact"] },
      { title: "One rewrite, then a person", copy: "A rejected draft gets one revision with the reviewer's notes. If it still fails the checks, the sequence pauses and Slack is asked.", nodes: ["First attempt?", "Reviser agent", "Claude · revising", "Revised draft", "Recheck in code", "Passes now?", "Human review message", "Send to a person", "Pause for review"] },
      { title: "A lead replies", copy: "Gmail brings the reply in. Mail from anyone who is not in a sequence is left alone.", nodes: ["Reply received", "Read the reply", "Find the sequence", "One of ours?", "Not a lead, leave it"] },
      { title: "A classifier reads what they want", copy: "Interested, an objection, not now, stop, or an out-of-office. Low confidence means a person reads it, and the word 'unsubscribe' is honoured whatever the model thought.", nodes: ["Reply classifier", "GPT · classifying", "Intent", "Read the intent", "What do they want?"] },
      { title: "Interested: a booking agent offers times", copy: "It reads the calendar, offers three free slots, and replies in the thread. A deal opens in HubSpot and the owner is told.", nodes: ["Booking agent", "Claude · booking", "Free slots", "Proposed times", "Got three times?", "Reply with times", "Mark as meeting proposed", "Open a deal", "Interested message", "Tell the owner"] },
      { title: "An objection: answered from the documents", copy: "The objection agent may only use what the Pinecone search returns. A confident answer is sent; an unsure one goes to a person with the lead's own words.", nodes: ["Objection agent", "Claude · objections", "Product answers", "Embeddings · answers", "Answer", "Confident answer?", "Answer the objection", "Keep the sequence going", "Hand over message", "Hand to a person", "Pause: needs a person"] },
      { title: "Not now, stop, or away", copy: "Snoozed for a month, stopped for good and marked in HubSpot, or pushed back a week. No model writes anything for these.", nodes: ["Snooze for 30 days", "Stop the sequence", "Mark opted out in HubSpot", "Push the next touch a week"] },
      { title: "Monday: the funnel, counted", copy: "Sent, replies, meetings and what is waiting on a person are counted in code. An agent writes three sentences about them for Slack.", nodes: ["Monday 08:00", "This week's messages", "All sequences", "Count the funnel", "Analyst agent", "Claude · analysis", "Post the weekly report"] },
    ],
    tests: [
      {
        name: "a good lead is researched, scored, added to HubSpot and started on a sequence",
        entry: "New lead form",
        input: [{ email: "Maria@NorthClinic.co", name: "Maria", company: "North Clinic", message: "We run three clinics and need a new site and booking automation before spring." }],
        llm: [RESEARCH, { system: "Scoring agent", final: { score: 84, fit: true, reason: "Three clinics, a stated need and a deadline." } }],
        ran: ["Tell sales"], notRan: ["Record as nurture", "Ask sales to look"],
        calls: [{ to: "hubspot", path: "/contacts/v1/contact/createOrUpdate/email/maria@northclinic.co" }, { to: "anthropic" }, { to: "openai" }],
        table: { lead_sequences: [{ email: "maria@northclinic.co", status: "active", score: 84 }] },
      },
      {
        name: "a personal email address is never qualified, whatever the model scored",
        entry: "New lead form",
        input: [{ email: "someone@gmail.com", name: "Sam", message: "I would like a website for my new business please." }],
        llm: [RESEARCH, { system: "Scoring agent", final: { score: 95, fit: true, reason: "Sounds keen." } }],
        ran: ["Record as nurture"], noCalls: ["hubspot"],
        table: { lead_sequences: [{ email: "someone@gmail.com", status: "nurture" }] },
      },
      {
        name: "when the research model is down, a person is asked and nothing is guessed",
        entry: "New lead form",
        fail: [{ path: "/v1/messages", times: 20, status: 529 }],
        input: [{ email: "ana@firm.co", name: "Ana", company: "Firm", message: "We need help automating our order handling." }],
        llm: [{ system: "Scoring agent", final: { score: 80, fit: true, reason: "ok" } }],
        ran: ["Ask sales to look"], noCalls: ["hubspot"],
      },
      {
        name: "the same lead submitting twice starts one sequence",
        entry: "New lead form", repeat: 2,
        input: [{ email: "maria@northclinic.co", name: "Maria", company: "North Clinic", message: "We run three clinics and need a new site before spring." }],
        llm: [RESEARCH, { system: "Scoring agent", final: { score: 84, fit: true, reason: "A need and a deadline." } }],
        callCount: { "hubspot /contacts/v1/contact/createOrUpdate/email/maria@northclinic.co": 1 }, ran: ["Already in a sequence"],
      },
      {
        name: "an email is written with a proof point, reviewed by a second model, sent and recorded",
        entry: "Every hour",
        seed: { lead_sequences: [SEQ], kb: [{ id: "cs-4", title: "Dental group case study", text: "A dental group cut booking phone calls by automating reminders." }] },
        llm: [
          { system: "Writer agent", last: "touch", tool: { name: "Case_studies", input: { input: "clinics online booking" } } },
          { system: "Writer agent", final: { subject: "Booking across three clinics", body: "Hi Maria, you mentioned three clinics and a spring deadline. A dental group we worked with automated its booking reminders. Is it worth a short call? Kim" } },
          { system: "Reviewer agent", final: { approve: true, issues: [] } },
        ],
        ran: ["Send the email", "Outreach done"], notRan: ["Reviser agent"],
        calls: [{ to: "pinecone", path: "/query" }, { to: "sendgrid", path: "/v3/mail/send", body: { personalizations: [{ to: [{ email: "maria@northclinic.co" }], subject: "Booking across three clinics" }] } }],
        table: { lead_sequences: [{ email: "maria@northclinic.co", step: 1 }], outreach_messages: [{ email: "maria@northclinic.co", subject: "Booking across three clinics" }] },
      },
      {
        name: "a rejected draft is rewritten once with the reviewer's notes, then sent",
        entry: "Every hour",
        seed: { lead_sequences: [SEQ] },
        llm: [
          { system: "Writer agent", final: { subject: "Quick idea", body: "Hi, we do websites and automation for all kinds of companies. Want to chat? Kim" } },
          { system: "Reviewer agent", final: { approve: false, issues: ["Not specific to this person"] } },
          { system: "Reviser agent", last: "Not specific", final: { subject: "Three clinics, one booking flow", body: "Hi Maria, with three clinics, is booking handled separately at each? Kim" } },
        ],
        ran: ["Reviser agent", "Send the email"], notRan: ["Send to a person"],
        calls: [{ to: "sendgrid", body: { personalizations: [{ subject: "Three clinics, one booking flow" }] } }], callCount: { sendgrid: 1 },
      },
      {
        name: "a promise the business does not make is caught in code even when both models approve",
        entry: "Every hour",
        seed: { lead_sequences: [SEQ] },
        llm: [
          { system: "Writer agent", final: { subject: "More bookings", body: "Hi Maria, we guarantee 100% more bookings. Call? Kim" } },
          { system: "Reviewer agent", final: { approve: true, issues: [] } },
          { system: "Reviser agent", final: { subject: "More bookings", body: "Hi Maria, we still guarantee more bookings. Call? Kim" } },
        ],
        ran: ["Send to a person"], noCalls: ["sendgrid"],
        table: { lead_sequences: [{ email: "maria@northclinic.co", status: "needs_review", step: 0 }] },
      },
      {
        name: "a sequence that has had its four emails is closed without a model call",
        entry: "Every hour",
        seed: { lead_sequences: [{ ...SEQ, step: 4 }] },
        ran: ["Close the sequence"], noCalls: ["anthropic", "openai", "sendgrid"],
        table: { lead_sequences: [{ email: "maria@northclinic.co", status: "finished" }] },
      },
      {
        name: "an interested reply gets three calendar times and opens a deal",
        entry: "Reply received",
        seed: { lead_sequences: [{ ...SEQ, step: 1 }] },
        input: [{ id: "m1", threadId: "t1", From: "Maria <maria@northclinic.co>", Subject: "Re: Booking across three clinics", snippet: "Yes, this is timely. What times do you have next week?" }],
        llm: [
          { system: "Reply classifier", final: { intent: "interested", confidence: 0.95 } },
          { system: "Booking agent", last: "Their reply", tool: { name: "Free_slots", input: { from: "2026-11-02T00:00:00Z", to: "2026-11-07T00:00:00Z" } } },
          { system: "Booking agent", final: { reply: "Great. I can do Monday 10:00, Tuesday 14:00 or Thursday 09:30. Kim", slots: ["2026-11-02T10:00:00Z", "2026-11-03T14:00:00Z", "2026-11-05T09:30:00Z"] } },
        ],
        ran: ["Reply with times", "Tell the owner"],
        calls: [{ to: "googleCalendar", path: "/calendar/v3/freeBusy" }, { to: "gmail", path: "/gmail/v1/users/me/messages/send" }, { to: "hubspot", path: "/deals/v1/deal" }],
        table: { lead_sequences: [{ email: "maria@northclinic.co", status: "meeting_proposed" }] },
      },
      {
        name: "'unsubscribe' stops the sequence even when the classifier read it as interest",
        entry: "Reply received",
        seed: { lead_sequences: [{ ...SEQ, step: 1 }] },
        input: [{ id: "m2", From: "maria@northclinic.co", Subject: "Re:", snippet: "Interesting, but please unsubscribe me from these." }],
        llm: [{ system: "Reply classifier", final: { intent: "interested", confidence: 0.9 } }],
        ran: ["Stop the sequence"], notRan: ["Booking agent"], noCalls: ["gmail", "anthropic"],
        table: { lead_sequences: [{ email: "maria@northclinic.co", status: "unsubscribed" }] },
      },
      {
        name: "an objection the documents do not cover goes to a person, unanswered",
        entry: "Reply received",
        seed: { lead_sequences: [{ ...SEQ, step: 1 }] },
        input: [{ id: "m3", From: "maria@northclinic.co", Subject: "Re:", snippet: "Do you have HIPAA certification for patient data?" }],
        llm: [
          { system: "Reply classifier", final: { intent: "objection", confidence: 0.9 } },
          { system: "Objection agent", final: { reply: "I will find out and come back to you. Kim", confidence: 0.3 } },
        ],
        ran: ["Hand to a person", "Pause: needs a person"], noCalls: ["gmail"],
        table: { lead_sequences: [{ email: "maria@northclinic.co", status: "needs_review" }] },
      },
      {
        name: "mail from someone who is not a lead is left alone",
        entry: "Reply received",
        input: [{ id: "m4", From: "stranger@elsewhere.com", Subject: "Hello", snippet: "Is this the right address for invoices?" }],
        ran: ["Not a lead, leave it"], noCalls: ["openai", "anthropic", "gmail"],
      },
      {
        name: "the weekly report counts the funnel in code",
        entry: "Monday 08:00",
        seed: { outreach_messages: [{ email: "a@b.co", sent_at: "2999-01-01T00:00:00Z", subject: "x" }, { email: "c@d.co", sent_at: "2999-01-01T00:00:00Z", subject: "y" }], lead_sequences: [{ email: "a@b.co", status: "meeting_proposed", replied_at: "2999-01-01T00:00:00Z" }, { email: "c@d.co", status: "active" }, { email: "e@f.co", status: "needs_review" }] },
        llm: [{ system: "Analyst agent", text: "Replies held up. One sequence is waiting on a person. Try a shorter second email." }],
        output: { node: "Count the funnel", json: { sent: 2, replied: 1, reply_rate: 50, meetings: 1, needs_review: 1, active: 1 } },
        calls: [{ to: "slack", path: "/api/chat.postMessage", body: { channel: "#sales" } }],
      },
    ],
  }),
];
