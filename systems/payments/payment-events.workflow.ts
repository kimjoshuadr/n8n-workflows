import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Payments · Event ledger
// Nodes   : 19  |  Connections: 19
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// PaymentEvent                       webhook
// Signed                             if
// Unauthorised                       respondToWebhook
// ReadTheEvent                       code
// SeenBefore                         executeWorkflow
// NewEvent                           if
// AlreadyRecorded                    respondToWebhook
// WhichEvent                         switch
// LedgerCredit                       httpRequest                [retry]
// MarkInvoicePaid                    httpRequest                [alwaysOutput] [retry]
// SendReceipt                        httpRequest                [onError→regular] [retry]
// MarkInvoiceFailed                  httpRequest                [alwaysOutput] [retry]
// AskToUpdateCard                    httpRequest                [onError→regular] [retry]
// LedgerDebit                        httpRequest                [retry]
// RefundMessage                      code
// TellFinance                        executeWorkflow
// Recorded                           respondToWebhook
// NotHandled                         respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// PaymentEvent
//    → Signed
//      → ReadTheEvent
//        → SeenBefore
//          → NewEvent
//            → WhichEvent
//              → LedgerCredit
//                → MarkInvoicePaid
//                  → SendReceipt
//                    → Recorded
//             .out(1) → MarkInvoiceFailed
//                → AskToUpdateCard
//                  → Recorded (↩ loop)
//             .out(2) → LedgerDebit
//                → RefundMessage
//                  → TellFinance
//                    → Recorded (↩ loop)
//             .out(3) → NotHandled
//           .out(1) → AlreadyRecorded
//     .out(1) → Unauthorised
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Payments · Event ledger',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class PaymentsEventLedgerWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'c1f6502e-fdfb-47ed-a4ba-3af6e117ecad',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Payments · Event ledger
Records each payment, failure and refund from the processor exactly once, updates the invoice, and sends the receipt or the retry notice.

**Platforms:** none, this is logic only
**Settings:** DB_API_KEY, DB_BASE_URL, EMAIL_API_KEY, EMAIL_BASE_URL, PAYMENTS_WEBHOOK_SECRET
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/payments\``,
    };

    @node({
        id: '1df99ca6-66d9-4b26-aea8-189f0cd074b0',
        webhookId: 'daf11e40-9a91-48af-af82-c2485782af2d',
        name: 'Payment event',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 360],
    })
    PaymentEvent = {
        httpMethod: 'POST',
        path: 'payment-event',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        id: 'b999fdca-a584-4416-a8ae-253d6192da13',
        name: 'Signed?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [260, 360],
    })
    Signed = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '3b98ad77-7366-49b1-a86c-8bdb20d41ed2',
                    leftValue: "={{ $json.headers['x-webhook-secret'] === $env.PAYMENTS_WEBHOOK_SECRET }}",
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
        id: 'ddba1875-6030-497e-a8df-19bf02596182',
        name: 'Unauthorised',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [520, 270],
    })
    Unauthorised = {
        respondWith: 'json',
        responseBody: '={{ JSON.stringify({ ok: false }) }}',
        options: {
            responseCode: 401,
        },
    };

    @node({
        id: '4539a812-c446-4942-a270-b7c15a47ff83',
        name: 'Read the event',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, 450],
    })
    ReadTheEvent = {
        jsCode: `const e = $("Payment event").first().json.body ?? {};
const o = e.data?.object ?? {};
if (!e.id || !e.type) throw new Error("Event has no id or type");
return [{ json: { event_id: String(e.id), type: e.type, amount: Number(o.amount ?? 0) / 100, currency: String(o.currency ?? "usd").toUpperCase(), invoice_id: o.metadata?.invoice_id ?? null, email: o.receipt_email ?? o.billing_details?.email ?? null, charge_id: o.id ?? null, scope: "payment-event", key: String(e.id) } }];`,
    };

    @node({
        id: 'ebc81471-1db2-4394-a815-bae534df600a',
        name: 'Seen before?',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [780, 360],
    })
    SeenBefore = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:idempotency-guard__',
        },
        options: {},
    };

    @node({
        id: '5c36a794-32fe-49a9-a724-5d7e589dd195',
        name: 'New event?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1040, 360],
    })
    NewEvent = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'f1c64d35-a071-4dd0-a620-f335ac2939dd',
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
        id: '6abd1e57-5047-411a-ac51-92fba181d15c',
        name: 'Already recorded',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [1300, 270],
    })
    AlreadyRecorded = {
        respondWith: 'json',
        responseBody: '={{ JSON.stringify({ ok: true, duplicate: true }) }}',
        options: {
            responseCode: 200,
        },
    };

    @node({
        id: '1966f55f-e626-400b-ae31-bb0aa2206e22',
        name: 'Which event?',
        type: 'n8n-nodes-base.switch',
        version: 3.2,
        position: [1300, 450],
    })
    WhichEvent = {
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
                                id: '55ae4cd3-3995-498a-a977-17f508376709',
                                leftValue: "={{ $json.type === 'payment_intent.succeeded' }}",
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
                    outputKey: 'paid',
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
                                id: '02077640-3da2-4e87-a52b-07ac0a067a19',
                                leftValue: "={{ $json.type === 'payment_intent.payment_failed' }}",
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
                    outputKey: 'failed',
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
                                id: '84f36773-5325-4f6a-a297-f6543f289338',
                                leftValue: "={{ $json.type === 'charge.refunded' }}",
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
                    outputKey: 'refunded',
                },
            ],
        },
        options: {
            fallbackOutput: 'extra',
        },
    };

    @node({
        id: '793f844b-66d0-474d-a389-030d836d2a3d',
        name: 'Ledger: credit',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1560, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LedgerCredit = {
        method: 'POST',
        url: '={{ $env.DB_BASE_URL }}/ledger',
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
            "={{ JSON.stringify({ event_id: $json.event_id, charge_id: $json.charge_id, kind: 'payment', amount: $json.amount, currency: $json.currency, invoice_id: $json.invoice_id, at: $now.toISO() }) }}",
    };

    @node({
        id: 'f343455c-2f7f-4ea6-aaba-a32a138c091e',
        name: 'Mark invoice paid',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1820, 180],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MarkInvoicePaid = {
        method: 'PATCH',
        url: '={{ $env.DB_BASE_URL }}/invoices',
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
                    name: 'id',
                    value: "={{ 'eq.' + $('New event?').first().json.invoice_id }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: "={{ JSON.stringify({ status: 'paid', paid_at: $now.toISO() }) }}",
    };

    @node({
        id: 'a8298417-a3e1-4ed4-a69d-0b8b14778a60',
        name: 'Send receipt',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [2080, 270],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendReceipt = {
        method: 'POST',
        url: '={{ $env.EMAIL_BASE_URL }}/emails',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.EMAIL_API_KEY }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ to: $('New event?').first().json.email, subject: 'Receipt for your payment', template: 'receipt', data: { amount: $('New event?').first().json.amount, currency: $('New event?').first().json.currency } }) }}",
    };

    @node({
        id: 'dbedd1fe-a271-4e26-a00e-8491961b1ca4',
        name: 'Mark invoice failed',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1560, 270],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MarkInvoiceFailed = {
        method: 'PATCH',
        url: '={{ $env.DB_BASE_URL }}/invoices',
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
                    name: 'id',
                    value: "={{ 'eq.' + $json.invoice_id }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: "={{ JSON.stringify({ status: 'payment_failed', last_failure_at: $now.toISO() }) }}",
    };

    @node({
        id: '3f2ddc1e-027a-4dc4-a942-cdbf726e81b4',
        name: 'Ask to update card',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1820, 360],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    AskToUpdateCard = {
        method: 'POST',
        url: '={{ $env.EMAIL_BASE_URL }}/emails',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.EMAIL_API_KEY }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ to: $('New event?').first().json.email, subject: 'Your payment did not go through', template: 'payment-failed', data: { amount: $('New event?').first().json.amount } }) }}",
    };

    @node({
        id: 'e27e0fc7-9cbc-4f4a-a7a2-f777829d441b',
        name: 'Ledger: debit',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1560, 450],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LedgerDebit = {
        method: 'POST',
        url: '={{ $env.DB_BASE_URL }}/ledger',
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
            "={{ JSON.stringify({ event_id: $json.event_id, charge_id: $json.charge_id, kind: 'refund', amount: -$json.amount, currency: $json.currency, invoice_id: $json.invoice_id, at: $now.toISO() }) }}",
    };

    @node({
        id: 'd01584a2-0199-4844-ad1c-2591a1bc229b',
        name: 'Refund message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1820, 540],
    })
    RefundMessage = {
        jsCode: `const e = $("New event?").first().json;
return [{ json: { text: "Refund of " + e.amount + " " + e.currency + " recorded for " + (e.email ?? "an unknown customer") + ".", level: "info" } }];`,
    };

    @node({
        id: '881191cb-1b22-4e06-a381-ed5bf819a420',
        name: 'Tell finance',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [2080, 450],
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
        id: 'e8d852ed-f906-4f64-a6d1-ac42ab5b6e10',
        name: 'Recorded',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [2340, 360],
    })
    Recorded = {
        respondWith: 'json',
        responseBody: '={{ JSON.stringify({ ok: true }) }}',
        options: {
            responseCode: 200,
        },
    };

    @node({
        id: 'ab6cbdf4-0e54-4b36-a3d6-e381a671e42a',
        name: 'Not handled',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [1560, 630],
    })
    NotHandled = {
        respondWith: 'json',
        responseBody: '={{ JSON.stringify({ ok: true, ignored: true }) }}',
        options: {
            responseCode: 200,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.PaymentEvent.out(0).to(this.Signed.in(0));
        this.Signed.out(0).to(this.ReadTheEvent.in(0));
        this.Signed.out(1).to(this.Unauthorised.in(0));
        this.ReadTheEvent.out(0).to(this.SeenBefore.in(0));
        this.SeenBefore.out(0).to(this.NewEvent.in(0));
        this.NewEvent.out(0).to(this.WhichEvent.in(0));
        this.NewEvent.out(1).to(this.AlreadyRecorded.in(0));
        this.WhichEvent.out(0).to(this.LedgerCredit.in(0));
        this.WhichEvent.out(1).to(this.MarkInvoiceFailed.in(0));
        this.WhichEvent.out(2).to(this.LedgerDebit.in(0));
        this.WhichEvent.out(3).to(this.NotHandled.in(0));
        this.LedgerCredit.out(0).to(this.MarkInvoicePaid.in(0));
        this.MarkInvoicePaid.out(0).to(this.SendReceipt.in(0));
        this.SendReceipt.out(0).to(this.Recorded.in(0));
        this.MarkInvoiceFailed.out(0).to(this.AskToUpdateCard.in(0));
        this.AskToUpdateCard.out(0).to(this.Recorded.in(0));
        this.LedgerDebit.out(0).to(this.RefundMessage.in(0));
        this.RefundMessage.out(0).to(this.TellFinance.in(0));
        this.TellFinance.out(0).to(this.Recorded.in(0));
    }
}
