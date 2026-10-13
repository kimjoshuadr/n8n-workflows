import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Payments · Refund requests
// Nodes   : 19  |  Connections: 17
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// RefundRequested                    webhook
// ReadTheRequest                     code
// Valid                              if
// Invalid                            respondToWebhook
// LoadTheOrder                       httpRequest                [alwaysOutput] [retry]
// OrderFound                         if
// UnknownOrder                       respondToWebhook
// PastRefunds                        httpRequest                [alwaysOutput] [retry]
// ApplyThePolicy                     code
// Decision                           switch
// AlreadyRefunded                    respondToWebhook
// RefundAtTheProcessor               httpRequest                [retry]
// RecordTheRefund                    httpRequest                [retry]
// MarkTheOrder                       httpRequest                [retry]
// Refunded                           respondToWebhook
// ReviewMessage                      code
// AskFinance                         executeWorkflow
// UnderReview                        respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// RefundRequested
//    → ReadTheRequest
//      → Valid
//        → LoadTheOrder
//          → OrderFound
//            → PastRefunds
//              → ApplyThePolicy
//                → Decision
//                  → AlreadyRefunded
//                 .out(1) → RefundAtTheProcessor
//                    → RecordTheRefund
//                      → MarkTheOrder
//                        → Refunded
//                 .out(2) → ReviewMessage
//                    → AskFinance
//                      → UnderReview
//           .out(1) → UnknownOrder
//       .out(1) → Invalid
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Payments · Refund requests',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class PaymentsRefundRequestsWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '00913755-5954-42c7-a078-519cb4fa733b',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Payments · Refund requests
Refunds small amounts on recent orders automatically, and sends anything larger, older or repeated to a person with the facts attached.

**Platforms:** none, this is logic only
**Settings:** DB_API_KEY, DB_BASE_URL, PAYMENTS_API_KEY, PAYMENTS_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`workflows/commerce\``,
    };

    @node({
        id: '7fd7f990-cc1e-41db-a29b-aa29ee3a4832',
        webhookId: '27719aa1-d7f8-4504-a019-dc67846cf6e1',
        name: 'Refund requested',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 270],
    })
    RefundRequested = {
        httpMethod: 'POST',
        path: 'refund-request',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        id: 'fbea3a51-881e-454e-ab6b-09a5885c815e',
        name: 'Read the request',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 270],
    })
    ReadTheRequest = {
        jsCode: `const b = $input.first().json.body ?? {};
return [{ json: { order_id: String(b.order_id ?? ""), reason: String(b.reason ?? "").slice(0, 500), valid: !!b.order_id } }];`,
    };

    @node({
        id: '8e554982-1e8c-444e-af1e-2a3180d59aab',
        name: 'Valid?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [520, 270],
    })
    Valid = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '8ba548b6-353c-474e-a581-189fba03a955',
                    leftValue: '={{ $json.valid }}',
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
        id: 'f1226abd-4556-4995-a264-87b282849c8d',
        name: 'Invalid',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [780, 180],
    })
    Invalid = {
        respondWith: 'json',
        responseBody: "={{ JSON.stringify({ ok: false, error: 'order_id is required' }) }}",
        options: {
            responseCode: 400,
        },
    };

    @node({
        id: '6398f882-6201-40a1-a1ec-914c2274ef81',
        name: 'Load the order',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [780, 360],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LoadTheOrder = {
        method: 'GET',
        url: '={{ $env.DB_BASE_URL }}/orders',
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
                    name: 'order_id',
                    value: "={{ 'eq.' + $json.order_id }}",
                },
            ],
        },
    };

    @node({
        id: '962f37e7-43a1-417e-afc0-7a1dc7ff8c10',
        name: 'Order found?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1040, 270],
    })
    OrderFound = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'f6953e36-bbca-46f5-aebc-bbf8bd46ebcb',
                    leftValue: '={{ !!$json.order_id }}',
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
        id: 'ce1b18cb-650b-421d-a601-768ca4c5142a',
        name: 'Unknown order',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [1300, 180],
    })
    UnknownOrder = {
        respondWith: 'json',
        responseBody: "={{ JSON.stringify({ ok: false, error: 'Order not found' }) }}",
        options: {
            responseCode: 404,
        },
    };

    @node({
        id: '165d585a-b746-4539-a49c-4c591a7e7a98',
        name: 'Past refunds',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1300, 360],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PastRefunds = {
        method: 'GET',
        url: '={{ $env.DB_BASE_URL }}/refunds',
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
                    name: 'email',
                    value: "={{ 'eq.' + $json.email }}",
                },
            ],
        },
    };

    @node({
        id: 'f7db93bf-aaff-413f-acb0-714c5ee658d5',
        name: 'Apply the policy',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1560, 270],
    })
    ApplyThePolicy = {
        jsCode: `const o = $("Order found?").first().json;
const past = $input.all().map((i) => i.json).filter((r) => r.email);
const ageDays = (Date.now() - new Date(o.created_at).getTime()) / 864e5;
const reasons = [];
if (o.status === "refunded") reasons.push("already refunded");
if (Number(o.total) > 100) reasons.push("over the 100 auto-refund limit");
if (ageDays > 30) reasons.push("order is older than 30 days");
if (past.length >= 2) reasons.push("third refund for this customer");
return [{ json: { order_id: o.order_id, email: o.email, amount: Number(o.total), charge_id: o.charge_id ?? null, auto: reasons.length === 0, already: o.status === "refunded", reasons, request_reason: $("Read the request").first().json.reason } }];`,
    };

    @node({
        id: '9b43df5f-9418-4d50-abda-43e9c88511f8',
        name: 'Decision',
        type: 'n8n-nodes-base.switch',
        version: 3.2,
        position: [1820, 270],
    })
    Decision = {
        rules: {
            values: [
                {
                    conditions: {
                        options: {
                            caseSensitive: true,
                            leftValue: '',
                            typeValidation: 'loose',
                            version: 2,
                        },
                        conditions: [
                            {
                                id: '439569eb-8b35-4ea4-afa5-0c19562a4a04',
                                leftValue: '={{ $json.already }}',
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
                    renameOutput: true,
                    outputKey: 'already',
                },
                {
                    conditions: {
                        options: {
                            caseSensitive: true,
                            leftValue: '',
                            typeValidation: 'loose',
                            version: 2,
                        },
                        conditions: [
                            {
                                id: 'a206d327-f40f-47d4-a1c1-6a4558bed3c2',
                                leftValue: '={{ $json.auto }}',
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
                    renameOutput: true,
                    outputKey: 'auto',
                },
            ],
        },
        options: {
            fallbackOutput: 'extra',
        },
    };

    @node({
        id: '89727790-60c7-43dc-a7d0-cc877fe0ca7f',
        name: 'Already refunded',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [2080, 90],
    })
    AlreadyRefunded = {
        respondWith: 'json',
        responseBody: "={{ JSON.stringify({ ok: true, status: 'already_refunded' }) }}",
        options: {
            responseCode: 200,
        },
    };

    @node({
        id: '08dc9c47-152b-436c-ae18-e450884688a8',
        name: 'Refund at the processor',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [2080, 270],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    RefundAtTheProcessor = {
        method: 'POST',
        url: '={{ $env.PAYMENTS_BASE_URL }}/refunds',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.PAYMENTS_API_KEY }}",
                },
                {
                    name: 'Idempotency-Key',
                    value: "={{ 'refund-' + $json.order_id }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ charge: $json.charge_id, amount: Math.round($json.amount * 100) }) }}',
    };

    @node({
        id: '96cf1058-4f1e-43e4-a62b-b17d9a28d5fd',
        name: 'Record the refund',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [2340, 180],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    RecordTheRefund = {
        method: 'POST',
        url: '={{ $env.DB_BASE_URL }}/refunds',
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
            "={{ JSON.stringify({ order_id: $('Decision').first().json.order_id, email: $('Decision').first().json.email, amount: $('Decision').first().json.amount, auto: true, at: $now.toISO() }) }}",
    };

    @node({
        id: 'aa509920-8bdf-4c3c-ac51-af0894d62c6b',
        name: 'Mark the order',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [2600, 180],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MarkTheOrder = {
        method: 'PATCH',
        url: '={{ $env.DB_BASE_URL }}/orders',
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
                    name: 'order_id',
                    value: "={{ 'eq.' + $('Decision').first().json.order_id }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: "={{ JSON.stringify({ status: 'refunded' }) }}",
    };

    @node({
        id: '9a0c31a9-5445-4e24-a40d-cd0aa479ad31',
        name: 'Refunded',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [2860, 270],
    })
    Refunded = {
        respondWith: 'json',
        responseBody: "={{ JSON.stringify({ ok: true, status: 'refunded' }) }}",
        options: {
            responseCode: 200,
        },
    };

    @node({
        id: '42660ce5-9634-4d36-aaf8-c4d9ca989c08',
        name: 'Review message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2080, 450],
    })
    ReviewMessage = {
        jsCode: `const d = $input.first().json;
return [{ json: { channel: "#finance", level: "warn", text: "Refund request for order " + d.order_id + " (" + d.amount + ", " + d.email + ") needs a decision: " + d.reasons.join(", ") + ". Customer says: \\"" + d.request_reason + "\\"" } }];`,
    };

    @node({
        id: 'f7ced98e-c1f1-4e1a-aee6-354c0662d828',
        name: 'Ask finance',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [2340, 360],
    })
    AskFinance = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    @node({
        id: '2b46bc9c-a009-4ea3-abe8-3ef9244d47ae',
        name: 'Under review',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [2600, 360],
    })
    UnderReview = {
        respondWith: 'json',
        responseBody: "={{ JSON.stringify({ ok: true, status: 'under_review' }) }}",
        options: {
            responseCode: 200,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.RefundRequested.out(0).to(this.ReadTheRequest.in(0));
        this.ReadTheRequest.out(0).to(this.Valid.in(0));
        this.Valid.out(0).to(this.LoadTheOrder.in(0));
        this.Valid.out(1).to(this.Invalid.in(0));
        this.LoadTheOrder.out(0).to(this.OrderFound.in(0));
        this.OrderFound.out(0).to(this.PastRefunds.in(0));
        this.OrderFound.out(1).to(this.UnknownOrder.in(0));
        this.PastRefunds.out(0).to(this.ApplyThePolicy.in(0));
        this.ApplyThePolicy.out(0).to(this.Decision.in(0));
        this.Decision.out(0).to(this.AlreadyRefunded.in(0));
        this.Decision.out(1).to(this.RefundAtTheProcessor.in(0));
        this.Decision.out(2).to(this.ReviewMessage.in(0));
        this.RefundAtTheProcessor.out(0).to(this.RecordTheRefund.in(0));
        this.RecordTheRefund.out(0).to(this.MarkTheOrder.in(0));
        this.MarkTheOrder.out(0).to(this.Refunded.in(0));
        this.ReviewMessage.out(0).to(this.AskFinance.in(0));
        this.AskFinance.out(0).to(this.UnderReview.in(0));
    }
}
