import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Content pipeline · Approve and publish
// Nodes   : 14  |  Connections: 12
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Decision                           webhook
// ReadTheDecision                    code
// Valid                              if
// BadRequest                         respondToWebhook
// LoadTheDraft                       httpRequest                [alwaysOutput] [retry]
// AwaitingApproval                   if
// NotPending                         respondToWebhook
// Approved                           if
// PublishToCms                       httpRequest                [retry]
// MarkPublished                      httpRequest                [retry]
// Published                          respondToWebhook
// MarkRejected                       httpRequest                [retry]
// Rejected                           respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Decision
//    → ReadTheDecision
//      → Valid
//        → LoadTheDraft
//          → AwaitingApproval
//            → Approved
//              → PublishToCms
//                → MarkPublished
//                  → Published
//             .out(1) → MarkRejected
//                → Rejected
//           .out(1) → NotPending
//       .out(1) → BadRequest
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Content pipeline · Approve and publish',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class ContentPipelineApproveAndPublishWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '81fe471c-4a84-4711-af06-af36c0009e72',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-40, -390],
    })
    AboutThisWorkflow = {
        width: 620,
        height: 220,
        content: `## Content pipeline · Approve and publish
Receives a person's decision on a draft. Approved drafts are published to the CMS once and queued for sharing; rejected ones go back with the reason.

**Needs:** CMS_API_KEY, CMS_BASE_URL, DB_API_KEY, DB_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/content-pipeline\``,
    };

    @node({
        id: '9fa092bc-e41c-4bed-a845-08e0fadd4d31',
        webhookId: 'a3da4bcc-1c0e-4ac4-a560-8a39cf07d38e',
        name: 'Decision',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 0],
    })
    Decision = {
        httpMethod: 'POST',
        path: 'content-decision',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        id: '7711f376-a9f9-4f6b-a480-b75cf381ba3f',
        name: 'Read the decision',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [240, 0],
    })
    ReadTheDecision = {
        jsCode: `const b = $input.first().json.body ?? {};
const decision = b.decision === "approve" ? "approve" : b.decision === "reject" ? "reject" : null;
return [{ json: { valid: !!decision && !!b.draft_id, decision, draft_id: String(b.draft_id ?? ""), by: String(b.by ?? "unknown"), reason: String(b.reason ?? "") } }];`,
    };

    @node({
        id: '33a04959-6442-46d1-a607-554514fc7a37',
        name: 'Valid?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [480, 0],
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
        id: '5b538e98-8219-4da6-a3f0-43fc8f775598',
        name: 'Bad request',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [720, -90],
    })
    BadRequest = {
        respondWith: 'json',
        responseBody: "={{ JSON.stringify({ ok: false, error: 'Need draft_id and decision: approve | reject' }) }}",
        options: {
            responseCode: 400,
        },
    };

    @node({
        id: 'e82f2931-af53-486d-a69b-60045ba08156',
        name: 'Load the draft',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [720, 90],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LoadTheDraft = {
        method: 'GET',
        url: '={{ $env.DB_BASE_URL }}/content_drafts',
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
                    value: "={{ 'eq.' + $json.draft_id }}",
                },
            ],
        },
    };

    @node({
        id: '6f0ef800-0409-458e-a682-49a6271d6100',
        name: 'Awaiting approval?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [960, 0],
    })
    AwaitingApproval = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '3a75bed8-d918-40a0-a3b4-807a1bba03c9',
                    leftValue: "={{ $json.status === 'awaiting_approval' }}",
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
        id: '3c7bbd10-2628-4fe1-adc2-d80960b0ab2d',
        name: 'Not pending',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [1200, -90],
    })
    NotPending = {
        respondWith: 'json',
        responseBody: "={{ JSON.stringify({ ok: false, error: 'That draft is not awaiting approval' }) }}",
        options: {
            responseCode: 409,
        },
    };

    @node({
        id: '64a803c8-ff31-4c98-a28b-8cfbe18a3141',
        name: 'Approved?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1200, 90],
    })
    Approved = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'b604e61a-1df5-4742-a368-1493d5c22ea0',
                    leftValue: "={{ $('Read the decision').first().json.decision === 'approve' }}",
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
        id: 'da3bfa64-8127-442a-af58-b4f958504c20',
        name: 'Publish to CMS',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1440, -90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PublishToCms = {
        method: 'POST',
        url: '={{ $env.CMS_BASE_URL }}/posts',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.CMS_API_KEY }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ title: $json.title, content: $json.body, status: 'publish', meta: { keywords: $json.keywords } }) }}",
    };

    @node({
        id: '6bffc76d-2b27-4279-a5c8-83e49d6db969',
        name: 'Mark published',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1680, -90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MarkPublished = {
        method: 'PATCH',
        url: '={{ $env.DB_BASE_URL }}/content_drafts',
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
                    value: "={{ 'eq.' + $('Read the decision').first().json.draft_id }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ status: 'published', post_id: $json.id, approved_by: $('Read the decision').first().json.by, published_at: $now.toISO(), shared: false }) }}",
    };

    @node({
        id: '1b5bcd38-0d80-4961-aefa-49f7e6b1e9ad',
        name: 'Published',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [1920, 0],
    })
    Published = {
        respondWith: 'json',
        responseBody: "={{ JSON.stringify({ ok: true, status: 'published' }) }}",
        options: {
            responseCode: 200,
        },
    };

    @node({
        id: 'ff443074-0b6f-43cf-a541-0dc7f3a938b4',
        name: 'Mark rejected',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1440, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MarkRejected = {
        method: 'PATCH',
        url: '={{ $env.DB_BASE_URL }}/content_drafts',
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
                    value: "={{ 'eq.' + $json.id }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ status: 'rejected', rejected_by: $('Read the decision').first().json.by, reason: $('Read the decision').first().json.reason }) }}",
    };

    @node({
        id: 'd968cf3e-5801-455c-aa4b-d6a5a7566ef7',
        name: 'Rejected',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [1680, 90],
    })
    Rejected = {
        respondWith: 'json',
        responseBody: "={{ JSON.stringify({ ok: true, status: 'rejected' }) }}",
        options: {
            responseCode: 200,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Decision.out(0).to(this.ReadTheDecision.in(0));
        this.ReadTheDecision.out(0).to(this.Valid.in(0));
        this.Valid.out(0).to(this.LoadTheDraft.in(0));
        this.Valid.out(1).to(this.BadRequest.in(0));
        this.LoadTheDraft.out(0).to(this.AwaitingApproval.in(0));
        this.AwaitingApproval.out(0).to(this.Approved.in(0));
        this.AwaitingApproval.out(1).to(this.NotPending.in(0));
        this.Approved.out(0).to(this.PublishToCms.in(0));
        this.Approved.out(1).to(this.MarkRejected.in(0));
        this.PublishToCms.out(0).to(this.MarkPublished.in(0));
        this.MarkPublished.out(0).to(this.Published.in(0));
        this.MarkRejected.out(0).to(this.Rejected.in(0));
    }
}
