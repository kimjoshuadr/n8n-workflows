/**
 * AI back office: one canvas, five ways in.
 *
 *   an invoice arrives by email   -> read, checked by arithmetic, coded and filed,
 *                                    or sent to a person with what was wrong
 *   every morning                 -> bank lines are matched to bills
 *   every morning                 -> the ledger is scanned for anything unusual
 *   someone asks in Slack         -> an agent answers from the books, with its working
 *   the first of the month        -> the month is closed into a pack
 *
 * Models read and explain. Sums, matches and limits are done in code, and the
 * agents are never given a tool that can move money.
 */
import { webhook, schedule, code, iff, respond, noop, call, define } from "../lib/wf.mjs";
import { db, slack, gmail, quickbooks, sheets, triggers, agent, claude, gpt, shape, memory, toolCode, fromAI, toolNode, toolKnowledge, embeddings, toolThink, ask } from "../lib/nodes.mjs";

const inv = "$('Check the arithmetic').first().json";

const VENDOR = { name: "Acme Supplies", typical_amount: 150, bank_account: "GB00BANK0000", default_account: "Office supplies" };
const CHART = [{ id: "acc-1", title: "Office supplies", text: "Paper, toner, stationery and small office items." }, { id: "acc-2", title: "Software", text: "Subscriptions and licences." }];
const FIELDS = { vendor: "Acme Supplies", invoice_number: "INV-1042", invoice_date: "2026-10-01", due_date: "2026-10-31", currency: "USD", lines: [{ description: "Paper", amount: 60.5 }, { description: "Toner", amount: 40 }], subtotal: 100.5, tax: 20.1, total: 120.6, bank_account: "GB00BANK0000", confidence: 0.95 };
const EMAIL = (id) => ({ id, From: "Billing <billing@acme-supplies.com>", Subject: "Invoice INV-1042", text: "Invoice INV-1042 from Acme Supplies. Paper 60.50, Toner 40.00. Subtotal 100.50, tax 20.10, total 120.60 USD. Due 2026-10-31. Pay to GB00BANK0000." });
const MONTH = (offset) => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 15)).toISOString(); };

export default [
  define({
    id: "ai-back-office",
    folder: "systems/ai-back-office",
    tier: "flagship",
    system: "ai-back-office",
    category: "AI agents",
    name: "AI back office · Invoices, bank lines and questions",
    summary: "Agents read supplier invoices from Gmail, code them against the chart of accounts and file them in QuickBooks. Bank lines are matched every morning, the ledger is scanned for anomalies, finance can ask questions in Slack, and the month closes into a Google Sheets pack. Every figure is checked or computed in code.",
    nodes: [
      /* ---- 1. Invoice intake ---- */
      triggers.gmail("Invoice email arrives"),
      code("Read the email", `return $input.all().map((item) => {
  const m = item.json;
  const text = String(m.text ?? m.snippet ?? "").slice(0, 12000);
  return { json: { message_id: String(m.id ?? ""), from: String(m.From ?? m.from ?? "").toLowerCase(), subject: String(m.Subject ?? m.subject ?? ""), text, has_text: text.trim().length > 40, scope: "invoice-email", key: String(m.id ?? "") } };
});`),
      iff("Something to read?", "$json.has_text && !!$json.message_id"),
      noop("Nothing to read"),
      call("Seen this email?", "idempotency-guard"),
      iff("New email?", "!$json.duplicate"),
      noop("Already processed"),
      agent("Extraction agent", {
        system: "You are the Extraction agent. Copy the fields of this supplier invoice exactly as written: vendor name, invoice number, invoice date and due date as YYYY-MM-DD, currency, each line with its amount, subtotal, tax, total, and the bank account or IBAN to pay if one is printed. Use null for anything not on the document. Never work a number out: copy it.",
        prompt: "$json.text",
        structured: true,
      }, { onFail: "continue" }),
      gpt("GPT · extraction", "Extraction agent", "gpt-4o"),
      shape("Invoice fields", "Extraction agent", { vendor: "Acme Supplies", invoice_number: "INV-1042", invoice_date: "2026-10-01", due_date: "2026-10-31", currency: "USD", lines: [{ description: "Paper", amount: 100.5 }], subtotal: 100.5, tax: 20.1, total: 120.6, bank_account: "GB00BANK0000", confidence: 0.95 }),
      code("Check the arithmetic", `const e = $("New email?").first().json;
const f = $input.first().json.output;
const problems = [];
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
if (!f || typeof f !== "object") problems.push("the invoice could not be read");
const lines = (f?.lines ?? []).filter((l) => l && num(l.amount) !== null);
const subtotal = num(f?.subtotal), tax = num(f?.tax) ?? 0, total = num(f?.total);
const cents = (n) => Math.round(n * 100);
if (f) {
  if (!f.vendor || !f.invoice_number) problems.push("vendor or invoice number missing");
  if (total === null || total <= 0) problems.push("total is missing or not positive");
  // The document's own numbers must agree with each other.
  if (lines.length && subtotal !== null && cents(lines.reduce((s, l) => s + l.amount, 0)) !== cents(subtotal)) problems.push("the lines do not add up to the subtotal");
  if (subtotal !== null && total !== null && cents(subtotal + tax) !== cents(total)) problems.push("subtotal plus tax is not the total");
  if (f.due_date && Number.isNaN(Date.parse(f.due_date))) problems.push("the due date is not a date");
  if (f.invoice_date && f.due_date && Date.parse(f.due_date) < Date.parse(f.invoice_date)) problems.push("due before it was issued");
  if ((num(f.confidence) ?? 0) < 0.8) problems.push("low reading confidence");
}
return [{ json: { ...e, vendor: f?.vendor ?? null, invoice_number: f?.invoice_number ?? null, invoice_date: f?.invoice_date ?? null, due_date: f?.due_date ?? null, currency: f?.currency ?? "USD", lines, subtotal, tax, total, bank_account: f?.bank_account ?? null, problems } }];`),
      db.find("Same invoice before?", "supplier_invoices", { vendor: "($json.vendor ?? '')", invoice_number: "($json.invoice_number ?? '')" }),
      db.find("What we know of the vendor", "vendors", { name: `(${inv}.vendor ?? '')` }, { once: true }),
      code("Compare with history", `const i = $("Check the arithmetic").first().json;
const dup = $("Same invoice before?").all().some((r) => r.json.invoice_number);
const v = $input.first().json;
const problems = [...i.problems];
if (dup) problems.push("this vendor has already sent this invoice number");
if (!v.name) problems.push("a vendor we have not paid before");
else {
  if (v.typical_amount && i.total > v.typical_amount * 3) problems.push("more than three times this vendor's usual amount");
  // The classic fraud: a real vendor, a new bank account.
  if (v.bank_account && i.bank_account && v.bank_account !== i.bank_account) problems.push("the bank account differs from the one on file");
}
return [{ json: { ...i, vendor_known: !!v.name, default_account: v.default_account ?? null, problems } }];`),
      agent("Coding agent", {
        system: "You are the Coding agent. Choose the expense account for this invoice from the chart of accounts. Search the chart first and answer with an account name exactly as it appears there. If the vendor has a default account and the lines fit it, use it. Give your confidence.",
        prompt: "JSON.stringify({ vendor: $json.vendor, lines: $json.lines, default_account: $json.default_account })",
        structured: true,
      }, { onFail: "continue" }),
      claude("Claude · coding", "Coding agent"),
      toolKnowledge("Chart of accounts", "Coding agent", "Search the chart of accounts and the notes on what belongs in each account.", "finance-index"),
      embeddings("Embeddings · chart", "Chart of accounts"),
      shape("Account", "Coding agent", { account: "Office supplies", confidence: 0.9 }),
      code("Hold it to the chart", `const i = $("Compare with history").first().json;
const o = $input.first().json.output;
const CHART = ["Office supplies", "Software", "Rent", "Utilities", "Professional fees", "Travel", "Marketing", "Cost of goods sold", "Equipment"];
const problems = [...i.problems];
const account = o && CHART.includes(o.account) ? o.account : null;
if (!account) problems.push("no valid account could be chosen");
else if ((Number(o.confidence) || 0) < 0.75) problems.push("unsure which account (" + account + "?)");
return [{ json: { ...i, account, problems, clean: problems.length === 0 } }];`),
      iff("Clean?", "$json.clean"),
      quickbooks.bill("Create the bill in QuickBooks", "{ VendorRef: { name: $json.vendor }, DocNumber: $json.invoice_number, TxnDate: $json.invoice_date, DueDate: $json.due_date, CurrencyRef: { value: $json.currency }, Line: [{ Amount: $json.total, DetailType: 'AccountBasedExpenseLineDetail', AccountBasedExpenseLineDetail: { AccountRef: { name: $json.account } } }] }", { onFail: "branch" }),
      db.insert("File the invoice", "supplier_invoices", { vendor: `$('Clean?').first().json.vendor`, invoice_number: `$('Clean?').first().json.invoice_number`, total: `$('Clean?').first().json.total`, currency: `$('Clean?').first().json.currency`, due_date: `$('Clean?').first().json.due_date`, account: `$('Clean?').first().json.account`, bill_id: "String($json.Bill?.Id ?? $json.id ?? '')", status: "'awaiting_payment'", at: "$now.toISO()" }),
      gmail.label("Label as filed", `$('Clean?').first().json.message_id`, "Label_filed", { onFail: "continue" }),
      code("Explain what is wrong", `const i = $("Hold it to the chart").first().json;
const why = i.clean ? ["QuickBooks would not accept the bill"] : i.problems;
return [{ json: { message_id: i.message_id, vendor: i.vendor, invoice_number: i.invoice_number, total: i.total, why } }];`),
      db.insert("Queue for review", "invoice_review", { message_id: "$json.message_id", vendor: "$json.vendor", invoice_number: "$json.invoice_number", total: "$json.total", problems: "$json.why", status: "'open'", at: "$now.toISO()" }),
      code("Review message", `const r = $("Explain what is wrong").first().json;
const urgent = r.why.some((w) => /bank account/.test(w));
return [{ json: { channel: "#finance", level: urgent ? "critical" : "warn", text: "An invoice" + (r.vendor ? " from " + r.vendor : "") + (r.total ? " for " + r.total : "") + " needs a person: " + r.why.join("; ") + "." } }];`),
      call("Tell finance", "notify"),

      /* ---- 2. Bank matching ---- */
      schedule("06:30 daily", "30 6 * * *"),
      quickbooks.bankLines("Yesterday's bank lines", "$now.minus({ days: 3 }).toISODate()"),
      db.find("Bills awaiting payment", "supplier_invoices", { status: "'awaiting_payment'" }, { once: true }),
      code("Match the exact ones", `const lines = ($("Yesterday's bank lines").first().json.QueryResponse?.Purchase ?? []).map((p) => ({ id: String(p.Id), amount: Number(p.TotalAmt), memo: String(p.PrivateNote ?? p.DocNumber ?? ""), date: p.TxnDate }));
const bills = $input.all().map((i) => i.json).filter((b) => b.invoice_number);
const cents = (n) => Math.round(Number(n) * 100);
const used = new Set();
const matched = [], unmatched = [];
for (const l of lines) {
  // Exact: the same amount and the invoice number in the memo.
  const hit = bills.find((b) => !used.has(b.invoice_number) && cents(b.total) === cents(l.amount) && l.memo.toLowerCase().includes(String(b.invoice_number).toLowerCase()));
  if (hit) { used.add(hit.invoice_number); matched.push({ line: l.id, invoice_number: hit.invoice_number, vendor: hit.vendor, how: "exact" }); }
  else unmatched.push(l);
}
return [{ json: { matched, unmatched, open: bills.filter((b) => !used.has(b.invoice_number)).map((b) => ({ invoice_number: b.invoice_number, vendor: b.vendor, total: b.total })) } }];`),
      iff("Anything left over?", "$json.unmatched.length > 0 && $json.open.length > 0"),
      agent("Matching agent", {
        system: "You are the Matching agent. Some bank lines did not match a bill exactly. For each bank line, say which open bill it most likely pays, if any, and why: a vendor name in the memo, a reference that is nearly the invoice number. Propose a match only when the amounts are equal. Give a confidence for each.",
        prompt: "JSON.stringify({ bank_lines: $json.unmatched, open_bills: $json.open })",
        structured: true,
      }, { onFail: "continue" }),
      claude("Claude · matching", "Matching agent"),
      shape("Proposed matches", "Matching agent", { matches: [{ line: "101", invoice_number: "INV-1042", why: "Vendor name in the memo", confidence: 0.9 }] }),
      code("Accept only what holds up", `const m = $("Match the exact ones").first().json;
const proposed = $("Matching agent").isExecuted ? ($input.first().json.output?.matches ?? []) : [];
const cents = (n) => Math.round(Number(n) * 100);
const matched = [...m.matched];
const taken = new Set(matched.map((x) => x.invoice_number));
for (const p of proposed) {
  const line = m.unmatched.find((l) => l.id === String(p?.line));
  const bill = m.open.find((b) => b.invoice_number === p?.invoice_number);
  // The agent proposes; equal amounts and high confidence decide.
  if (line && bill && !taken.has(bill.invoice_number) && cents(line.amount) === cents(bill.total) && Number(p.confidence) >= 0.8) { taken.add(bill.invoice_number); matched.push({ line: line.id, invoice_number: bill.invoice_number, vendor: bill.vendor, how: "agent: " + String(p.why).slice(0, 120) }); }
}
const lines = new Set(matched.map((x) => x.line));
return [{ json: { matched, exceptions: m.unmatched.filter((l) => !lines.has(l.id)) } }];`),
      code("One row per match", `return $input.first().json.matched.map((json) => ({ json }));`),
      db.update("Mark the bill paid", "supplier_invoices", { invoice_number: "($json.invoice_number)" }, { status: "'paid'", bank_line: "$json.line", matched_how: "$json.how", paid_at: "$now.toISO()" }),
      slack.post("Post the reconciliation", "'#finance'", "':bank: Matched ' + $('Accept only what holds up').first().json.matched.length + ' bank lines to bills. ' + ($('Accept only what holds up').first().json.exceptions.length ? $('Accept only what holds up').first().json.exceptions.length + ' could not be matched: ' + $('Accept only what holds up').first().json.exceptions.map(e => e.amount + ' \"' + e.memo + '\"').join('; ') : 'Nothing left unmatched.')", { once: true, alwaysOutput: true }),

      /* ---- 3. Anomaly watch ---- */
      schedule("07:00 daily", "0 7 * * *"),
      db.find("The last 90 days", "supplier_invoices", { at: ["gte", "$now.minus({ days: 90 }).toISO()"] }),
      code("Look for the unusual", `const rows = $input.all().map((i) => i.json).filter((r) => r.vendor && Number.isFinite(Number(r.total)));
const day = Date.now() - 864e5;
const recent = rows.filter((r) => new Date(r.at).getTime() >= day);
const flags = [];
for (const r of recent) {
  const past = rows.filter((p) => p.vendor === r.vendor && p !== r).map((p) => Number(p.total));
  if (past.length >= 3) {
    const mean = past.reduce((a, b) => a + b, 0) / past.length;
    const sd = Math.sqrt(past.reduce((a, b) => a + (b - mean) ** 2, 0) / past.length) || mean * 0.1;
    if (Math.abs(Number(r.total) - mean) > 3 * sd) flags.push({ kind: "unusual amount", vendor: r.vendor, invoice_number: r.invoice_number, total: Number(r.total), usual: Math.round(mean) });
  }
  const twin = rows.find((p) => p !== r && p.vendor === r.vendor && Number(p.total) === Number(r.total) && Math.abs(new Date(p.at) - new Date(r.at)) < 7 * 864e5);
  if (twin) flags.push({ kind: "same amount twice in a week", vendor: r.vendor, invoice_number: r.invoice_number, total: Number(r.total), other: twin.invoice_number });
  if (Number(r.total) >= 1000 && Number(r.total) % 500 === 0 && past.length < 2) flags.push({ kind: "round amount from a new vendor", vendor: r.vendor, invoice_number: r.invoice_number, total: Number(r.total) });
}
return [{ json: { checked: recent.length, flags } }];`),
      iff("Anything unusual?", "$json.flags.length > 0"),
      agent("Anomaly agent", {
        system: "You are the Anomaly agent. These invoices were flagged by fixed rules. For a finance manager, put them in order of how much they deserve a look and say in one line each what to check. Do not add flags of your own and do not say anything is fraud.",
        prompt: "JSON.stringify($json.flags)",
      }, { onFail: "continue" }),
      claude("Claude · anomalies", "Anomaly agent"),
      db.insert("Record the flags", "anomalies", { flags: "$('Look for the unusual').first().json.flags", note: "$json.output ?? null", at: "$now.toISO()" }),
      slack.post("Raise the anomalies", "'#finance'", "':warning: ' + $('Look for the unusual').first().json.flags.length + ' invoice(s) look unusual.\\n' + ($('Anomaly agent').first().json.output ?? $('Look for the unusual').first().json.flags.map(f => f.vendor + ' ' + f.invoice_number + ': ' + f.kind).join('\\n'))"),
      noop("Nothing unusual"),

      /* ---- 4. Questions in Slack ---- */
      webhook("Finance question", "finance-question"),
      code("Read the question", `const b = $input.first().json.body ?? {};
const ALLOWED = ["U-FINANCE-1", "U-FINANCE-2", "U-OWNER"]; // the Slack users who may ask about the books
const user = String(b.user_id ?? "");
const text = String(b.text ?? "").trim().slice(0, 600);
return [{ json: { user, text, allowed: ALLOWED.includes(user) && text.length > 3 } }];`),
      iff("Allowed to ask?", "$json.allowed"),
      respond("Not allowed", "{ response_type: 'ephemeral', text: 'Sorry, only the finance team can ask about the books.' }", { status: 200 }),
      agent("Analyst agent", {
        system: "You are the Analyst agent for a finance team. Answer questions about supplier invoices from the ledger. Always query the ledger before answering, and add numbers up with the calculator, never in your head. Reply with the answer in one or two sentences, the figures you used, and which rows they came from. If the ledger cannot answer the question, say so. You can read; you cannot pay, change or delete anything.",
        prompt: "$json.text",
        structured: true,
        maxIterations: 8,
      }, { onFail: "continue" }),
      claude("Claude · analysis", "Analyst agent"),
      memory("Conversation memory", "Analyst agent", "'finance-' + $json.user", 8),
      toolNode("supabase", "Ledger query", "Analyst agent", "Reads supplier invoices from the ledger. Columns: vendor, invoice_number, total, currency, due_date, account, status (awaiting_payment or paid), at.", "supabase", 1, { resource: "row", operation: "getAll", tableId: "supplier_invoices", returnAll: false, limit: 200, filterType: "string", filterString: fromAI("filter", "A PostgREST filter, for example status=eq.awaiting_payment or vendor=eq.Acme Supplies. Leave empty for all rows.") }),
      toolCode("Calculator", "Analyst agent", "Adds a list of numbers. Pass them separated by commas.", "const n = String(query).split(',').map((x) => Number(x.trim())).filter(Number.isFinite); return String(Math.round(n.reduce((a, b) => a + b, 0) * 100) / 100);"),
      toolThink("Plan the answer", "Analyst agent"),
      shape("Answer", "Analyst agent", { answer: "The answer in one or two sentences.", figures: ["Acme Supplies: 1280.50"], rows_used: 3 }),
      code("Only answer with working", `const q = $("Allowed to ask?").first().json;
const o = $input.first().json.output;
// An answer about the books with no rows behind it is not an answer.
const ok = o && typeof o.answer === "string" && Number(o.rows_used) > 0 && Array.isArray(o.figures) && o.figures.length > 0;
const text = ok ? o.answer + "\\n_From " + o.rows_used + " ledger rows: " + o.figures.slice(0, 6).join("; ") + "_" : "I could not answer that from the ledger. Try naming a vendor, a status or a date range.";
return [{ json: { user: q.user, question: q.text, answered: !!ok, text } }];`),
      db.insert("Log the question", "finance_questions", { user: "$json.user", question: "$json.question", answered: "$json.answered", at: "$now.toISO()" }, { onFail: "continue" }),
      respond("Answer in Slack", "{ response_type: 'in_channel', text: $('Only answer with working').first().json.text }"),

      /* ---- 5. Month end ---- */
      schedule("1st of the month", "0 8 1 * *"),
      db.find("Two months of invoices", "supplier_invoices", { at: ["gte", "$now.minus({ months: 2 }).startOf('month').toISO()"] }),
      code("Total by account", `const rows = $input.all().map((i) => i.json).filter((r) => r.account && r.at);
const last = DateTime.now().minus({ months: 1 });
const prior = DateTime.now().minus({ months: 2 });
const inMonth = (r, m) => DateTime.fromISO(r.at).hasSame(m, "month");
const sum = (list) => Math.round(list.reduce((s, r) => s + Number(r.total || 0), 0) * 100) / 100;
const accounts = [...new Set(rows.map((r) => r.account))].sort();
const lines = accounts.map((account) => {
  const amount = sum(rows.filter((r) => r.account === account && inMonth(r, last)));
  const before = sum(rows.filter((r) => r.account === account && inMonth(r, prior)));
  return { month: last.toFormat("yyyy-LL"), account, amount, prior: before, change: before ? Math.round(((amount - before) / before) * 100) : null };
}).filter((l) => l.amount || l.prior);
const unpaid = rows.filter((r) => r.status === "awaiting_payment");
return [{ json: { month: last.toFormat("yyyy-LL"), lines, total: sum(lines.map((l) => ({ total: l.amount }))), prior_total: sum(lines.map((l) => ({ total: l.prior }))), unpaid_count: unpaid.length, unpaid_total: sum(unpaid) } }];`),
      agent("Close agent", {
        system: "You are the Close agent. Write the month-end note for the owner: three sentences on what was spent and what changed against the month before, then up to three things worth a question. Use only the figures given, and quote them exactly.",
        prompt: "JSON.stringify($json)",
        structured: true,
      }, { onFail: "continue" }),
      claude("Claude · close", "Close agent"),
      shape("Close note", "Close agent", { summary: "Three sentences.", questions: ["Something worth asking about"] }),
      code("One row per account", `return $("Total by account").first().json.lines.map((json) => ({ json }));`),
      sheets.append("Add to the month-end pack", "month-end-pack", "Pack"),
      slack.post("Post the close", "'#finance'", "':ledger: *' + $('Total by account').first().json.month + ' closed.* Spend ' + $('Total by account').first().json.total + ' (prior month ' + $('Total by account').first().json.prior_total + '). ' + $('Total by account').first().json.unpaid_count + ' bills unpaid, ' + $('Total by account').first().json.unpaid_total + '.\\n' + ($('Close agent').first().json.output?.summary ?? 'The written note is unavailable; the figures are in the pack.')", { once: true }),
    ],
    flow: [
      ["Invoice email arrives", "Read the email", "Something to read?", "Seen this email?", "New email?", "Extraction agent", "Check the arithmetic", "Same invoice before?", "What we know of the vendor", "Compare with history", "Coding agent", "Hold it to the chart", "Clean?", "Create the bill in QuickBooks", "File the invoice", "Label as filed"],
      ["Something to read?:1", "Nothing to read"],
      ["New email?:1", "Already processed"],
      ["Clean?:1", "Explain what is wrong", "Queue for review", "Review message", "Tell finance"],
      ["Create the bill in QuickBooks:1", "Explain what is wrong"],

      ["06:30 daily", "Yesterday's bank lines", "Bills awaiting payment", "Match the exact ones", "Anything left over?", "Matching agent", "Accept only what holds up", "One row per match", "Mark the bill paid", "Post the reconciliation"],
      ["Anything left over?:1", "Accept only what holds up"],

      ["07:00 daily", "The last 90 days", "Look for the unusual", "Anything unusual?", "Anomaly agent", "Record the flags", "Raise the anomalies"],
      ["Anything unusual?:1", "Nothing unusual"],

      ["Finance question", "Read the question", "Allowed to ask?", "Analyst agent", "Only answer with working", "Log the question", "Answer in Slack"],
      ["Allowed to ask?:1", "Not allowed"],

      ["1st of the month", "Two months of invoices", "Total by account", "Close agent", "One row per account", "Add to the month-end pack", "Post the close"],
    ],
    sections: [
      { title: "Invoice intake: read, check, code, file", note: "A model copies the fields. Code checks the document's own arithmetic and the vendor's history before anything reaches QuickBooks.", nodes: ["Invoice email arrives", "Read the email", "Something to read?", "Nothing to read", "Seen this email?", "New email?", "Already processed", "Extraction agent", "Check the arithmetic", "Same invoice before?", "What we know of the vendor", "Compare with history", "Coding agent", "Hold it to the chart", "Clean?", "Create the bill in QuickBooks", "File the invoice", "Label as filed", "Explain what is wrong", "Queue for review", "Review message", "Tell finance"] },
      { title: "Bank matching", note: "Exact matches in code first. An agent proposes the rest; equal amounts and confidence decide.", nodes: ["06:30 daily", "Yesterday's bank lines", "Bills awaiting payment", "Match the exact ones", "Anything left over?", "Matching agent", "Accept only what holds up", "One row per match", "Mark the bill paid", "Post the reconciliation"] },
      { title: "Anomaly watch", note: "Fixed rules raise the flags. The agent only orders and explains them.", nodes: ["07:00 daily", "The last 90 days", "Look for the unusual", "Anything unusual?", "Anomaly agent", "Record the flags", "Raise the anomalies", "Nothing unusual"] },
      { title: "Questions in Slack", note: "Read-only tools, a calculator, and no answer without the rows behind it.", nodes: ["Finance question", "Read the question", "Allowed to ask?", "Not allowed", "Analyst agent", "Only answer with working", "Log the question", "Answer in Slack"] },
      { title: "Month end", nodes: ["1st of the month", "Two months of invoices", "Total by account", "Close agent", "One row per account", "Add to the month-end pack", "Post the close"] },
    ],
    story: [
      { title: "An invoice arrives by email", copy: "Gmail brings it in. An email with nothing to read, or one already processed, stops here.", nodes: ["Invoice email arrives", "Read the email", "Something to read?", "Nothing to read", "Seen this email?", "New email?", "Already processed"] },
      { title: "A model copies the fields", copy: "Vendor, number, dates, lines, totals and the bank account to pay. It is told to copy, never to work a number out.", nodes: ["Extraction agent", "GPT · extraction", "Invoice fields"] },
      { title: "Code checks the document against itself", copy: "Do the lines add up to the subtotal? Is subtotal plus tax the total? Is it due after it was issued? A model's reading that fails its own arithmetic goes no further.", nodes: ["Check the arithmetic"] },
      { title: "And against what is already known", copy: "The same invoice number twice, a new vendor, three times the usual amount, or a bank account that differs from the one on file. That last one is how invoice fraud works, and it is marked critical.", nodes: ["Same invoice before?", "What we know of the vendor", "Compare with history"] },
      { title: "A coding agent picks the account", copy: "It searches the chart of accounts in Pinecone. Code accepts its answer only if the account exists in the chart.", nodes: ["Coding agent", "Claude · coding", "Chart of accounts", "Embeddings · chart", "Account", "Hold it to the chart", "Clean?"] },
      { title: "Clean invoices become bills", copy: "The bill is created in QuickBooks, filed in Supabase and the email is labelled.", nodes: ["Create the bill in QuickBooks", "File the invoice", "Label as filed"] },
      { title: "Anything else goes to a person, with the reason", copy: "Finance gets every problem found, in one message, so the check takes seconds.", nodes: ["Explain what is wrong", "Queue for review", "Review message", "Tell finance"] },
      { title: "Each morning, bank lines meet bills", copy: "The same amount with the invoice number in the memo is matched in code.", nodes: ["06:30 daily", "Yesterday's bank lines", "Bills awaiting payment", "Match the exact ones", "Anything left over?"] },
      { title: "An agent proposes the awkward ones", copy: "A vendor name in the memo, a reference that is nearly right. The proposal is accepted only if the amounts are equal and the agent is confident.", nodes: ["Matching agent", "Claude · matching", "Proposed matches", "Accept only what holds up", "One row per match", "Mark the bill paid", "Post the reconciliation"] },
      { title: "The ledger is scanned for the unusual", copy: "Three rules in code: far from a vendor's usual amount, the same amount twice in a week, a round sum from a new vendor. The agent orders and explains the flags; it cannot add one.", nodes: ["07:00 daily", "The last 90 days", "Look for the unusual", "Anything unusual?", "Anomaly agent", "Claude · anomalies", "Record the flags", "Raise the anomalies", "Nothing unusual"] },
      { title: "Finance asks a question in Slack", copy: "Only named people may ask. The analyst agent can read the ledger and use a calculator. It has no tool that pays, changes or deletes.", nodes: ["Finance question", "Read the question", "Allowed to ask?", "Not allowed", "Analyst agent", "Claude · analysis", "Conversation memory", "Ledger query", "Calculator", "Plan the answer", "Answer"] },
      { title: "No working, no answer", copy: "A reply with no ledger rows behind it is replaced by 'I could not answer that'. Every question is logged.", nodes: ["Only answer with working", "Log the question", "Answer in Slack"] },
      { title: "The first of the month", copy: "Spend by account against the month before is totalled in code, added to the Google Sheets pack, and an agent writes the note that goes with it.", nodes: ["1st of the month", "Two months of invoices", "Total by account", "Close agent", "Claude · close", "Close note", "One row per account", "Add to the month-end pack", "Post the close"] },
    ],
    tests: [
      {
        name: "a clean invoice is read, checked, coded and filed as a QuickBooks bill",
        entry: "Invoice email arrives",
        seed: { vendors: [VENDOR], kb: CHART },
        input: [EMAIL("g1")],
        llm: [{ system: "Extraction agent", final: FIELDS }, { system: "Coding agent", last: "vendor", tool: { name: "Chart of accounts", input: { input: "paper and toner" } } }, { system: "Coding agent", final: { account: "Office supplies", confidence: 0.92 } }],
        ran: ["File the invoice", "Label as filed"], notRan: ["Queue for review"],
        calls: [{ to: "quickbooks", path: "/v3/company/123/bill", body: { DocNumber: "INV-1042", Line: [{ Amount: 120.6 }] } }, { to: "pinecone", path: "/query" }],
        table: { supplier_invoices: [{ invoice_number: "INV-1042", status: "awaiting_payment", account: "Office supplies" }] },
      },
      {
        name: "an invoice whose own numbers do not add up never reaches QuickBooks",
        entry: "Invoice email arrives",
        seed: { vendors: [VENDOR], kb: CHART }, input: [EMAIL("g2")],
        llm: [{ system: "Extraction agent", final: { ...FIELDS, total: 220.6 } }, { system: "Coding agent", final: { account: "Office supplies", confidence: 0.92 } }],
        ran: ["Tell finance"], noCalls: ["quickbooks"],
        output: { node: "Check the arithmetic", json: { problems: ["subtotal plus tax is not the total"] } },
        table: { invoice_review: [{ invoice_number: "INV-1042", status: "open" }] },
      },
      {
        name: "a known vendor with a new bank account is stopped and marked critical",
        entry: "Invoice email arrives",
        seed: { vendors: [VENDOR], kb: CHART }, input: [EMAIL("g3")],
        llm: [{ system: "Extraction agent", final: { ...FIELDS, bank_account: "GB99OTHER9999" } }, { system: "Coding agent", final: { account: "Office supplies", confidence: 0.92 } }],
        noCalls: ["quickbooks"], calls: [{ to: "slack", body: { text: ":red_circle: An invoice from Acme Supplies for 120.6 needs a person: the bank account differs from the one on file." } }],
      },
      {
        name: "an invoice number this vendor already sent is not filed twice",
        entry: "Invoice email arrives",
        seed: { vendors: [VENDOR], kb: CHART, supplier_invoices: [{ vendor: "Acme Supplies", invoice_number: "INV-1042", total: 120.6, status: "paid" }] }, input: [EMAIL("g4")],
        llm: [{ system: "Extraction agent", final: FIELDS }, { system: "Coding agent", final: { account: "Office supplies", confidence: 0.92 } }],
        ran: ["Queue for review"], noCalls: ["quickbooks"],
      },
      {
        name: "an account that is not in the chart is refused",
        entry: "Invoice email arrives",
        seed: { vendors: [VENDOR], kb: CHART }, input: [EMAIL("g5")],
        llm: [{ system: "Extraction agent", final: FIELDS }, { system: "Coding agent", final: { account: "Miscellaneous", confidence: 0.99 } }],
        ran: ["Queue for review"], noCalls: ["quickbooks"],
      },
      {
        name: "the same email delivered twice is processed once",
        entry: "Invoice email arrives", repeat: 2,
        seed: { vendors: [VENDOR], kb: CHART }, input: [EMAIL("g6")],
        llm: [{ system: "Extraction agent", final: FIELDS }, { system: "Coding agent", final: { account: "Office supplies", confidence: 0.92 } }],
        callCount: { "quickbooks /v3/company/123/bill": 1 }, ran: ["Already processed"],
      },
      {
        name: "bank lines are matched exactly in code, and an agent's proposal needs equal amounts",
        entry: "06:30 daily",
        seed: { supplier_invoices: [{ vendor: "Acme Supplies", invoice_number: "INV-1", total: 120.6, status: "awaiting_payment" }, { vendor: "Northwind", invoice_number: "INV-2", total: 300, status: "awaiting_payment" }, { vendor: "Globex", invoice_number: "INV-3", total: 99, status: "awaiting_payment" }] },
        routes: [{ path: "sandbox-quickbooks.api.intuit.com/v3/company/123/query", response: { QueryResponse: { Purchase: [{ Id: "1", TotalAmt: 120.6, PrivateNote: "Payment INV-1", TxnDate: "2026-10-12" }, { Id: "2", TotalAmt: 300, PrivateNote: "NORTHWIND LTD", TxnDate: "2026-10-12" }, { Id: "3", TotalAmt: 50, PrivateNote: "GLOBEX", TxnDate: "2026-10-12" }] } } }],
        llm: [{ system: "Matching agent", final: { matches: [{ line: "2", invoice_number: "INV-2", why: "Vendor name in the memo", confidence: 0.9 }, { line: "3", invoice_number: "INV-3", why: "Vendor name in the memo", confidence: 0.95 }] } }],
        output: [{ node: "Matching agent", json: { output: { matches: [{ line: "2" }] } } }, { node: "Accept only what holds up", json: { exceptions: [{ id: "3" }] } }],
        table: { supplier_invoices: [{ invoice_number: "INV-1", status: "paid", matched_how: "exact" }, { invoice_number: "INV-2", status: "paid" }, { invoice_number: "INV-3", status: "awaiting_payment" }] },
        calls: [{ to: "slack", body: { channel: "#finance" } }],
      },
      {
        name: "an invoice ten times a vendor's usual amount is flagged by rule and explained",
        entry: "07:00 daily",
        seed: { supplier_invoices: [...[98, 102, 100, 101].map((total, i) => ({ vendor: "Acme Supplies", invoice_number: "OLD-" + i, total, at: new Date(Date.now() - (20 + i) * 864e5).toISOString() })), { vendor: "Acme Supplies", invoice_number: "INV-BIG", total: 1000, at: new Date().toISOString() }] },
        llm: [{ system: "Anomaly agent", text: "1. Acme Supplies INV-BIG: ten times the usual amount. Check it against the order." }],
        ran: ["Raise the anomalies"], output: { node: "Look for the unusual", json: { flags: [{ kind: "unusual amount", invoice_number: "INV-BIG", usual: 100 }] } },
        table: { anomalies: [{ note: "1. Acme Supplies INV-BIG: ten times the usual amount. Check it against the order." }] },
      },
      { name: "an ordinary day raises nothing and calls no model", entry: "07:00 daily", seed: { supplier_invoices: [{ vendor: "Acme Supplies", invoice_number: "A", total: 100, at: new Date().toISOString() }] }, ran: ["Nothing unusual"], noCalls: ["anthropic", "slack"] },
      {
        name: "a finance question is answered from the ledger, with its working",
        seed: { supplier_invoices: [{ vendor: "Acme Supplies", invoice_number: "INV-1", total: 120.6, status: "awaiting_payment" }, { vendor: "Northwind", invoice_number: "INV-2", total: 300, status: "awaiting_payment" }] },
        request: { body: { user_id: "U-FINANCE-1", text: "How much do we owe suppliers right now?" } },
        llm: [{ system: "Analyst agent", last: "How much do we owe", tool: { name: "Ledger query", input: { filter: "status=eq.awaiting_payment" } } }, { system: "Analyst agent", last: "INV-2", tool: { name: "Calculator", input: { input: "120.6, 300" } } }, { system: "Analyst agent", final: { answer: "You owe suppliers 420.60 across two unpaid bills.", figures: ["Acme Supplies: 120.60", "Northwind: 300.00"], rows_used: 2 } }],
        response: { status: 200, body: { response_type: "in_channel" } },
        calls: [{ to: "supabase", method: "GET", path: "/rest/v1/supplier_invoices", query: { status: "eq.awaiting_payment" } }],
        output: { node: "Only answer with working", json: { answered: true } }, table: { finance_questions: [{ user: "U-FINANCE-1", answered: true }] },
      },
      { name: "someone outside finance is refused before any model is called", request: { body: { user_id: "U-RANDOM", text: "What did we pay Acme?" } }, response: { body: { response_type: "ephemeral" } }, noCalls: ["anthropic", "supabase"] },
      {
        name: "an answer with no ledger rows behind it is not given",
        request: { body: { user_id: "U-OWNER", text: "What will we spend next year?" } },
        llm: [{ system: "Analyst agent", final: { answer: "About 50,000.", figures: [], rows_used: 0 } }],
        output: { node: "Only answer with working", json: { answered: false } },
      },
      {
        name: "month end totals each account against the month before and fills the pack",
        entry: "1st of the month",
        seed: { supplier_invoices: [{ vendor: "A", invoice_number: "1", total: 400, account: "Software", status: "paid", at: MONTH(-1) }, { vendor: "A", invoice_number: "2", total: 20.5, account: "Software", status: "awaiting_payment", at: MONTH(-1) }, { vendor: "A", invoice_number: "3", total: 300, account: "Software", status: "paid", at: MONTH(-2) }, { vendor: "B", invoice_number: "4", total: 1000, account: "Rent", status: "paid", at: MONTH(-1) }] },
        llm: [{ system: "Close agent", final: { summary: "Spend rose on software.", questions: ["Why did software rise 40%?"] } }],
        output: { node: "Total by account", json: { total: 1420.5, prior_total: 300, unpaid_count: 1, lines: [{ account: "Rent", amount: 1000, prior: 0 }, { account: "Software", amount: 420.5, prior: 300, change: 40 }] } },
        calls: [{ to: "googleSheets", method: "PUT" }, { to: "slack", body: { channel: "#finance" } }], callCount: { slack: 1 },
      },
    ],
  }),
];
