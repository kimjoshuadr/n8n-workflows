import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Inventory · Supplier stock sync
// Nodes   : 11  |  Connections: 9
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Every2Hours                        scheduleTrigger
// SupplierFeed                       httpRequest                [retry]
// LastKnownStock                     httpRequest                [alwaysOutput] [executeOnce] [retry]
// WhatChanged                        code
// FeedLooksSane                      if
// OneItemPerChange                   code
// UpdateTheStore                     httpRequest                [onError→regular] [retry]
// UpdateTheSnapshot                  httpRequest                [retry]
// RefusedMessage                     code
// Alert                              executeWorkflow
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Every2Hours
//    → SupplierFeed
//      → LastKnownStock
//        → WhatChanged
//          → FeedLooksSane
//            → OneItemPerChange
//              → UpdateTheStore
//                → UpdateTheSnapshot
//           .out(1) → RefusedMessage
//              → Alert
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Inventory · Supplier stock sync',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class InventorySupplierStockSyncWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '61c149c3-46c2-4f6b-aa5c-d0c2d4ec5952',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-40, -390],
    })
    AboutThisWorkflow = {
        width: 620,
        height: 220,
        content: `## Inventory · Supplier stock sync
Pulls the supplier's stock feed every two hours and updates the store only for products whose quantity changed, refusing a feed that looks wrong.

**Needs:** DB_API_KEY, DB_BASE_URL, SHOP_API_KEY, SHOP_BASE_URL, SUPPLIER_API_KEY, SUPPLIER_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`workflows/commerce\``,
    };

    @node({
        id: '447e4632-3745-453f-a3f2-83bd7b5e479d',
        name: 'Every 2 hours',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 0],
    })
    Every2Hours = {
        rule: {
            interval: [
                {
                    field: 'hours',
                    hoursInterval: 2,
                },
            ],
        },
    };

    @node({
        id: '0e51cb14-7698-48f7-a7f9-0ac5229504f9',
        name: 'Supplier feed',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [240, 0],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SupplierFeed = {
        method: 'GET',
        url: '={{ $env.SUPPLIER_BASE_URL }}/stock',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.SUPPLIER_API_KEY }}",
                },
            ],
        },
    };

    @node({
        id: '9720d664-fa72-4670-ae31-77520b4f6081',
        name: 'Last known stock',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [480, 0],
        alwaysOutputData: true,
        executeOnce: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LastKnownStock = {
        method: 'GET',
        url: '={{ $env.DB_BASE_URL }}/stock_snapshot',
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
    };

    @node({
        id: '3de44985-b2c5-4819-a7cb-cebef1a8d8be',
        name: 'What changed?',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [720, 0],
    })
    WhatChanged = {
        jsCode: `const feed = ($("Supplier feed").first().json.items ?? []).filter((i) => i.sku && Number.isFinite(Number(i.quantity)));
const known = new Map($input.all().map((i) => i.json).filter((r) => r.sku).map((r) => [r.sku, r.quantity]));
const changes = feed.map((i) => ({ sku: String(i.sku), quantity: Number(i.quantity), before: known.get(String(i.sku)) ?? null })).filter((c) => c.before !== c.quantity);
const zeroed = changes.filter((c) => c.quantity === 0 && c.before > 0).length;
// A feed that empties most of the catalogue at once is far more likely to be broken than true.
const suspicious = feed.length === 0 || (known.size >= 10 && zeroed / known.size > 0.5);
return [{ json: { feed_size: feed.length, changes, suspicious, zeroed } }];`,
    };

    @node({
        id: '43f83472-acbb-4a4d-a086-39d595c2683a',
        name: 'Feed looks sane?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [960, 0],
    })
    FeedLooksSane = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'c79a2e39-a9ae-4123-aa69-282e42d9ed0e',
                    leftValue: '={{ !$json.suspicious }}',
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
        id: '6d094bfd-caaf-496a-acc9-3aa3327f20e9',
        name: 'One item per change',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1200, -90],
    })
    OneItemPerChange = {
        jsCode: 'return $input.first().json.changes.map((json) => ({ json }));',
    };

    @node({
        id: '69e1eaac-4590-4059-a49d-b85c2cb45bfc',
        name: 'Update the store',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1440, -90],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    UpdateTheStore = {
        method: 'POST',
        url: '={{ $env.SHOP_BASE_URL }}/inventory_levels/set',
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
        jsonBody: '={{ JSON.stringify({ sku: $json.sku, available: $json.quantity }) }}',
    };

    @node({
        id: '652c313e-7013-4265-acb5-944180336c23',
        name: 'Update the snapshot',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1680, 0],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    UpdateTheSnapshot = {
        method: 'POST',
        url: '={{ $env.DB_BASE_URL }}/stock_snapshot',
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
                {
                    name: 'Prefer',
                    value: 'resolution=merge-duplicates',
                },
            ],
        },
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'on_conflict',
                    value: "={{ 'sku' }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ sku: $('One item per change').item.json.sku, quantity: $('One item per change').item.json.quantity, at: $now.toISO() }) }}",
    };

    @node({
        id: 'e8a82eec-5026-487f-aa42-b3d9e3f8fb35',
        name: 'Refused message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1200, 90],
    })
    RefusedMessage = {
        jsCode: `const r = $input.first().json;
return [{ json: { level: "critical", text: "Supplier stock feed refused: " + (r.feed_size === 0 ? "it was empty" : r.zeroed + " products went to zero at once") + ". The store was not changed. Check the feed." } }];`,
    };

    @node({
        id: '3b1cb19e-2f5b-4e5d-ad1c-f494891c8d60',
        name: 'Alert',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [1440, 90],
    })
    Alert = {
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
        this.Every2Hours.out(0).to(this.SupplierFeed.in(0));
        this.SupplierFeed.out(0).to(this.LastKnownStock.in(0));
        this.LastKnownStock.out(0).to(this.WhatChanged.in(0));
        this.WhatChanged.out(0).to(this.FeedLooksSane.in(0));
        this.FeedLooksSane.out(0).to(this.OneItemPerChange.in(0));
        this.FeedLooksSane.out(1).to(this.RefusedMessage.in(0));
        this.OneItemPerChange.out(0).to(this.UpdateTheStore.in(0));
        this.UpdateTheStore.out(0).to(this.UpdateTheSnapshot.in(0));
        this.RefusedMessage.out(0).to(this.Alert.in(0));
    }
}
