import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Feedback · Route survey scores
// Nodes   : 10  |  Connections: 8
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// SurveyAnswered                     webhook
// ReadTheScore                       code
// RecordIt                           supabase                   [creds] [retry]
// WhichGroup                         switch
// OpenATicket                        zendesk                    [creds] [retry]
// DetractorMessage                   code
// TellCustomerSuccess                executeWorkflow
// InviteAPublicReview                sendGrid                   [creds] [retry]
// RecordedOnly                       noOp
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// SurveyAnswered
//    → ReadTheScore
//      → RecordIt
//        → WhichGroup
//          → OpenATicket
//            → DetractorMessage
//              → TellCustomerSuccess
//         .out(1) → InviteAPublicReview
//         .out(2) → RecordedOnly
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Feedback · Route survey scores',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class FeedbackRouteSurveyScoresWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'd2d5c522-1d65-401d-a092-20fa7db33549',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Feedback · Route survey scores
Sends each survey score where it is useful: unhappy customers to a person today, happy ones to a review request, and every score to the record.

**Platforms:** Supabase, Zendesk, SendGrid
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`workflows/sales\``,
    };

    @node({
        id: '3bf32680-1d50-4e50-a4ea-2c42277b3137',
        webhookId: '51071e31-36b1-4285-a5c4-d23e2635170f',
        name: 'Survey answered',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 270],
    })
    SurveyAnswered = {
        httpMethod: 'POST',
        path: 'survey-answered',
        responseMode: 'onReceived',
        options: {},
    };

    @node({
        id: '339cf1ef-a31e-4620-aec3-ae2b0f1a003d',
        name: 'Read the score',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 270],
    })
    ReadTheScore = {
        jsCode: `const b = $input.first().json.body ?? {};
const score = Number(b.score);
if (!Number.isInteger(score) || score < 0 || score > 10) throw new Error("Score must be an integer from 0 to 10");
return [{ json: { email: String(b.email ?? "").toLowerCase(), score, comment: String(b.comment ?? "").slice(0, 1000), group: score <= 6 ? "detractor" : score >= 9 ? "promoter" : "passive" } }];`,
    };

    @node({
        id: '66dfdaed-cb42-48de-acc5-47de7847afbe',
        name: 'Record it',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [520, 270],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    RecordIt = {
        resource: 'row',
        operation: 'create',
        tableId: 'nps_responses',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'email',
                    fieldValue: '={{ $json.email }}',
                },
                {
                    fieldId: 'score',
                    fieldValue: '={{ $json.score }}',
                },
                {
                    fieldId: 'comment',
                    fieldValue: '={{ $json.comment }}',
                },
                {
                    fieldId: 'group',
                    fieldValue: '={{ $json.group }}',
                },
                {
                    fieldId: 'at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: 'd50b1c61-e2bd-472a-a71a-00c0ab501795',
        name: 'Which group?',
        type: 'n8n-nodes-base.switch',
        version: 3.2,
        position: [780, 270],
    })
    WhichGroup = {
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
                                id: '3373643e-4ff0-4ebb-a531-4f90f5cf782e',
                                leftValue: "={{ $('Read the score').first().json.group === 'detractor' }}",
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
                    outputKey: 'detractor',
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
                                id: '87c70797-f5ea-4fbc-a02e-2abc7c646ad2',
                                leftValue: "={{ $('Read the score').first().json.group === 'promoter' }}",
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
                    outputKey: 'promoter',
                },
            ],
        },
        options: {
            fallbackOutput: 'extra',
        },
    };

    @node({
        id: '455d6e26-f5f7-40a8-a4fb-dfff6fcf7d0e',
        name: 'Open a ticket',
        type: 'n8n-nodes-base.zendesk',
        version: 1,
        position: [1040, 90],
        credentials: { zendeskApi: { id: '__CRED:zendesk__', name: 'Zendesk' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    OpenATicket = {
        resource: 'ticket',
        operation: 'create',
        description:
            "={{ $('Read the score').first().json.email + ' said: ' + ($('Read the score').first().json.comment || '(no comment)') }}",
        additionalFields: {
            subject: "={{ 'Unhappy customer (score ' + $('Read the score').first().json.score + ')' }}",
            tags: ['nps-detractor'],
        },
    };

    @node({
        id: 'af2e9c76-4151-4385-ab0a-1504598d4940',
        name: 'Detractor message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1300, 270],
    })
    DetractorMessage = {
        jsCode: `const s = $("Read the score").first().json;
return [{ json: { level: "warn", text: s.email + " scored us " + s.score + "/10" + (s.comment ? ": \\"" + s.comment.slice(0, 200) + "\\"" : " with no comment") + ". A ticket is open." } }];`,
    };

    @node({
        id: '6d03c695-f7ee-491c-aa6d-71266ca951b3',
        name: 'Tell customer success',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [1560, 270],
    })
    TellCustomerSuccess = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    @node({
        id: 'cdf61384-7b85-4098-ad49-2bfa6d5847bc',
        name: 'Invite a public review',
        type: 'n8n-nodes-base.sendGrid',
        version: 1,
        position: [1040, 270],
        credentials: { sendGridApi: { id: '__CRED:sendgrid__', name: 'SendGrid' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    InviteAPublicReview = {
        resource: 'mail',
        operation: 'send',
        fromEmail: "={{ 'hello@example.com' }}",
        fromName: "={{ 'Acme' }}",
        toEmail: "={{ $('Read the score').first().json.email }}",
        dynamicTemplate: true,
        templateId: "={{ 'd-review-invite' }}",
        dynamicTemplateFields: {
            fields: [],
        },
        additionalFields: {},
    };

    @node({
        id: 'f5ff5b9f-7408-4f49-a854-41a69502410a',
        name: 'Recorded only',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1040, 450],
    })
    RecordedOnly = {};

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.SurveyAnswered.out(0).to(this.ReadTheScore.in(0));
        this.ReadTheScore.out(0).to(this.RecordIt.in(0));
        this.RecordIt.out(0).to(this.WhichGroup.in(0));
        this.WhichGroup.out(0).to(this.OpenATicket.in(0));
        this.WhichGroup.out(1).to(this.InviteAPublicReview.in(0));
        this.WhichGroup.out(2).to(this.RecordedOnly.in(0));
        this.OpenATicket.out(0).to(this.DetractorMessage.in(0));
        this.DetractorMessage.out(0).to(this.TellCustomerSuccess.in(0));
    }
}
