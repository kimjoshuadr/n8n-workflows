import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Payments · Event ledger
// Nodes   : 17  |  Connections: 17
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// PaymentEvent                       stripeTrigger              [creds]
// ReadTheEvent                       code
// SeenBefore                         executeWorkflow
// NewEvent                           if
// AlreadyRecorded                    noOp
// WhichEvent                         switch
// LedgerCredit                       supabase                   [creds] [retry]
// MarkInvoicePaid                    supabase                   [creds] [alwaysOutput] [retry]
// SendReceipt                        sendGrid                   [onError→regular] [creds] [retry]
// MarkInvoiceFailed                  supabase                   [creds] [alwaysOutput] [retry]
// AskToUpdateCard                    sendGrid                   [onError→regular] [creds] [retry]
// LedgerDebit                        supabase                   [creds] [retry]
// RefundMessage                      code
// TellFinance                        executeWorkflow
// Recorded                           noOp
// NotHandled                         noOp
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// PaymentEvent
//    → ReadTheEvent
//      → SeenBefore
//        → NewEvent
//          → WhichEvent
//            → LedgerCredit
//              → MarkInvoicePaid
//                → SendReceipt
//                  → Recorded
//           .out(1) → MarkInvoiceFailed
//              → AskToUpdateCard
//                → Recorded (↩ loop)
//           .out(2) → LedgerDebit
//              → RefundMessage
//                → TellFinance
//                  → Recorded (↩ loop)
//           .out(3) → NotHandled
//         .out(1) → AlreadyRecorded
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

**Platforms:** Stripe, Supabase, SendGrid
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/payments\``,
    };

    @node({
        id: '1df99ca6-66d9-4b26-aea8-189f0cd074b0',
        webhookId: 'd1431833-bf16-4589-adf9-cba3c692591e',
        name: 'Payment event',
        type: 'n8n-nodes-base.stripeTrigger',
        version: 1,
        position: [0, 360],
        credentials: { stripeApi: { id: '__CRED:stripe__', name: 'Stripe' } },
    })
    PaymentEvent = {
        events: ['payment_intent.succeeded', 'payment_intent.payment_failed', 'charge.refunded'],
    };

    @node({
        id: '4539a812-c446-4942-a270-b7c15a47ff83',
        name: 'Read the event',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 360],
    })
    ReadTheEvent = {
        jsCode: `const e = $("Payment event").first().json ?? {};
const o = e.data?.object ?? {};
if (!e.id || !e.type) throw new Error("Event has no id or type");
return [{ json: { event_id: String(e.id), type: e.type, amount: Number(o.amount ?? 0) / 100, currency: String(o.currency ?? "usd").toUpperCase(), invoice_id: o.metadata?.invoice_id ?? null, email: o.receipt_email ?? o.billing_details?.email ?? null, charge_id: o.id ?? null, scope: "payment-event", key: String(e.id) } }];`,
    };

    @node({
        id: 'ebc81471-1db2-4394-a815-bae534df600a',
        name: 'Seen before?',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [520, 360],
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
        position: [780, 360],
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
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1040, 270],
    })
    AlreadyRecorded = {};

    @node({
        id: '1966f55f-e626-400b-ae31-bb0aa2206e22',
        name: 'Which event?',
        type: 'n8n-nodes-base.switch',
        version: 3.2,
        position: [1040, 450],
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
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1300, 90],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LedgerCredit = {
        resource: 'row',
        operation: 'create',
        tableId: 'ledger',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'event_id',
                    fieldValue: '={{ $json.event_id }}',
                },
                {
                    fieldId: 'charge_id',
                    fieldValue: '={{ $json.charge_id }}',
                },
                {
                    fieldId: 'kind',
                    fieldValue: "={{ 'payment' }}",
                },
                {
                    fieldId: 'amount',
                    fieldValue: '={{ $json.amount }}',
                },
                {
                    fieldId: 'currency',
                    fieldValue: '={{ $json.currency }}',
                },
                {
                    fieldId: 'invoice_id',
                    fieldValue: '={{ $json.invoice_id }}',
                },
                {
                    fieldId: 'at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: 'f343455c-2f7f-4ea6-aaba-a32a138c091e',
        name: 'Mark invoice paid',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1560, 180],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MarkInvoicePaid = {
        resource: 'row',
        operation: 'update',
        tableId: 'invoices',
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'id',
                    condition: 'eq',
                    keyValue: "={{ $('New event?').first().json.invoice_id }}",
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
                    fieldId: 'paid_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: 'a8298417-a3e1-4ed4-a69d-0b8b14778a60',
        name: 'Send receipt',
        type: 'n8n-nodes-base.sendGrid',
        version: 1,
        position: [1820, 270],
        credentials: { sendGridApi: { id: '__CRED:sendgrid__', name: 'SendGrid' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendReceipt = {
        resource: 'mail',
        operation: 'send',
        fromEmail: "={{ 'hello@example.com' }}",
        fromName: "={{ 'Acme' }}",
        toEmail: "={{ $('New event?').first().json.email }}",
        dynamicTemplate: true,
        templateId: "={{ 'd-receipt' }}",
        dynamicTemplateFields: {
            fields: [
                {
                    key: 'amount',
                    value: "={{ $('New event?').first().json.amount }}",
                },
                {
                    key: 'currency',
                    value: "={{ $('New event?').first().json.currency }}",
                },
            ],
        },
        additionalFields: {},
    };

    @node({
        id: 'dbedd1fe-a271-4e26-a00e-8491961b1ca4',
        name: 'Mark invoice failed',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1300, 270],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MarkInvoiceFailed = {
        resource: 'row',
        operation: 'update',
        tableId: 'invoices',
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'id',
                    condition: 'eq',
                    keyValue: '={{ $json.invoice_id }}',
                },
            ],
        },
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'status',
                    fieldValue: "={{ 'payment_failed' }}",
                },
                {
                    fieldId: 'last_failure_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '3f2ddc1e-027a-4dc4-a942-cdbf726e81b4',
        name: 'Ask to update card',
        type: 'n8n-nodes-base.sendGrid',
        version: 1,
        position: [1560, 360],
        credentials: { sendGridApi: { id: '__CRED:sendgrid__', name: 'SendGrid' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    AskToUpdateCard = {
        resource: 'mail',
        operation: 'send',
        fromEmail: "={{ 'hello@example.com' }}",
        fromName: "={{ 'Acme' }}",
        toEmail: "={{ $('New event?').first().json.email }}",
        dynamicTemplate: true,
        templateId: "={{ 'd-payment-failed' }}",
        dynamicTemplateFields: {
            fields: [
                {
                    key: 'amount',
                    value: "={{ $('New event?').first().json.amount }}",
                },
            ],
        },
        additionalFields: {},
    };

    @node({
        id: 'e27e0fc7-9cbc-4f4a-a7a2-f777829d441b',
        name: 'Ledger: debit',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1300, 450],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LedgerDebit = {
        resource: 'row',
        operation: 'create',
        tableId: 'ledger',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'event_id',
                    fieldValue: '={{ $json.event_id }}',
                },
                {
                    fieldId: 'charge_id',
                    fieldValue: '={{ $json.charge_id }}',
                },
                {
                    fieldId: 'kind',
                    fieldValue: "={{ 'refund' }}",
                },
                {
                    fieldId: 'amount',
                    fieldValue: '={{ -$json.amount }}',
                },
                {
                    fieldId: 'currency',
                    fieldValue: '={{ $json.currency }}',
                },
                {
                    fieldId: 'invoice_id',
                    fieldValue: '={{ $json.invoice_id }}',
                },
                {
                    fieldId: 'at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: 'd01584a2-0199-4844-ad1c-2591a1bc229b',
        name: 'Refund message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1560, 540],
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
        position: [1820, 450],
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
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [2080, 360],
    })
    Recorded = {};

    @node({
        id: 'ab6cbdf4-0e54-4b36-a3d6-e381a671e42a',
        name: 'Not handled',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1300, 630],
    })
    NotHandled = {};

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.PaymentEvent.out(0).to(this.ReadTheEvent.in(0));
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
