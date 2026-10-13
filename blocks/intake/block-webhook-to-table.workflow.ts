import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Block · Webhook to a table
// Nodes   : 5  |  Connections: 3
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// FormPosted                         webhook
// KeepKnownFields                    code
// StoreTheRow                        supabase                   [creds] [retry]
// Thanks                             respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// FormPosted
//    → KeepKnownFields
//      → StoreTheRow
//        → Thanks
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Block · Webhook to a table',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BlockWebhookToATableWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'e015fead-a874-4744-ae64-a8fa684103ba',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Block · Webhook to a table
The smallest useful workflow: receive a form post, keep the fields you named, store a row, answer the sender.

**Platforms:** Supabase
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`blocks/intake\``,
    };

    @node({
        id: '856da8c4-1ef7-40da-a9e2-1714e5b10edb',
        webhookId: 'c489aada-7889-41a7-ab25-3873ff4cb9a1',
        name: 'Form posted',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 90],
    })
    FormPosted = {
        httpMethod: 'POST',
        path: 'block-form',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        id: '2ca64af3-be2f-49c3-a4d8-e60878c2ea43',
        name: 'Keep known fields',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 90],
    })
    KeepKnownFields = {
        jsCode: `const body = $input.first().json.body ?? {};
const row = Object.fromEntries(["name", "email", "message"].map((k) => [k, typeof body[k] === "string" ? body[k].trim().slice(0, 2000) : null]));
return [{ json: { ...row, received_at: new Date().toISOString() } }];`,
    };

    @node({
        id: 'b347c1b3-65ab-4277-ad35-d0982b273dc1',
        name: 'Store the row',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [520, 90],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    StoreTheRow = {
        resource: 'row',
        operation: 'create',
        tableId: 'form_submissions',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'name',
                    fieldValue: '={{ $json.name }}',
                },
                {
                    fieldId: 'email',
                    fieldValue: '={{ $json.email }}',
                },
                {
                    fieldId: 'message',
                    fieldValue: '={{ $json.message }}',
                },
                {
                    fieldId: 'received_at',
                    fieldValue: '={{ $json.received_at }}',
                },
            ],
        },
    };

    @node({
        id: '9fc6b43c-2a82-4322-a503-cd2ec12ef109',
        name: 'Thanks',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [780, 90],
    })
    Thanks = {
        respondWith: 'json',
        responseBody: '={{ JSON.stringify({ ok: true, id: $json.id }) }}',
        options: {
            responseCode: 200,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.FormPosted.out(0).to(this.KeepKnownFields.in(0));
        this.KeepKnownFields.out(0).to(this.StoreTheRow.in(0));
        this.StoreTheRow.out(0).to(this.Thanks.in(0));
    }
}
