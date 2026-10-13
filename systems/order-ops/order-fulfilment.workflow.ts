import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Order ops · Shipping updates
// Nodes   : 12  |  Connections: 10
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// ShipmentUpdate                     webhook
// ReadTheUpdate                      code
// AStatusWeActOn                     if
// UpdateTheOrder                     supabase                   [creds] [alwaysOutput] [retry]
// Changed                            if
// WhichStatus                        switch
// EmailTheCustomer                   sendGrid                   [creds] [retry]
// FailedDeliveryMessage              code
// TellSupport                        executeWorkflow
// NothingToDo                        noOp
// IgnoredStatus                      noOp
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ShipmentUpdate
//    → ReadTheUpdate
//      → AStatusWeActOn
//        → UpdateTheOrder
//          → Changed
//            → WhichStatus
//              → FailedDeliveryMessage
//                → TellSupport
//             .out(1) → EmailTheCustomer
//           .out(1) → NothingToDo
//       .out(1) → IgnoredStatus
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Order ops · Shipping updates',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class OrderOpsShippingUpdatesWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '1a0623a0-5b0b-47cd-a488-da7b9b080335',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Order ops · Shipping updates
Turns a courier status into the right message for the customer, and tells a person when a parcel fails delivery.

**Platforms:** Supabase, SendGrid
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/order-ops\``,
    };

    @node({
        id: '42df853a-d0a6-4919-af5f-9735fc36a8f3',
        webhookId: '9ee8bb0d-9d24-44a2-a279-02a699847594',
        name: 'Shipment update',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 180],
    })
    ShipmentUpdate = {
        httpMethod: 'POST',
        path: 'shipment-update',
        responseMode: 'onReceived',
        options: {},
    };

    @node({
        id: '71fd70e8-dfba-4bb5-ad59-1035a4e2bff4',
        name: 'Read the update',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 180],
    })
    ReadTheUpdate = {
        jsCode: `const b = $input.first().json.body ?? {};
const map = { in_transit: "shipped", out_for_delivery: "out_for_delivery", delivered: "delivered", failure: "failed", returned: "failed" };
return [{ json: { order_id: String(b.order_id), status: map[b.status] ?? null, raw_status: b.status, tracking_url: b.tracking_url ?? null } }];`,
    };

    @node({
        id: 'c15724f6-79aa-4d95-a7d4-53743f7e0e69',
        name: 'A status we act on?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [520, 180],
    })
    AStatusWeActOn = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '98cbfed8-5978-4210-a46b-abd00a8559b1',
                    leftValue: '={{ !!$json.status }}',
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
        id: 'cc409fbe-411d-4196-ae48-6f0559fd5099',
        name: 'Update the order',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [780, 90],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    UpdateTheOrder = {
        resource: 'row',
        operation: 'update',
        tableId: 'orders',
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'order_id',
                    condition: 'eq',
                    keyValue: '={{ $json.order_id }}',
                },
                {
                    keyName: 'status',
                    condition: 'neq',
                    keyValue: '={{ $json.status }}',
                },
            ],
        },
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'status',
                    fieldValue: '={{ $json.status }}',
                },
                {
                    fieldId: 'tracking_url',
                    fieldValue: '={{ $json.tracking_url }}',
                },
            ],
        },
    };

    @node({
        id: '16d95082-c695-421d-a908-179fb68bc8d6',
        name: 'Changed?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1040, 180],
    })
    Changed = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'b0c90d96-8370-4846-a659-2b812095c918',
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
        id: '2240c39f-6021-4317-aea2-bfd89ac4a6e7',
        name: 'Which status?',
        type: 'n8n-nodes-base.switch',
        version: 3.2,
        position: [1300, 90],
    })
    WhichStatus = {
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
                                id: '17a583db-94cf-4738-a9ab-7d99757647b8',
                                leftValue: "={{ $json.status === 'failed' }}",
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
            ],
        },
        options: {
            fallbackOutput: 'extra',
        },
    };

    @node({
        id: '6eb79a8a-b24f-4bb7-a5d7-4f96bdd185c8',
        name: 'Email the customer',
        type: 'n8n-nodes-base.sendGrid',
        version: 1,
        position: [1560, 90],
        credentials: { sendGridApi: { id: '__CRED:sendgrid__', name: 'SendGrid' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    EmailTheCustomer = {
        resource: 'mail',
        operation: 'send',
        fromEmail: "={{ 'hello@example.com' }}",
        fromName: "={{ 'Acme' }}",
        toEmail: '={{ $json.email }}',
        dynamicTemplate: true,
        templateId: "={{ 'd-shipping-' + $json.status }}",
        dynamicTemplateFields: {
            fields: [
                {
                    key: 'order_id',
                    value: '={{ $json.order_id }}',
                },
                {
                    key: 'tracking_url',
                    value: '={{ $json.tracking_url }}',
                },
            ],
        },
        additionalFields: {},
    };

    @node({
        id: 'd038a7e2-f962-40cd-a0c9-cd7da023a8ca',
        name: 'Failed delivery message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1560, 270],
    })
    FailedDeliveryMessage = {
        jsCode: `const o = $input.first().json;
return [{ json: { text: "Delivery failed for order " + o.order_id + " (" + o.email + "). Someone should contact the customer.", level: "warn" } }];`,
    };

    @node({
        id: '62d5b452-f997-4bcd-a93c-4054d8681bca',
        name: 'Tell support',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [1820, 180],
    })
    TellSupport = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    @node({
        id: '00910118-420e-460a-a6ac-8ee760218b5b',
        name: 'Nothing to do',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1300, 270],
    })
    NothingToDo = {};

    @node({
        id: '28badb89-8cc6-44fd-a614-64ba521c5a04',
        name: 'Ignored status',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [780, 270],
    })
    IgnoredStatus = {};

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.ShipmentUpdate.out(0).to(this.ReadTheUpdate.in(0));
        this.ReadTheUpdate.out(0).to(this.AStatusWeActOn.in(0));
        this.AStatusWeActOn.out(0).to(this.UpdateTheOrder.in(0));
        this.AStatusWeActOn.out(1).to(this.IgnoredStatus.in(0));
        this.UpdateTheOrder.out(0).to(this.Changed.in(0));
        this.Changed.out(0).to(this.WhichStatus.in(0));
        this.Changed.out(1).to(this.NothingToDo.in(0));
        this.WhichStatus.out(0).to(this.FailedDeliveryMessage.in(0));
        this.WhichStatus.out(1).to(this.EmailTheCustomer.in(0));
        this.FailedDeliveryMessage.out(0).to(this.TellSupport.in(0));
    }
}
