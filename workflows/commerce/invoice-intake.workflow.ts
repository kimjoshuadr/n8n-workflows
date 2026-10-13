import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Finance · Supplier invoice intake
// Nodes   : 12  |  Connections: 10
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// InvoiceReceived                    webhook
// ReadTheUpload                      code
// ExtractTheFields                   httpRequest                [onError→regular] [retry]
// ReadTheFields                      code
// SeenThisInvoice                    httpRequest                [alwaysOutput] [retry]
// CheckIt                            code
// Clean                              if
// FileIt                             httpRequest                [retry]
// QueueForReview                     httpRequest                [retry]
// ReviewMessage                      code
// TellFinance                        executeWorkflow
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// InvoiceReceived
//    → ReadTheUpload
//      → ExtractTheFields
//        → ReadTheFields
//          → SeenThisInvoice
//            → CheckIt
//              → Clean
//                → FileIt
//               .out(1) → QueueForReview
//                  → ReviewMessage
//                    → TellFinance
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Finance · Supplier invoice intake',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class FinanceSupplierInvoiceIntakeWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'b82bc863-c3b5-4db8-aada-a4e84786912b',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Finance · Supplier invoice intake
Reads a supplier invoice with a model, checks the arithmetic and the duplicate history itself, and files it or sends it for review.

**Platforms:** none, this is logic only
**Settings:** DB_API_KEY, DB_BASE_URL, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`workflows/commerce\``,
    };

    @node({
        id: '2d441b15-b385-429f-aa5b-7bed507d0641',
        webhookId: 'c031b77e-c01d-4e46-aaaf-47b5aae59510',
        name: 'Invoice received',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 180],
    })
    InvoiceReceived = {
        httpMethod: 'POST',
        path: 'invoice-received',
        responseMode: 'onReceived',
        options: {},
    };

    @node({
        id: '03e231f0-d86d-4ba5-a2de-0b0b5a10f8bb',
        name: 'Read the upload',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 180],
    })
    ReadTheUpload = {
        jsCode: `const b = $input.first().json.body ?? {};
return [{ json: { file_url: b.file_url ?? null, text: String(b.text ?? "").slice(0, 12000), received_from: b.from ?? null } }];`,
    };

    @node({
        id: 'be6efcea-4980-4068-ab30-c0b58ec2b4e2',
        name: 'Extract the fields',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [520, 180],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ExtractTheFields = {
        method: 'POST',
        url: '={{ $env.LLM_BASE_URL }}/chat/completions',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.LLM_API_KEY }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: `={{ JSON.stringify({
  model: $env.LLM_MODEL,
  temperature: 0.2,
  response_format: { type: "json_object" },
  messages: [
    { role: "system", content: "[task:extract] Extract from this supplier invoice. Reply with JSON: { vendor: string, invoice_number: string, total: number, currency: string, due_date: 'YYYY-MM-DD', confidence: 0-1 }. Use null for anything not present. Do not guess." },
    { role: "user", content: $json.text }
  ]
}) }}`,
    };

    @node({
        id: 'd19b84c8-153d-4c12-a0ec-264645de9250',
        name: 'Read the fields',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [780, 180],
    })
    ReadTheFields = {
        jsCode: `const before = $("Read the upload").all();
const out = [];
for (const [i, item] of $input.all().entries()) {
  let reply = {"vendor":null,"invoice_number":null,"total":null,"confidence":0};
  let parse_error = false;
  try {
    reply = JSON.parse(item.json.choices[0].message.content);
  } catch (e) {
    parse_error = true;
  }
  out.push({ json: { ...(before[i]?.json ?? {}), ...reply, parse_error } });
}
return out;`,
    };

    @node({
        id: '92aa97fc-c57f-4b53-ae7f-ce0206030bf0',
        name: 'Seen this invoice?',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1040, 180],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SeenThisInvoice = {
        method: 'GET',
        url: '={{ $env.DB_BASE_URL }}/supplier_invoices',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.DB_API_KEY }}",
                },
            ],
        },
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'vendor',
                    value: "={{ 'eq.' + $json.vendor }}",
                },
                {
                    name: 'invoice_number',
                    value: "={{ 'eq.' + $json.invoice_number }}",
                },
            ],
        },
    };

    @node({
        id: '10a82e1d-ac43-4aa1-ae61-c8eff25bac77',
        name: 'Check it',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1300, 180],
    })
    CheckIt = {
        jsCode: `const f = $("Read the fields").first().json;
const duplicate = $input.all().some((i) => i.json.invoice_number);
const problems = [];
if (f.parse_error) problems.push("the model reply could not be read");
if (!f.vendor || !f.invoice_number) problems.push("vendor or invoice number missing");
if (typeof f.total !== "number" || !(f.total > 0)) problems.push("total is missing or not positive");
if (f.due_date && Number.isNaN(Date.parse(f.due_date))) problems.push("due date is not a date");
if ((f.confidence ?? 0) < 0.8) problems.push("low confidence (" + (f.confidence ?? 0) + ")");
if (duplicate) problems.push("an invoice with this number from this vendor already exists");
return [{ json: { ...f, duplicate, problems, ok: problems.length === 0 } }];`,
    };

    @node({
        id: '7ca9ce37-ace8-4cee-aeb4-4e3144e09c43',
        name: 'Clean?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1560, 180],
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
                    leftValue: '={{ $json.ok }}',
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
        id: 'cd45c33b-3b28-49ba-ae08-c9d3cc192e7f',
        name: 'File it',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1820, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    FileIt = {
        method: 'POST',
        url: '={{ $env.DB_BASE_URL }}/supplier_invoices',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.DB_API_KEY }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ vendor: $json.vendor, invoice_number: $json.invoice_number, total: $json.total, currency: $json.currency, due_date: $json.due_date, file_url: $json.file_url, status: 'awaiting_payment', at: $now.toISO() }) }}",
    };

    @node({
        id: 'c799b624-8903-400f-a667-8b17653a9225',
        name: 'Queue for review',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1820, 270],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    QueueForReview = {
        method: 'POST',
        url: '={{ $env.DB_BASE_URL }}/invoice_review',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.DB_API_KEY }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            '={{ JSON.stringify({ file_url: $json.file_url, extracted: { vendor: $json.vendor, invoice_number: $json.invoice_number, total: $json.total }, problems: $json.problems, at: $now.toISO() }) }}',
    };

    @node({
        id: '06b8e197-286b-4745-ae65-385155019379',
        name: 'Review message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2080, 180],
    })
    ReviewMessage = {
        jsCode: `const f = $("Clean?").first().json;
return [{ json: { channel: "#finance", level: "warn", text: "An invoice" + (f.vendor ? " from " + f.vendor : "") + " needs a manual check: " + f.problems.join("; ") + "." } }];`,
    };

    @node({
        id: '6d3870fe-3a81-410a-a75d-811f7a71ab28',
        name: 'Tell finance',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [2340, 180],
    })
    TellFinance = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.InvoiceReceived.out(0).to(this.ReadTheUpload.in(0));
        this.ReadTheUpload.out(0).to(this.ExtractTheFields.in(0));
        this.ExtractTheFields.out(0).to(this.ReadTheFields.in(0));
        this.ReadTheFields.out(0).to(this.SeenThisInvoice.in(0));
        this.SeenThisInvoice.out(0).to(this.CheckIt.in(0));
        this.CheckIt.out(0).to(this.Clean.in(0));
        this.Clean.out(0).to(this.FileIt.in(0));
        this.Clean.out(1).to(this.QueueForReview.in(0));
        this.QueueForReview.out(0).to(this.ReviewMessage.in(0));
        this.ReviewMessage.out(0).to(this.TellFinance.in(0));
    }
}
