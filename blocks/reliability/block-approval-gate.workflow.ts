import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Block · Wait for a person's yes
// Nodes   : 7  |  Connections: 5
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// DecisionLink                       webhook
// ReadTheLink                        code
// ResolveIfStillPending              supabase                   [creds] [alwaysOutput] [retry]
// ResolvedNow                        if
// Thanks                             respondToWebhook
// LinkNoLongerValid                  respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// DecisionLink
//    → ReadTheLink
//      → ResolveIfStillPending
//        → ResolvedNow
//          → Thanks
//         .out(1) → LinkNoLongerValid
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: "Block · Wait for a person's yes",
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BlockWaitForAPersonSYesWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '810ae272-77b2-4f60-adfb-b1a1a94eaaaa',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Block · Wait for a person's yes
Records a pending decision and gives back approve and reject links. Nothing proceeds until one is pressed, and each link works once.

**Platforms:** Supabase
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`blocks/reliability\``,
    };

    @node({
        id: 'b5a17500-15e1-4031-a9ce-52a4c5702edf',
        webhookId: 'facc578f-6c8e-460f-abac-5d83098e2e87',
        name: 'Decision link',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 180],
    })
    DecisionLink = {
        httpMethod: 'GET',
        path: 'block-approval',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        id: '745e3af5-4eac-4a5d-a116-7cd560b4cc76',
        name: 'Read the link',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 180],
    })
    ReadTheLink = {
        jsCode: `const q = $input.first().json.query ?? {};
return [{ json: { token: String(q.token ?? ""), decision: q.decision === "approve" ? "approved" : q.decision === "reject" ? "rejected" : null } }];`,
    };

    @node({
        id: '03f464db-fa1d-4ce5-a2a2-a68afaa8c184',
        name: 'Resolve if still pending',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [520, 180],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ResolveIfStillPending = {
        resource: 'row',
        operation: 'update',
        tableId: 'approvals',
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'token',
                    condition: 'eq',
                    keyValue: '={{ $json.token }}',
                },
                {
                    keyName: 'status',
                    condition: 'eq',
                    keyValue: "={{ 'pending' }}",
                },
            ],
        },
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'status',
                    fieldValue: '={{ $json.decision }}',
                },
                {
                    fieldId: 'decided_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: 'f0fed394-42c6-4876-a934-692bd767984d',
        name: 'Resolved now?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [780, 180],
    })
    ResolvedNow = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '49965971-b5b6-440b-ae0c-8c6d56f375c9',
                    leftValue: "={{ !!$json.token && !!$('Read the link').first().json.decision }}",
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
        id: 'c57ba15a-111f-4269-aa6e-42d06d49bf8b',
        name: 'Thanks',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [1040, 90],
    })
    Thanks = {
        respondWith: 'json',
        responseBody: '={{ JSON.stringify({ ok: true, status: $json.status }) }}',
        options: {
            responseCode: 200,
        },
    };

    @node({
        id: 'b58c6f0f-2371-4495-ac4a-c927e54a91ff',
        name: 'Link no longer valid',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [1040, 270],
    })
    LinkNoLongerValid = {
        respondWith: 'json',
        responseBody: "={{ JSON.stringify({ ok: false, error: 'This link was already used or does not exist' }) }}",
        options: {
            responseCode: 410,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.DecisionLink.out(0).to(this.ReadTheLink.in(0));
        this.ReadTheLink.out(0).to(this.ResolveIfStillPending.in(0));
        this.ResolveIfStillPending.out(0).to(this.ResolvedNow.in(0));
        this.ResolvedNow.out(0).to(this.Thanks.in(0));
        this.ResolvedNow.out(1).to(this.LinkNoLongerValid.in(0));
    }
}
