import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Block · Webhook with a shared secret
// Nodes   : 5  |  Connections: 3
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Incoming                           webhook
// HasTheSecret                       if
// Ok                                 respondToWebhook
// Refused                            respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Incoming
//    → HasTheSecret
//      → Ok
//     .out(1) → Refused
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Block · Webhook with a shared secret',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BlockWebhookWithASharedSecretWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '6ee31b3a-e657-43af-ab90-526d33ff4dd8',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Block · Webhook with a shared secret
Refuses any request that does not carry the secret header, before doing anything else.

**Platforms:** none, this is logic only
**Settings:** SHOP_API_KEY
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`blocks/intake\``,
    };

    @node({
        id: '347ecc7e-e168-4a9a-a4e3-f3853a8bd43a',
        webhookId: '03c59666-1abd-4254-a7bd-9caf70c6c91d',
        name: 'Incoming',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 180],
    })
    Incoming = {
        httpMethod: 'POST',
        path: 'block-secret',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        id: 'fe132aea-e655-4182-ac5b-e61c222301eb',
        name: 'Has the secret?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [260, 180],
    })
    HasTheSecret = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'e169d05a-2eeb-40ae-ae09-cb2b2080a4f8',
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
        id: 'e0683991-2c07-4fbf-a093-dcefe872eb46',
        name: 'OK',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [520, 90],
    })
    Ok = {
        respondWith: 'json',
        responseBody: '={{ JSON.stringify({ ok: true }) }}',
        options: {
            responseCode: 200,
        },
    };

    @node({
        id: 'b9d88f18-7a15-41a2-a9fc-509d49b27034',
        name: 'Refused',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [520, 270],
    })
    Refused = {
        respondWith: 'json',
        responseBody: '={{ JSON.stringify({ ok: false }) }}',
        options: {
            responseCode: 401,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Incoming.out(0).to(this.HasTheSecret.in(0));
        this.HasTheSecret.out(0).to(this.Ok.in(0));
        this.HasTheSecret.out(1).to(this.Refused.in(0));
    }
}
