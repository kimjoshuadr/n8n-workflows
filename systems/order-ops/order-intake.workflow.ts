import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Order ops · New order
// Nodes   : 18  |  Connections: 16
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// OrderCreated                       webhook
// FromTheStore                       if
// Unauthorised                       respondToWebhook
// Received                           respondToWebhook
// ReadTheOrder                       code
// SeenBefore                         executeWorkflow
// NewOrder                           if
// AlreadyHandled                     noOp
// SaveTheOrder                       httpRequest                [retry]
// OneItemPerLine                     code
// TakeFromStock                      httpRequest                [onError→out(1)] [retry]
// WhatIsRunningLow                   code
// AnythingLow                        if
// WarnTheTeam                        executeWorkflow
// ConfirmToCustomer                  httpRequest                [retry]
// StockFailurePayload                code
// ParkForReplay                      executeWorkflow
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// OrderCreated
//    → FromTheStore
//      → Received
//        → ReadTheOrder
//          → SeenBefore
//            → NewOrder
//              → SaveTheOrder
//                → OneItemPerLine
//                  → TakeFromStock
//                    → WhatIsRunningLow
//                      → AnythingLow
//                        → WarnTheTeam
//                   .out(1) → StockFailurePayload
//                      → ParkForReplay
//                → ConfirmToCustomer
//             .out(1) → AlreadyHandled
//     .out(1) → Unauthorised
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Order ops · New order',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class OrderOpsNewOrderWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '61f98cfa-6899-42ea-ae54-c2b6386cf5e0',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-40, -390],
    })
    AboutThisWorkflow = {
        width: 620,
        height: 220,
        content: `## Order ops · New order
Takes a new order from the store, records it once, takes its items out of stock, confirms to the customer, and warns the team about anything running low.

**Needs:** DB_API_KEY, DB_BASE_URL, EMAIL_API_KEY, EMAIL_BASE_URL, SHOP_API_KEY, SHOP_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/order-ops\``,
    };

    @node({
        id: '4912eeaa-972c-4c81-abc2-f564361e5215',
        webhookId: '03427abe-6365-492a-a7ce-ab3daf2128ed',
        name: 'Order created',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 0],
    })
    OrderCreated = {
        httpMethod: 'POST',
        path: 'order-created',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        id: 'ffb10e7f-4bdd-4a22-a901-37129cfe791b',
        name: 'From the store?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [240, 0],
    })
    FromTheStore = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'fbc14570-bfc3-439e-a0db-82ba8a508c23',
                    leftValue: "={{ $json.headers['x-webhook-secret'] === $env.SHOP_API_KEY }}",
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
        id: 'acdfd98a-2bec-47f4-a79c-818cabc96e9e',
        name: 'Unauthorised',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [480, -90],
    })
    Unauthorised = {
        respondWith: 'json',
        responseBody: '={{ JSON.stringify({ ok: false }) }}',
        options: {
            responseCode: 401,
        },
    };

    @node({
        id: '0bbefa30-9fa8-4379-aaef-79ed7104eb31',
        name: 'Received',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [480, 90],
    })
    Received = {
        respondWith: 'json',
        responseBody: '={{ JSON.stringify({ ok: true }) }}',
        options: {
            responseCode: 200,
        },
    };

    @node({
        id: '412e6bc2-f528-496a-a29c-f6ad22f9639f',
        name: 'Read the order',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [720, 0],
    })
    ReadTheOrder = {
        jsCode: `const o = $("Order created").first().json.body ?? {};
const lines = (o.line_items ?? []).map((l) => ({ sku: String(l.sku), title: l.title, quantity: Number(l.quantity ?? 1), price: Number(l.price ?? 0) }));
if (!o.id || !lines.length) throw new Error("Order has no id or no line items");
return [{ json: { order_id: String(o.id), email: String(o.email ?? "").toLowerCase(), customer: o.customer?.first_name ?? "there", currency: o.currency ?? "USD", total: lines.reduce((s, l) => s + l.price * l.quantity, 0), lines, scope: "order", key: String(o.id) } }];`,
    };

    @node({
        id: 'fbdbb6e8-80be-47db-a1ca-d73cc6e69219',
        name: 'Seen before?',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [960, 0],
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
        id: 'd373d0f6-019d-4fe9-ad72-b5c0c6fce154',
        name: 'New order?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1200, 0],
    })
    NewOrder = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '329a3aa1-9117-4f22-a02c-8bc23c2ad92b',
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
        id: 'ac0b0063-a396-4721-ae59-bdfe7a64f22b',
        name: 'Already handled',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1440, -90],
    })
    AlreadyHandled = {};

    @node({
        id: 'aef03a4a-86e2-4430-a437-6db3c673ce6c',
        name: 'Save the order',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1440, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SaveTheOrder = {
        method: 'POST',
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
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ order_id: $json.order_id, email: $json.email, total: $json.total, currency: $json.currency, lines: $json.lines, status: 'paid', created_at: $now.toISO() }) }}",
    };

    @node({
        id: '4f2935f7-e7e4-4c8b-a0cf-64b2f5a6883a',
        name: 'One item per line',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1680, -90],
    })
    OneItemPerLine = {
        jsCode: 'return $("New order?").first().json.lines.map((l) => ({ json: { ...l, order_id: $("New order?").first().json.order_id } }));',
    };

    @node({
        id: 'fffc4284-4dee-4e19-a621-58d9e1b9e7bd',
        name: 'Take from stock',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1920, 0],
        onError: 'continueErrorOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    TakeFromStock = {
        method: 'POST',
        url: '={{ $env.SHOP_BASE_URL }}/inventory_levels/adjust',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.SHOP_API_KEY }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ sku: $json.sku, available_adjustment: -$json.quantity }) }}',
    };

    @node({
        id: '7e13d170-9ffb-402a-a058-fe6e355013da',
        name: 'What is running low?',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2160, -90],
    })
    WhatIsRunningLow = {
        jsCode: `const lines = $("One item per line").all();
const low = $input.all().map((item, i) => ({ sku: lines[i]?.json.sku, title: lines[i]?.json.title, available: item.json.available }))
  .filter((l) => typeof l.available === "number" && l.available <= 5);
return [{ json: { low, any_low: low.length > 0, text: "Running low: " + low.map((l) => l.title + " (" + l.available + " left)").join(", "), level: "warn" } }];`,
    };

    @node({
        id: '009ffea0-ce7e-4e68-abf4-8f0aa7d3c022',
        name: 'Anything low?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [2400, -90],
    })
    AnythingLow = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'f07e346e-e9ed-448c-a80d-c71f3546b380',
                    leftValue: '={{ $json.any_low }}',
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
        id: 'ec573f0a-d530-455d-ab22-68d2bc56d010',
        name: 'Warn the team',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [2640, 0],
    })
    WarnTheTeam = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    @node({
        id: '991c63e2-d785-4358-ad19-0d208e3a6370',
        name: 'Confirm to customer',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1680, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ConfirmToCustomer = {
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
            "={{ JSON.stringify({ to: $('New order?').first().json.email, subject: 'Order ' + $('New order?').first().json.order_id + ' confirmed', template: 'order-confirmation', data: { name: $('New order?').first().json.customer, lines: $('New order?').first().json.lines, total: $('New order?').first().json.total } }) }}",
    };

    @node({
        id: '45c11ce1-b33f-41de-a7cc-f7d4587fb60c',
        name: 'Stock failure payload',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2160, 90],
    })
    StockFailurePayload = {
        jsCode: `const l = $input.first().json;
return [{ json: { source: "order-intake", reason: "Stock could not be adjusted for an order line", payload: { order_id: $("New order?").first().json.order_id, lines: $("New order?").first().json.lines } } }];`,
    };

    @node({
        id: '574b9e51-0991-40fe-ab59-8e18023544d7',
        name: 'Park for replay',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [2400, 90],
    })
    ParkForReplay = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:dead-letter__',
        },
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.OrderCreated.out(0).to(this.FromTheStore.in(0));
        this.FromTheStore.out(0).to(this.Received.in(0));
        this.FromTheStore.out(1).to(this.Unauthorised.in(0));
        this.Received.out(0).to(this.ReadTheOrder.in(0));
        this.ReadTheOrder.out(0).to(this.SeenBefore.in(0));
        this.SeenBefore.out(0).to(this.NewOrder.in(0));
        this.NewOrder.out(0).to(this.SaveTheOrder.in(0));
        this.NewOrder.out(1).to(this.AlreadyHandled.in(0));
        this.SaveTheOrder.out(0).to(this.OneItemPerLine.in(0));
        this.SaveTheOrder.out(0).to(this.ConfirmToCustomer.in(0));
        this.OneItemPerLine.out(0).to(this.TakeFromStock.in(0));
        this.TakeFromStock.out(0).to(this.WhatIsRunningLow.in(0));
        this.TakeFromStock.out(1).to(this.StockFailurePayload.in(0));
        this.WhatIsRunningLow.out(0).to(this.AnythingLow.in(0));
        this.AnythingLow.out(0).to(this.WarnTheTeam.in(0));
        this.StockFailurePayload.out(0).to(this.ParkForReplay.in(0));
    }
}
