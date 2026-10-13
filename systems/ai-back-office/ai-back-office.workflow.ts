import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : AI back office · Invoices, bank lines and questions
// Nodes   : 78  |  Connections: 52
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// SectionInvoiceIntakeReadCheckCodeFile stickyNote
// SectionBankMatching                stickyNote
// SectionAnomalyWatch                stickyNote
// SectionQuestionsInSlack            stickyNote
// SectionMonthEnd                    stickyNote
// InvoiceEmailArrives                gmailTrigger               [creds]
// ReadTheEmail                       code
// SomethingToRead                    if
// NothingToRead                      noOp
// SeenThisEmail                      executeWorkflow
// NewEmail                           if
// AlreadyProcessed                   noOp
// ExtractionAgent                    agent                      [AI] [onError→regular]
// GptExtraction                      lmChatOpenAi               [creds] [ai_languageModel]
// InvoiceFields                      outputParserStructured     [ai_outputParser]
// CheckTheArithmetic                 code
// SameInvoiceBefore                  supabase                   [creds] [alwaysOutput] [retry]
// WhatWeKnowOfTheVendor              supabase                   [creds] [alwaysOutput] [executeOnce] [retry]
// CompareWithHistory                 code
// CodingAgent                        agent                      [AI] [onError→regular]
// ClaudeCoding                       lmChatAnthropic            [creds] [ai_languageModel]
// ChartOfAccounts                    vectorStorePinecone        [AI] [creds] [ai_tool]
// EmbeddingsChart                    embeddingsOpenAi           [creds] [ai_embedding]
// Account                            outputParserStructured     [ai_outputParser]
// HoldItToTheChart                   code
// Clean                              if
// CreateTheBillInQuickbooks          httpRequest                [onError→out(1)] [creds] [retry]
// FileTheInvoice                     supabase                   [creds] [retry]
// LabelAsFiled                       gmail                      [onError→regular] [creds] [retry]
// ExplainWhatIsWrong                 code
// QueueForReview                     supabase                   [creds] [retry]
// ReviewMessage                      code
// TellFinance                        executeWorkflow
// _0630Daily                         scheduleTrigger
// YesterdaySBankLines                httpRequest                [creds] [retry]
// BillsAwaitingPayment               supabase                   [creds] [alwaysOutput] [executeOnce] [retry]
// MatchTheExactOnes                  code
// AnythingLeftOver                   if
// MatchingAgent                      agent                      [AI] [onError→regular]
// ClaudeMatching                     lmChatAnthropic            [creds] [ai_languageModel]
// ProposedMatches                    outputParserStructured     [ai_outputParser]
// AcceptOnlyWhatHoldsUp              code
// OneRowPerMatch                     code
// MarkTheBillPaid                    supabase                   [creds] [alwaysOutput] [retry]
// PostTheReconciliation              slack                      [creds] [alwaysOutput] [executeOnce] [retry]
// _0700Daily                         scheduleTrigger
// TheLast90Days                      supabase                   [creds] [alwaysOutput] [retry]
// LookForTheUnusual                  code
// AnythingUnusual                    if
// AnomalyAgent                       agent                      [AI] [onError→regular]
// ClaudeAnomalies                    lmChatAnthropic            [creds] [ai_languageModel]
// RecordTheFlags                     supabase                   [creds] [retry]
// RaiseTheAnomalies                  slack                      [creds] [retry]
// NothingUnusual                     noOp
// FinanceQuestion                    webhook
// ReadTheQuestion                    code
// AllowedToAsk                       if
// NotAllowed                         respondToWebhook
// AnalystAgent                       agent                      [AI] [onError→regular]
// ClaudeAnalysis                     lmChatAnthropic            [creds] [ai_languageModel]
// ConversationMemory                 memoryBufferWindow         [ai_memory]
// LedgerQuery                        supabaseTool               [creds] [ai_tool]
// Calculator                         toolCode                   [ai_tool]
// PlanTheAnswer                      toolThink                  [ai_tool]
// Answer                             outputParserStructured     [ai_outputParser]
// OnlyAnswerWithWorking              code
// LogTheQuestion                     supabase                   [onError→regular] [creds] [retry]
// AnswerInSlack                      respondToWebhook
// _1stOfTheMonth                     scheduleTrigger
// TwoMonthsOfInvoices                supabase                   [creds] [alwaysOutput] [retry]
// TotalByAccount                     code
// CloseAgent                         agent                      [AI] [onError→regular]
// ClaudeClose                        lmChatAnthropic            [creds] [ai_languageModel]
// CloseNote                          outputParserStructured     [ai_outputParser]
// OneRowPerAccount                   code
// AddToTheMonthEndPack               googleSheets               [creds] [retry]
// PostTheClose                       slack                      [creds] [executeOnce] [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// InvoiceEmailArrives
//    → ReadTheEmail
//      → SomethingToRead
//        → SeenThisEmail
//          → NewEmail
//            → ExtractionAgent
//              → CheckTheArithmetic
//                → SameInvoiceBefore
//                  → WhatWeKnowOfTheVendor
//                    → CompareWithHistory
//                      → CodingAgent
//                        → HoldItToTheChart
//                          → Clean
//                            → CreateTheBillInQuickbooks
//                              → FileTheInvoice
//                                → LabelAsFiled
//                             .out(1) → ExplainWhatIsWrong
//                                → QueueForReview
//                                  → ReviewMessage
//                                    → TellFinance
//                           .out(1) → ExplainWhatIsWrong (↩ loop)
//           .out(1) → AlreadyProcessed
//       .out(1) → NothingToRead
// _0630Daily
//    → YesterdaySBankLines
//      → BillsAwaitingPayment
//        → MatchTheExactOnes
//          → AnythingLeftOver
//            → MatchingAgent
//              → AcceptOnlyWhatHoldsUp
//                → OneRowPerMatch
//                  → MarkTheBillPaid
//                    → PostTheReconciliation
//           .out(1) → AcceptOnlyWhatHoldsUp (↩ loop)
// _0700Daily
//    → TheLast90Days
//      → LookForTheUnusual
//        → AnythingUnusual
//          → AnomalyAgent
//            → RecordTheFlags
//              → RaiseTheAnomalies
//         .out(1) → NothingUnusual
// FinanceQuestion
//    → ReadTheQuestion
//      → AllowedToAsk
//        → AnalystAgent
//          → OnlyAnswerWithWorking
//            → LogTheQuestion
//              → AnswerInSlack
//       .out(1) → NotAllowed
// _1stOfTheMonth
//    → TwoMonthsOfInvoices
//      → TotalByAccount
//        → CloseAgent
//          → OneRowPerAccount
//            → AddToTheMonthEndPack
//              → PostTheClose
//
// AI CONNECTIONS
// ExtractionAgent.uses({ ai_languageModel: GptExtraction, ai_outputParser: InvoiceFields })
// CodingAgent.uses({ ai_languageModel: ClaudeCoding, ai_tool: [ChartOfAccounts], ai_outputParser: Account })
// ChartOfAccounts.uses({ ai_embedding: EmbeddingsChart })
// MatchingAgent.uses({ ai_languageModel: ClaudeMatching, ai_outputParser: ProposedMatches })
// AnomalyAgent.uses({ ai_languageModel: ClaudeAnomalies })
// AnalystAgent.uses({ ai_languageModel: ClaudeAnalysis, ai_memory: ConversationMemory, ai_tool: [LedgerQuery, Calculator, PlanTheAnswer], ai_outputParser: Answer })
// CloseAgent.uses({ ai_languageModel: ClaudeClose, ai_outputParser: CloseNote })
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'AI back office · Invoices, bank lines and questions',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class AiBackOfficeInvoicesBankLinesAndQuestionsWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'de144109-62eb-4b32-a008-ee122f85d46f',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -220],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## AI back office · Invoices, bank lines and questions
Agents read supplier invoices from Gmail, code them against the chart of accounts and file them in QuickBooks. Bank lines are matched every morning, the ledger is scanned for anomalies, finance can ask questions in Slack, and the month closes into a Google Sheets pack. Every figure is checked or computed in code.

**Platforms:** Gmail, OpenAI, Supabase, Claude, Pinecone, QuickBooks, Slack, Google Sheets
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/ai-back-office\``,
    };

    @node({
        id: '7055d7f9-38ac-4261-aa0c-dd911486443d',
        name: 'Section: Invoice intake: read, check, code, file',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 0],
    })
    SectionInvoiceIntakeReadCheckCodeFile = {
        width: 5400,
        height: 770,
        color: 4,
        content: `## 1. Invoice intake: read, check, code, file
A model copies the fields. Code checks the document's own arithmetic and the vendor's history before anything reaches QuickBooks.`,
    };

    @node({
        id: '2a95a134-f640-4732-a3f0-113ba432fb4e',
        name: 'Section: Bank matching',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 850],
    })
    SectionBankMatching = {
        width: 2920,
        height: 590,
        color: 5,
        content: `## 2. Bank matching
Exact matches in code first. An agent proposes the rest; equal amounts and confidence decide.`,
    };

    @node({
        id: '834f977f-93a1-4391-ad7c-a2feee84c153',
        name: 'Section: Anomaly watch',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 1520],
    })
    SectionAnomalyWatch = {
        width: 1940,
        height: 770,
        color: 6,
        content: `## 3. Anomaly watch
Fixed rules raise the flags. The agent only orders and explains them.`,
    };

    @node({
        id: '9c2ee08f-ff2f-4b03-a7ab-92c78bb4682d',
        name: 'Section: Questions in Slack',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 2370],
    })
    SectionQuestionsInSlack = {
        width: 2940,
        height: 770,
        color: 3,
        content: `## 4. Questions in Slack
Read-only tools, a calculator, and no answer without the rows behind it.`,
    };

    @node({
        id: '8bd871c9-351e-434d-a616-4cf4ebfb8e13',
        name: 'Section: Month end',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 3220],
    })
    SectionMonthEnd = {
        width: 2140,
        height: 590,
        color: 7,
        content: '## 5. Month end',
    };

    @node({
        id: 'aba7b0d9-9fda-4ad7-ad20-916b6d32084c',
        name: 'Invoice email arrives',
        type: 'n8n-nodes-base.gmailTrigger',
        version: 1.2,
        position: [0, 420],
        credentials: { gmailOAuth2: { id: '__CRED:gmail__', name: 'Gmail' } },
    })
    InvoiceEmailArrives = {
        pollTimes: {
            item: [
                {
                    mode: 'everyMinute',
                },
            ],
        },
        simple: true,
        filters: {
            readStatus: 'unread',
        },
    };

    @node({
        id: 'f1b5258c-49ef-48e1-a9cf-19366fe695c0',
        name: 'Read the email',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 420],
    })
    ReadTheEmail = {
        jsCode: `return $input.all().map((item) => {
  const m = item.json;
  const text = String(m.text ?? m.snippet ?? "").slice(0, 12000);
  return { json: { message_id: String(m.id ?? ""), from: String(m.From ?? m.from ?? "").toLowerCase(), subject: String(m.Subject ?? m.subject ?? ""), text, has_text: text.trim().length > 40, scope: "invoice-email", key: String(m.id ?? "") } };
});`,
    };

    @node({
        id: '2309beeb-228a-4c69-a121-986794386af0',
        name: 'Something to read?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [520, 420],
    })
    SomethingToRead = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '7c80065f-2f87-46fe-a813-7f100d305da1',
                    leftValue: '={{ $json.has_text && !!$json.message_id }}',
                    rightValue: '',
                    operator: {
                        type: 'boolean',
                        operation: 'true',
                        singleValue: true,
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        id: '25bae8fc-45e5-42d5-ad3e-70d159f321f8',
        name: 'Nothing to read',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [780, 330],
    })
    NothingToRead = {};

    @node({
        id: '326b7247-8582-4a1a-ab50-ea1b088399f6',
        name: 'Seen this email?',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [780, 510],
    })
    SeenThisEmail = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:idempotency-guard__',
        },
        options: {},
    };

    @node({
        id: 'e3f4cd85-7e3a-4a1d-a295-df422bf85781',
        name: 'New email?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1040, 420],
    })
    NewEmail = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '998c0d45-9e17-4c1b-a693-f5c6704d29b6',
                    leftValue: '={{ !$json.duplicate }}',
                    rightValue: '',
                    operator: {
                        type: 'boolean',
                        operation: 'true',
                        singleValue: true,
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        id: '6337c92c-3e07-47ff-aff5-88239f76f785',
        name: 'Already processed',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1400, 200],
    })
    AlreadyProcessed = {};

    @node({
        id: 'a072f5df-7d2f-4c37-a64d-e4c9ceec0353',
        name: 'Extraction agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [1400, 380],
        onError: 'continueRegularOutput',
    })
    ExtractionAgent = {
        promptType: 'define',
        text: '={{ $json.text }}',
        hasOutputParser: true,
        options: {
            systemMessage:
                'You are the Extraction agent. Copy the fields of this supplier invoice exactly as written: vendor name, invoice number, invoice date and due date as YYYY-MM-DD, currency, each line with its amount, subtotal, tax, total, and the bank account or IBAN to pay if one is printed. Use null for anything not on the document. Never work a number out: copy it.',
            maxIterations: 6,
        },
    };

    @node({
        id: '22ad0332-2f24-4bdd-ae8c-7523bf77c0ba',
        name: 'GPT · extraction',
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        version: 1.2,
        position: [1300, 600],
        credentials: { openAiApi: { id: '__CRED:openai__', name: 'OpenAI' } },
    })
    GptExtraction = {
        model: {
            __rl: true,
            mode: 'id',
            value: 'gpt-4o',
        },
        options: {
            temperature: 0,
        },
    };

    @node({
        id: 'a12f6405-300a-4856-a09a-f4c1cdb7b430',
        name: 'Invoice fields',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [1500, 600],
    })
    InvoiceFields = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "vendor": "Acme Supplies",
  "invoice_number": "INV-1042",
  "invoice_date": "2026-10-01",
  "due_date": "2026-10-31",
  "currency": "USD",
  "lines": [
    {
      "description": "Paper",
      "amount": 100.5
    }
  ],
  "subtotal": 100.5,
  "tax": 20.1,
  "total": 120.6,
  "bank_account": "GB00BANK0000",
  "confidence": 0.95
}`,
    };

    @node({
        id: '529982cb-9ead-49ea-a022-a14170be0c2b',
        name: 'Check the arithmetic',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1760, 420],
    })
    CheckTheArithmetic = {
        jsCode: `const e = $("New email?").first().json;
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
return [{ json: { ...e, vendor: f?.vendor ?? null, invoice_number: f?.invoice_number ?? null, invoice_date: f?.invoice_date ?? null, due_date: f?.due_date ?? null, currency: f?.currency ?? "USD", lines, subtotal, tax, total, bank_account: f?.bank_account ?? null, problems } }];`,
    };

    @node({
        id: '3ae2de49-d286-4f1e-a2bf-8c617fcd3c13',
        name: 'Same invoice before?',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [2020, 420],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SameInvoiceBefore = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'supplier_invoices',
        returnAll: true,
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'vendor',
                    condition: 'eq',
                    keyValue: "={{ ($json.vendor ?? '') }}",
                },
                {
                    keyName: 'invoice_number',
                    condition: 'eq',
                    keyValue: "={{ ($json.invoice_number ?? '') }}",
                },
            ],
        },
    };

    @node({
        id: 'ab3a7206-a882-45f7-aec4-15be4585f1bf',
        name: 'What we know of the vendor',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [2280, 420],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        executeOnce: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    WhatWeKnowOfTheVendor = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'vendors',
        returnAll: true,
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'name',
                    condition: 'eq',
                    keyValue: "={{ ($('Check the arithmetic').first().json.vendor ?? '') }}",
                },
            ],
        },
    };

    @node({
        id: 'a7ee9286-e3dc-4e4a-a964-b5f8abfa3a98',
        name: 'Compare with history',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2540, 420],
    })
    CompareWithHistory = {
        jsCode: `const i = $("Check the arithmetic").first().json;
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
return [{ json: { ...i, vendor_known: !!v.name, default_account: v.default_account ?? null, problems } }];`,
    };

    @node({
        id: '60a95692-d09f-486a-ae63-fc1f93b98a6f',
        name: 'Coding agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [3000, 200],
        onError: 'continueRegularOutput',
    })
    CodingAgent = {
        promptType: 'define',
        text: '={{ JSON.stringify({ vendor: $json.vendor, lines: $json.lines, default_account: $json.default_account }) }}',
        hasOutputParser: true,
        options: {
            systemMessage:
                'You are the Coding agent. Choose the expense account for this invoice from the chart of accounts. Search the chart first and answer with an account name exactly as it appears there. If the vendor has a default account and the lines fit it, use it. Give your confidence.',
            maxIterations: 6,
        },
    };

    @node({
        id: 'b46c4d62-ed64-4208-a235-1dccf5fff77d',
        name: 'Claude · coding',
        type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
        version: 1.3,
        position: [2800, 420],
        credentials: { anthropicApi: { id: '__CRED:anthropic__', name: 'Claude' } },
    })
    ClaudeCoding = {
        model: {
            __rl: true,
            mode: 'id',
            value: 'claude-sonnet-4-5',
        },
        options: {
            temperature: 0.2,
        },
    };

    @node({
        id: '6a42606c-9d1b-4e8f-ac11-060857fd2090',
        name: 'Chart of accounts',
        type: '@n8n/n8n-nodes-langchain.vectorStorePinecone',
        version: 1.3,
        position: [3000, 420],
        credentials: { pineconeApi: { id: '__CRED:pinecone__', name: 'Pinecone' } },
    })
    ChartOfAccounts = {
        mode: 'retrieve-as-tool',
        toolDescription: 'Search the chart of accounts and the notes on what belongs in each account.',
        pineconeIndex: {
            __rl: true,
            mode: 'id',
            value: 'finance-index',
        },
        topK: 4,
        options: {},
    };

    @node({
        id: 'dbee38a0-2771-4236-a5e7-d66820b11424',
        name: 'Embeddings · chart',
        type: '@n8n/n8n-nodes-langchain.embeddingsOpenAi',
        version: 1.2,
        position: [3000, 640],
        credentials: { openAiApi: { id: '__CRED:openai__', name: 'OpenAI' } },
    })
    EmbeddingsChart = {
        model: 'text-embedding-3-small',
        options: {},
    };

    @node({
        id: 'a87084c7-ed35-4677-af63-28ab87c2462c',
        name: 'Account',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [3200, 420],
    })
    Account = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "account": "Office supplies",
  "confidence": 0.9
}`,
    };

    @node({
        id: '186d2137-cbc8-4528-a5cd-465a0fcee4b8',
        name: 'Hold it to the chart',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [3460, 420],
    })
    HoldItToTheChart = {
        jsCode: `const i = $("Compare with history").first().json;
const o = $input.first().json.output;
const CHART = ["Office supplies", "Software", "Rent", "Utilities", "Professional fees", "Travel", "Marketing", "Cost of goods sold", "Equipment"];
const problems = [...i.problems];
const account = o && CHART.includes(o.account) ? o.account : null;
if (!account) problems.push("no valid account could be chosen");
else if ((Number(o.confidence) || 0) < 0.75) problems.push("unsure which account (" + account + "?)");
return [{ json: { ...i, account, problems, clean: problems.length === 0 } }];`,
    };

    @node({
        id: '0f0ec78b-8aa3-45d4-ab94-b5c071c9c720',
        name: 'Clean?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [3720, 420],
    })
    Clean = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'f9865d9d-1d89-460c-a60d-10222963f4e9',
                    leftValue: '={{ $json.clean }}',
                    rightValue: '',
                    operator: {
                        type: 'boolean',
                        operation: 'true',
                        singleValue: true,
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        id: '3ced29f5-4eec-49a2-ace5-48ff459cf014',
        name: 'Create the bill in QuickBooks',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [3980, 420],
        credentials: { quickBooksOAuth2Api: { id: '__CRED:quickbooks__', name: 'QuickBooks' } },
        onError: 'continueErrorOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateTheBillInQuickbooks = {
        method: 'POST',
        url: "={{ 'https://sandbox-quickbooks.api.intuit.com/v3/company/123' + '/bill' }}",
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'quickBooksOAuth2Api',
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ VendorRef: { name: $json.vendor }, DocNumber: $json.invoice_number, TxnDate: $json.invoice_date, DueDate: $json.due_date, CurrencyRef: { value: $json.currency }, Line: [{ Amount: $json.total, DetailType: 'AccountBasedExpenseLineDetail', AccountBasedExpenseLineDetail: { AccountRef: { name: $json.account } } }] }) }}",
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: '5be9bdbe-4a6f-491e-a776-ef691c7933b4',
        name: 'File the invoice',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [4240, 330],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    FileTheInvoice = {
        resource: 'row',
        operation: 'create',
        tableId: 'supplier_invoices',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'vendor',
                    fieldValue: "={{ $('Clean?').first().json.vendor }}",
                },
                {
                    fieldId: 'invoice_number',
                    fieldValue: "={{ $('Clean?').first().json.invoice_number }}",
                },
                {
                    fieldId: 'total',
                    fieldValue: "={{ $('Clean?').first().json.total }}",
                },
                {
                    fieldId: 'currency',
                    fieldValue: "={{ $('Clean?').first().json.currency }}",
                },
                {
                    fieldId: 'due_date',
                    fieldValue: "={{ $('Clean?').first().json.due_date }}",
                },
                {
                    fieldId: 'account',
                    fieldValue: "={{ $('Clean?').first().json.account }}",
                },
                {
                    fieldId: 'bill_id',
                    fieldValue: "={{ String($json.Bill?.Id ?? $json.id ?? '') }}",
                },
                {
                    fieldId: 'status',
                    fieldValue: "={{ 'awaiting_payment' }}",
                },
                {
                    fieldId: 'at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '2ef2bf87-21fb-4291-af78-e6c162e2d951',
        name: 'Label as filed',
        type: 'n8n-nodes-base.gmail',
        version: 2.1,
        position: [4500, 330],
        credentials: { gmailOAuth2: { id: '__CRED:gmail__', name: 'Gmail' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LabelAsFiled = {
        resource: 'message',
        operation: 'addLabels',
        messageId: "={{ $('Clean?').first().json.message_id }}",
        labelIds: ['Label_filed'],
    };

    @node({
        id: 'e824c6f3-a096-4bdb-a3ee-e205583bb21c',
        name: 'Explain what is wrong',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [4240, 510],
    })
    ExplainWhatIsWrong = {
        jsCode: `const i = $("Hold it to the chart").first().json;
const why = i.clean ? ["QuickBooks would not accept the bill"] : i.problems;
return [{ json: { message_id: i.message_id, vendor: i.vendor, invoice_number: i.invoice_number, total: i.total, why } }];`,
    };

    @node({
        id: 'd5ccc5e7-579a-498c-ae5c-d04edaad1396',
        name: 'Queue for review',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [4500, 510],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    QueueForReview = {
        resource: 'row',
        operation: 'create',
        tableId: 'invoice_review',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'message_id',
                    fieldValue: '={{ $json.message_id }}',
                },
                {
                    fieldId: 'vendor',
                    fieldValue: '={{ $json.vendor }}',
                },
                {
                    fieldId: 'invoice_number',
                    fieldValue: '={{ $json.invoice_number }}',
                },
                {
                    fieldId: 'total',
                    fieldValue: '={{ $json.total }}',
                },
                {
                    fieldId: 'problems',
                    fieldValue: '={{ $json.why }}',
                },
                {
                    fieldId: 'status',
                    fieldValue: "={{ 'open' }}",
                },
                {
                    fieldId: 'at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '4a96c767-3f76-40c0-ad12-bbec2376914d',
        name: 'Review message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [4760, 420],
    })
    ReviewMessage = {
        jsCode: `const r = $("Explain what is wrong").first().json;
const urgent = r.why.some((w) => /bank account/.test(w));
return [{ json: { channel: "#finance", level: urgent ? "critical" : "warn", text: "An invoice" + (r.vendor ? " from " + r.vendor : "") + (r.total ? " for " + r.total : "") + " needs a person: " + r.why.join("; ") + "." } }];`,
    };

    @node({
        id: 'd9e9f90c-09d6-4eb3-a9ee-cc7843109439',
        name: 'Tell finance',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [5020, 420],
    })
    TellFinance = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    @node({
        id: '1c93e2f0-24fd-46af-a408-5a16b3196626',
        name: '06:30 daily',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 1180],
    })
    _0630Daily = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '30 6 * * *',
                },
            ],
        },
    };

    @node({
        id: '41fea1fb-c26f-4330-af94-fc44f6e748b8',
        name: "Yesterday's bank lines",
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 1180],
        credentials: { quickBooksOAuth2Api: { id: '__CRED:quickbooks__', name: 'QuickBooks' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    YesterdaySBankLines = {
        method: 'GET',
        url: "={{ 'https://sandbox-quickbooks.api.intuit.com/v3/company/123' + '/query' }}",
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'quickBooksOAuth2Api',
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'query',
                    value: '={{ "select * from Purchase where TxnDate >= \'" + $now.minus({ days: 3 }).toISODate() + "\'" }}',
                },
            ],
        },
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: '54aa04ec-2467-4c28-ae5d-d1be6dc1f516',
        name: 'Bills awaiting payment',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [520, 1180],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        executeOnce: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    BillsAwaitingPayment = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'supplier_invoices',
        returnAll: true,
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'status',
                    condition: 'eq',
                    keyValue: "={{ 'awaiting_payment' }}",
                },
            ],
        },
    };

    @node({
        id: '9092e075-f8d9-4a6b-a488-6a1d3455684f',
        name: 'Match the exact ones',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [780, 1180],
    })
    MatchTheExactOnes = {
        jsCode: `const lines = ($("Yesterday's bank lines").first().json.QueryResponse?.Purchase ?? []).map((p) => ({ id: String(p.Id), amount: Number(p.TotalAmt), memo: String(p.PrivateNote ?? p.DocNumber ?? ""), date: p.TxnDate }));
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
return [{ json: { matched, unmatched, open: bills.filter((b) => !used.has(b.invoice_number)).map((b) => ({ invoice_number: b.invoice_number, vendor: b.vendor, total: b.total })) } }];`,
    };

    @node({
        id: 'a792cf19-18d3-45ac-a633-fc3bfb174575',
        name: 'Anything left over?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1040, 1180],
    })
    AnythingLeftOver = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '58ee1800-cc21-4c90-aa5c-ef5abc01c8e4',
                    leftValue: '={{ $json.unmatched.length > 0 && $json.open.length > 0 }}',
                    rightValue: '',
                    operator: {
                        type: 'boolean',
                        operation: 'true',
                        singleValue: true,
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        id: 'af6e0267-8bfc-4146-a575-6d2d50435b36',
        name: 'Matching agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [1400, 1050],
        onError: 'continueRegularOutput',
    })
    MatchingAgent = {
        promptType: 'define',
        text: '={{ JSON.stringify({ bank_lines: $json.unmatched, open_bills: $json.open }) }}',
        hasOutputParser: true,
        options: {
            systemMessage:
                'You are the Matching agent. Some bank lines did not match a bill exactly. For each bank line, say which open bill it most likely pays, if any, and why: a vendor name in the memo, a reference that is nearly the invoice number. Propose a match only when the amounts are equal. Give a confidence for each.',
            maxIterations: 6,
        },
    };

    @node({
        id: 'fe04f1f5-4ea0-4cc4-a9ea-991c67784611',
        name: 'Claude · matching',
        type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
        version: 1.3,
        position: [1300, 1270],
        credentials: { anthropicApi: { id: '__CRED:anthropic__', name: 'Claude' } },
    })
    ClaudeMatching = {
        model: {
            __rl: true,
            mode: 'id',
            value: 'claude-sonnet-4-5',
        },
        options: {
            temperature: 0.2,
        },
    };

    @node({
        id: '6b87ca2b-466d-480f-a9e8-8f67b8bea836',
        name: 'Proposed matches',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [1500, 1270],
    })
    ProposedMatches = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "matches": [
    {
      "line": "101",
      "invoice_number": "INV-1042",
      "why": "Vendor name in the memo",
      "confidence": 0.9
    }
  ]
}`,
    };

    @node({
        id: '9ac64b65-915b-4567-ab16-404f6cd6181a',
        name: 'Accept only what holds up',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1760, 1180],
    })
    AcceptOnlyWhatHoldsUp = {
        jsCode: `const m = $("Match the exact ones").first().json;
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
return [{ json: { matched, exceptions: m.unmatched.filter((l) => !lines.has(l.id)) } }];`,
    };

    @node({
        id: '81735fd5-d902-438c-a2a2-03a7db0943ae',
        name: 'One row per match',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2020, 1180],
    })
    OneRowPerMatch = {
        jsCode: 'return $input.first().json.matched.map((json) => ({ json }));',
    };

    @node({
        id: '961faa14-bf7d-41c4-adde-e78a87bed0e2',
        name: 'Mark the bill paid',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [2280, 1180],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MarkTheBillPaid = {
        resource: 'row',
        operation: 'update',
        tableId: 'supplier_invoices',
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'invoice_number',
                    condition: 'eq',
                    keyValue: '={{ ($json.invoice_number) }}',
                },
            ],
        },
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'status',
                    fieldValue: "={{ 'paid' }}",
                },
                {
                    fieldId: 'bank_line',
                    fieldValue: '={{ $json.line }}',
                },
                {
                    fieldId: 'matched_how',
                    fieldValue: '={{ $json.how }}',
                },
                {
                    fieldId: 'paid_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: 'a3a736e7-1304-47ae-aba0-eb8a69c5efcc',
        name: 'Post the reconciliation',
        type: 'n8n-nodes-base.slack',
        version: 2.3,
        position: [2540, 1180],
        credentials: { slackApi: { id: '__CRED:slack__', name: 'Slack' } },
        alwaysOutputData: true,
        executeOnce: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PostTheReconciliation = {
        resource: 'message',
        operation: 'post',
        select: 'channel',
        channelId: {
            __rl: true,
            mode: 'name',
            value: "={{ '#finance' }}",
        },
        text: "={{ ':bank: Matched ' + $('Accept only what holds up').first().json.matched.length + ' bank lines to bills. ' + ($('Accept only what holds up').first().json.exceptions.length ? $('Accept only what holds up').first().json.exceptions.length + ' could not be matched: ' + $('Accept only what holds up').first().json.exceptions.map(e => e.amount + ' \"' + e.memo + '\"').join('; ') : 'Nothing left unmatched.') }}",
        otherOptions: {
            includeLinkToWorkflow: false,
        },
    };

    @node({
        id: '55dc0876-5715-45ed-a72f-1e508d1bd0ef',
        name: '07:00 daily',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 1940],
    })
    _0700Daily = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 7 * * *',
                },
            ],
        },
    };

    @node({
        id: 'b4b472a3-da07-41a6-a8be-1b97012c5fd2',
        name: 'The last 90 days',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [260, 1940],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    TheLast90Days = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'supplier_invoices',
        returnAll: true,
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'at',
                    condition: 'gte',
                    keyValue: '={{ $now.minus({ days: 90 }).toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '89257099-368c-4272-a77a-f5d9a6b9e362',
        name: 'Look for the unusual',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, 1940],
    })
    LookForTheUnusual = {
        jsCode: `const rows = $input.all().map((i) => i.json).filter((r) => r.vendor && Number.isFinite(Number(r.total)));
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
return [{ json: { checked: recent.length, flags } }];`,
    };

    @node({
        id: 'b682f6ee-0413-45af-a986-d25d99585014',
        name: 'Anything unusual?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [780, 1940],
    })
    AnythingUnusual = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '0c2708e2-9751-43e3-a92b-0a2859fead84',
                    leftValue: '={{ $json.flags.length > 0 }}',
                    rightValue: '',
                    operator: {
                        type: 'boolean',
                        operation: 'true',
                        singleValue: true,
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        id: 'ceb72d75-e37a-4306-a951-c997dd3b1f3f',
        name: 'Anomaly agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [1040, 1720],
        onError: 'continueRegularOutput',
    })
    AnomalyAgent = {
        promptType: 'define',
        text: '={{ JSON.stringify($json.flags) }}',
        hasOutputParser: false,
        options: {
            systemMessage:
                'You are the Anomaly agent. These invoices were flagged by fixed rules. For a finance manager, put them in order of how much they deserve a look and say in one line each what to check. Do not add flags of your own and do not say anything is fraud.',
            maxIterations: 6,
        },
    };

    @node({
        id: 'fd128e96-fbe5-45a2-ac35-30267bd81b5a',
        name: 'Claude · anomalies',
        type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
        version: 1.3,
        position: [1040, 1940],
        credentials: { anthropicApi: { id: '__CRED:anthropic__', name: 'Claude' } },
    })
    ClaudeAnomalies = {
        model: {
            __rl: true,
            mode: 'id',
            value: 'claude-sonnet-4-5',
        },
        options: {
            temperature: 0.2,
        },
    };

    @node({
        id: 'e1ece6d2-292a-4b58-a29d-2faa466711b0',
        name: 'Record the flags',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1300, 1940],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    RecordTheFlags = {
        resource: 'row',
        operation: 'create',
        tableId: 'anomalies',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'flags',
                    fieldValue: "={{ $('Look for the unusual').first().json.flags }}",
                },
                {
                    fieldId: 'note',
                    fieldValue: '={{ $json.output ?? null }}',
                },
                {
                    fieldId: 'at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '245dcb51-e98d-4a95-a0ff-b37b160cf719',
        name: 'Raise the anomalies',
        type: 'n8n-nodes-base.slack',
        version: 2.3,
        position: [1560, 1940],
        credentials: { slackApi: { id: '__CRED:slack__', name: 'Slack' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    RaiseTheAnomalies = {
        resource: 'message',
        operation: 'post',
        select: 'channel',
        channelId: {
            __rl: true,
            mode: 'name',
            value: "={{ '#finance' }}",
        },
        text: "={{ ':warning: ' + $('Look for the unusual').first().json.flags.length + ' invoice(s) look unusual.\\n' + ($('Anomaly agent').first().json.output ?? $('Look for the unusual').first().json.flags.map(f => f.vendor + ' ' + f.invoice_number + ': ' + f.kind).join('\\n')) }}",
        otherOptions: {
            includeLinkToWorkflow: false,
        },
    };

    @node({
        id: 'be18afa2-dac5-499d-a9d3-ffebf0e54de5',
        name: 'Nothing unusual',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1040, 2160],
    })
    NothingUnusual = {};

    @node({
        id: '11850987-84b2-4ba2-a185-2b78090bb7d0',
        webhookId: 'b9a174ec-7306-4ed7-a256-e7364b74b7ae',
        name: 'Finance question',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 2790],
    })
    FinanceQuestion = {
        httpMethod: 'POST',
        path: 'finance-question',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        id: '260ac3c3-7fba-46c7-add0-dd0c58f7efa7',
        name: 'Read the question',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 2790],
    })
    ReadTheQuestion = {
        jsCode: `const b = $input.first().json.body ?? {};
const ALLOWED = ["U-FINANCE-1", "U-FINANCE-2", "U-OWNER"]; // the Slack users who may ask about the books
const user = String(b.user_id ?? "");
const text = String(b.text ?? "").trim().slice(0, 600);
return [{ json: { user, text, allowed: ALLOWED.includes(user) && text.length > 3 } }];`,
    };

    @node({
        id: 'bc94f087-4c6e-4b2d-ab4b-22ac6644631b',
        name: 'Allowed to ask?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [520, 2790],
    })
    AllowedToAsk = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'dd62870a-5622-4ab8-a77c-60f6a28aec41',
                    leftValue: '={{ $json.allowed }}',
                    rightValue: '',
                    operator: {
                        type: 'boolean',
                        operation: 'true',
                        singleValue: true,
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        id: '3c391774-4fc4-4ebc-a4b7-c51ed54eaca5',
        name: 'Not allowed',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [1280, 2570],
    })
    NotAllowed = {
        respondWith: 'json',
        responseBody:
            "={{ JSON.stringify({ response_type: 'ephemeral', text: 'Sorry, only the finance team can ask about the books.' }) }}",
        options: {
            responseCode: 200,
        },
    };

    @node({
        id: '1c76cb04-5705-4336-a480-8af85aeecfcc',
        name: 'Analyst agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [1280, 2750],
        onError: 'continueRegularOutput',
    })
    AnalystAgent = {
        promptType: 'define',
        text: '={{ $json.text }}',
        hasOutputParser: true,
        options: {
            systemMessage:
                'You are the Analyst agent for a finance team. Answer questions about supplier invoices from the ledger. Always query the ledger before answering, and add numbers up with the calculator, never in your head. Reply with the answer in one or two sentences, the figures you used, and which rows they came from. If the ledger cannot answer the question, say so. You can read; you cannot pay, change or delete anything.',
            maxIterations: 8,
        },
    };

    @node({
        id: 'c3e4572b-87e6-486d-a583-2e07b0a46f37',
        name: 'Claude · analysis',
        type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
        version: 1.3,
        position: [780, 2970],
        credentials: { anthropicApi: { id: '__CRED:anthropic__', name: 'Claude' } },
    })
    ClaudeAnalysis = {
        model: {
            __rl: true,
            mode: 'id',
            value: 'claude-sonnet-4-5',
        },
        options: {
            temperature: 0.2,
        },
    };

    @node({
        id: 'c7dab864-69ec-4aca-aca6-04e56e610c67',
        name: 'Conversation memory',
        type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
        version: 1.3,
        position: [980, 2970],
    })
    ConversationMemory = {
        sessionIdType: 'customKey',
        sessionKey: "={{ 'finance-' + $json.user }}",
        contextWindowLength: 8,
    };

    @node({
        id: 'c1d6f76d-43e6-40f3-abed-3f24249543aa',
        name: 'Ledger query',
        type: 'n8n-nodes-base.supabaseTool',
        version: 1,
        position: [1180, 2970],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
    })
    LedgerQuery = {
        descriptionType: 'manual',
        toolDescription:
            'Reads supplier invoices from the ledger. Columns: vendor, invoice_number, total, currency, due_date, account, status (awaiting_payment or paid), at.',
        resource: 'row',
        operation: 'getAll',
        tableId: 'supplier_invoices',
        returnAll: false,
        limit: 200,
        filterType: 'string',
        filterString:
            "={{ $fromAI('filter', `A PostgREST filter, for example status=eq.awaiting_payment or vendor=eq.Acme Supplies. Leave empty for all rows.`, 'string') }}",
    };

    @node({
        id: '872ba507-d118-43fc-ad58-bc3153a13051',
        name: 'Calculator',
        type: '@n8n/n8n-nodes-langchain.toolCode',
        version: 1.3,
        position: [1380, 2970],
    })
    Calculator = {
        description: 'Adds a list of numbers. Pass them separated by commas.',
        jsCode: "const n = String(query).split(',').map((x) => Number(x.trim())).filter(Number.isFinite); return String(Math.round(n.reduce((a, b) => a + b, 0) * 100) / 100);",
    };

    @node({
        id: '590660ac-da55-4f0e-afec-710cf6ac06fe',
        name: 'Plan the answer',
        type: '@n8n/n8n-nodes-langchain.toolThink',
        version: 1,
        position: [1580, 2970],
    })
    PlanTheAnswer = {};

    @node({
        id: 'cdece9b1-125b-4c3b-ae9f-b15f253cd07b',
        name: 'Answer',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [1780, 2970],
    })
    Answer = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "answer": "The answer in one or two sentences.",
  "figures": [
    "Acme Supplies: 1280.50"
  ],
  "rows_used": 3
}`,
    };

    @node({
        id: '89903c9b-e380-4874-a99b-cbfcb64e878e',
        name: 'Only answer with working',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2040, 2790],
    })
    OnlyAnswerWithWorking = {
        jsCode: `const q = $("Allowed to ask?").first().json;
const o = $input.first().json.output;
// An answer about the books with no rows behind it is not an answer.
const ok = o && typeof o.answer === "string" && Number(o.rows_used) > 0 && Array.isArray(o.figures) && o.figures.length > 0;
const text = ok ? o.answer + "\\n_From " + o.rows_used + " ledger rows: " + o.figures.slice(0, 6).join("; ") + "_" : "I could not answer that from the ledger. Try naming a vendor, a status or a date range.";
return [{ json: { user: q.user, question: q.text, answered: !!ok, text } }];`,
    };

    @node({
        id: '18995823-db55-42fd-a528-ac132106a937',
        name: 'Log the question',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [2300, 2790],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LogTheQuestion = {
        resource: 'row',
        operation: 'create',
        tableId: 'finance_questions',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'user',
                    fieldValue: '={{ $json.user }}',
                },
                {
                    fieldId: 'question',
                    fieldValue: '={{ $json.question }}',
                },
                {
                    fieldId: 'answered',
                    fieldValue: '={{ $json.answered }}',
                },
                {
                    fieldId: 'at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: 'af364449-67e6-487a-adad-5abf8aff6d7c',
        name: 'Answer in Slack',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [2560, 2790],
    })
    AnswerInSlack = {
        respondWith: 'json',
        responseBody:
            "={{ JSON.stringify({ response_type: 'in_channel', text: $('Only answer with working').first().json.text }) }}",
        options: {
            responseCode: 200,
        },
    };

    @node({
        id: '8cf27b61-0841-4a27-a20b-9377de979232',
        name: '1st of the month',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 3550],
    })
    _1stOfTheMonth = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 8 1 * *',
                },
            ],
        },
    };

    @node({
        id: '20bd5133-40ad-4e25-aa06-5173dda34d60',
        name: 'Two months of invoices',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [260, 3550],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    TwoMonthsOfInvoices = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'supplier_invoices',
        returnAll: true,
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'at',
                    condition: 'gte',
                    keyValue: "={{ $now.minus({ months: 2 }).startOf('month').toISO() }}",
                },
            ],
        },
    };

    @node({
        id: 'e31d22e6-babe-4b28-a2d3-0f7effb73ea3',
        name: 'Total by account',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, 3550],
    })
    TotalByAccount = {
        jsCode: `const rows = $input.all().map((i) => i.json).filter((r) => r.account && r.at);
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
return [{ json: { month: last.toFormat("yyyy-LL"), lines, total: sum(lines.map((l) => ({ total: l.amount }))), prior_total: sum(lines.map((l) => ({ total: l.prior }))), unpaid_count: unpaid.length, unpaid_total: sum(unpaid) } }];`,
    };

    @node({
        id: '77d63ac4-dd34-496f-a4e0-6e2efec9b039',
        name: 'Close agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [880, 3420],
        onError: 'continueRegularOutput',
    })
    CloseAgent = {
        promptType: 'define',
        text: '={{ JSON.stringify($json) }}',
        hasOutputParser: true,
        options: {
            systemMessage:
                'You are the Close agent. Write the month-end note for the owner: three sentences on what was spent and what changed against the month before, then up to three things worth a question. Use only the figures given, and quote them exactly.',
            maxIterations: 6,
        },
    };

    @node({
        id: '4544eba0-5472-4aef-a194-ab85e2f7c63f',
        name: 'Claude · close',
        type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
        version: 1.3,
        position: [780, 3640],
        credentials: { anthropicApi: { id: '__CRED:anthropic__', name: 'Claude' } },
    })
    ClaudeClose = {
        model: {
            __rl: true,
            mode: 'id',
            value: 'claude-sonnet-4-5',
        },
        options: {
            temperature: 0.2,
        },
    };

    @node({
        id: '5fce851f-ce89-45b8-a932-78fe6a0ca25e',
        name: 'Close note',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [980, 3640],
    })
    CloseNote = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "summary": "Three sentences.",
  "questions": [
    "Something worth asking about"
  ]
}`,
    };

    @node({
        id: '59121e8a-dbed-44a0-aba9-129a3e4e01fa',
        name: 'One row per account',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1240, 3550],
    })
    OneRowPerAccount = {
        jsCode: 'return $("Total by account").first().json.lines.map((json) => ({ json }));',
    };

    @node({
        id: 'd3c4fe2c-38b3-4cda-ad7f-9351283792b6',
        name: 'Add to the month-end pack',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [1500, 3550],
        credentials: { googleSheetsOAuth2Api: { id: '__CRED:googleSheets__', name: 'Google Sheets' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    AddToTheMonthEndPack = {
        resource: 'sheet',
        operation: 'append',
        documentId: {
            __rl: true,
            mode: 'id',
            value: 'month-end-pack',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'Pack',
        },
        columns: {
            mappingMode: 'autoMapInputData',
            value: {},
            matchingColumns: [],
            schema: [],
        },
        options: {},
    };

    @node({
        id: 'f5064661-d5be-4840-a10f-91aed447e676',
        name: 'Post the close',
        type: 'n8n-nodes-base.slack',
        version: 2.3,
        position: [1760, 3550],
        credentials: { slackApi: { id: '__CRED:slack__', name: 'Slack' } },
        executeOnce: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PostTheClose = {
        resource: 'message',
        operation: 'post',
        select: 'channel',
        channelId: {
            __rl: true,
            mode: 'name',
            value: "={{ '#finance' }}",
        },
        text: "={{ ':ledger: *' + $('Total by account').first().json.month + ' closed.* Spend ' + $('Total by account').first().json.total + ' (prior month ' + $('Total by account').first().json.prior_total + '). ' + $('Total by account').first().json.unpaid_count + ' bills unpaid, ' + $('Total by account').first().json.unpaid_total + '.\\n' + ($('Close agent').first().json.output?.summary ?? 'The written note is unavailable; the figures are in the pack.') }}",
        otherOptions: {
            includeLinkToWorkflow: false,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.InvoiceEmailArrives.out(0).to(this.ReadTheEmail.in(0));
        this.ReadTheEmail.out(0).to(this.SomethingToRead.in(0));
        this.SomethingToRead.out(0).to(this.SeenThisEmail.in(0));
        this.SomethingToRead.out(1).to(this.NothingToRead.in(0));
        this.SeenThisEmail.out(0).to(this.NewEmail.in(0));
        this.NewEmail.out(0).to(this.ExtractionAgent.in(0));
        this.NewEmail.out(1).to(this.AlreadyProcessed.in(0));
        this.ExtractionAgent.out(0).to(this.CheckTheArithmetic.in(0));
        this.CheckTheArithmetic.out(0).to(this.SameInvoiceBefore.in(0));
        this.SameInvoiceBefore.out(0).to(this.WhatWeKnowOfTheVendor.in(0));
        this.WhatWeKnowOfTheVendor.out(0).to(this.CompareWithHistory.in(0));
        this.CompareWithHistory.out(0).to(this.CodingAgent.in(0));
        this.CodingAgent.out(0).to(this.HoldItToTheChart.in(0));
        this.HoldItToTheChart.out(0).to(this.Clean.in(0));
        this.Clean.out(0).to(this.CreateTheBillInQuickbooks.in(0));
        this.Clean.out(1).to(this.ExplainWhatIsWrong.in(0));
        this.CreateTheBillInQuickbooks.out(0).to(this.FileTheInvoice.in(0));
        this.CreateTheBillInQuickbooks.out(1).to(this.ExplainWhatIsWrong.in(0));
        this.FileTheInvoice.out(0).to(this.LabelAsFiled.in(0));
        this.ExplainWhatIsWrong.out(0).to(this.QueueForReview.in(0));
        this.QueueForReview.out(0).to(this.ReviewMessage.in(0));
        this.ReviewMessage.out(0).to(this.TellFinance.in(0));
        this._0630Daily.out(0).to(this.YesterdaySBankLines.in(0));
        this.YesterdaySBankLines.out(0).to(this.BillsAwaitingPayment.in(0));
        this.BillsAwaitingPayment.out(0).to(this.MatchTheExactOnes.in(0));
        this.MatchTheExactOnes.out(0).to(this.AnythingLeftOver.in(0));
        this.AnythingLeftOver.out(0).to(this.MatchingAgent.in(0));
        this.AnythingLeftOver.out(1).to(this.AcceptOnlyWhatHoldsUp.in(0));
        this.MatchingAgent.out(0).to(this.AcceptOnlyWhatHoldsUp.in(0));
        this.AcceptOnlyWhatHoldsUp.out(0).to(this.OneRowPerMatch.in(0));
        this.OneRowPerMatch.out(0).to(this.MarkTheBillPaid.in(0));
        this.MarkTheBillPaid.out(0).to(this.PostTheReconciliation.in(0));
        this._0700Daily.out(0).to(this.TheLast90Days.in(0));
        this.TheLast90Days.out(0).to(this.LookForTheUnusual.in(0));
        this.LookForTheUnusual.out(0).to(this.AnythingUnusual.in(0));
        this.AnythingUnusual.out(0).to(this.AnomalyAgent.in(0));
        this.AnythingUnusual.out(1).to(this.NothingUnusual.in(0));
        this.AnomalyAgent.out(0).to(this.RecordTheFlags.in(0));
        this.RecordTheFlags.out(0).to(this.RaiseTheAnomalies.in(0));
        this.FinanceQuestion.out(0).to(this.ReadTheQuestion.in(0));
        this.ReadTheQuestion.out(0).to(this.AllowedToAsk.in(0));
        this.AllowedToAsk.out(0).to(this.AnalystAgent.in(0));
        this.AllowedToAsk.out(1).to(this.NotAllowed.in(0));
        this.AnalystAgent.out(0).to(this.OnlyAnswerWithWorking.in(0));
        this.OnlyAnswerWithWorking.out(0).to(this.LogTheQuestion.in(0));
        this.LogTheQuestion.out(0).to(this.AnswerInSlack.in(0));
        this._1stOfTheMonth.out(0).to(this.TwoMonthsOfInvoices.in(0));
        this.TwoMonthsOfInvoices.out(0).to(this.TotalByAccount.in(0));
        this.TotalByAccount.out(0).to(this.CloseAgent.in(0));
        this.CloseAgent.out(0).to(this.OneRowPerAccount.in(0));
        this.OneRowPerAccount.out(0).to(this.AddToTheMonthEndPack.in(0));
        this.AddToTheMonthEndPack.out(0).to(this.PostTheClose.in(0));

        this.ExtractionAgent.uses({
            ai_languageModel: this.GptExtraction.output,
            ai_outputParser: this.InvoiceFields.output,
        });
        this.CodingAgent.uses({
            ai_languageModel: this.ClaudeCoding.output,
            ai_outputParser: this.Account.output,
            ai_tool: [this.ChartOfAccounts.output],
        });
        this.ChartOfAccounts.uses({
            ai_embedding: this.EmbeddingsChart.output,
        });
        this.MatchingAgent.uses({
            ai_languageModel: this.ClaudeMatching.output,
            ai_outputParser: this.ProposedMatches.output,
        });
        this.AnomalyAgent.uses({
            ai_languageModel: this.ClaudeAnomalies.output,
        });
        this.AnalystAgent.uses({
            ai_languageModel: this.ClaudeAnalysis.output,
            ai_memory: this.ConversationMemory.output,
            ai_outputParser: this.Answer.output,
            ai_tool: [this.LedgerQuery.output, this.Calculator.output, this.PlanTheAnswer.output],
        });
        this.CloseAgent.uses({
            ai_languageModel: this.ClaudeClose.output,
            ai_outputParser: this.CloseNote.output,
        });
    }
}
