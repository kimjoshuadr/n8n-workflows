import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Reliability · Error handler
// Nodes   : 8  |  Connections: 6
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// OnWorkflowError                    errorTrigger
// DescribeTheFailure                 code
// LogTheError                        supabase                   [onError→out(1)] [creds]
// AlertTheTeam                       slack                      [creds] [retry]
// SeenThisHour                       if
// AlreadyAlerted                     noOp
// AlertAnyway                        slack                      [creds] [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// OnWorkflowError
//    → DescribeTheFailure
//      → LogTheError
//        → AlertTheTeam
//       .out(1) → SeenThisHour
//          → AlreadyAlerted
//         .out(1) → AlertAnyway
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Reliability · Error handler',
    active: undefined,
    settings: { executionOrder: 'v1' },
})
export class ReliabilityErrorHandlerWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '0581a7c1-2c3e-4a26-a395-ec868269b126',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Reliability · Error handler
Catches a failure in any workflow, logs it to Supabase, and alerts Slack once per distinct error per hour so a broken loop cannot flood the channel.

**Platforms:** Supabase, Slack
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`shared\``,
    };

    @node({
        id: 'dce5f972-b3db-473f-adb8-7414b84ad45b',
        name: 'On workflow error',
        type: 'n8n-nodes-base.errorTrigger',
        version: 1,
        position: [0, 180],
    })
    OnWorkflowError = {};

    @node({
        id: '99310d67-a0d8-47ab-a8e1-df3139244ad2',
        name: 'Describe the failure',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 180],
    })
    DescribeTheFailure = {
        jsCode: `const e = $input.first().json;
const workflow = e.workflow?.name ?? "Unknown workflow";
const node = e.execution?.lastNodeExecuted ?? "unknown node";
const message = String(e.execution?.error?.message ?? e.trigger?.error?.message ?? "No message").slice(0, 500);
const hour = new Date().toISOString().slice(0, 13);
return [{ json: {
  workflow, node, message,
  execution_id: e.execution?.id ?? null,
  execution_url: e.execution?.url ?? null,
  fingerprint: [workflow, node, message.slice(0, 80), hour].join("|"),
  at: new Date().toISOString(),
} }];`,
    };

    @node({
        id: 'd2475f31-7b58-4456-a438-515d78ab10c9',
        name: 'Log the error',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [520, 180],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        onError: 'continueErrorOutput',
    })
    LogTheError = {
        resource: 'row',
        operation: 'create',
        tableId: 'workflow_errors',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'workflow',
                    fieldValue: '={{ $json.workflow }}',
                },
                {
                    fieldId: 'node',
                    fieldValue: '={{ $json.node }}',
                },
                {
                    fieldId: 'message',
                    fieldValue: '={{ $json.message }}',
                },
                {
                    fieldId: 'execution_id',
                    fieldValue: '={{ $json.execution_id }}',
                },
                {
                    fieldId: 'fingerprint',
                    fieldValue: '={{ $json.fingerprint }}',
                },
                {
                    fieldId: 'at',
                    fieldValue: '={{ $json.at }}',
                },
            ],
        },
    };

    @node({
        id: 'c8d93d0f-8888-4d65-a12f-33ac1fd0c634',
        name: 'Alert the team',
        type: 'n8n-nodes-base.slack',
        version: 2.3,
        position: [780, 90],
        credentials: { slackApi: { id: '__CRED:slack__', name: 'Slack' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    AlertTheTeam = {
        resource: 'message',
        operation: 'post',
        select: 'channel',
        channelId: {
            __rl: true,
            mode: 'name',
            value: "={{ '#ops-alerts' }}",
        },
        text: "={{ ':rotating_light: ' + $('Describe the failure').first().json.workflow + ' failed at \"' + $('Describe the failure').first().json.node + '\": ' + $('Describe the failure').first().json.message }}",
        otherOptions: {
            includeLinkToWorkflow: false,
        },
    };

    @node({
        id: '4228acb3-0754-44f0-a012-4e1eb27f27d8',
        name: 'Seen this hour?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [780, 270],
    })
    SeenThisHour = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '1bdc4999-ccb8-41e9-af7a-e9a19ae7f1ec',
                    leftValue: "={{ /duplicate key|23505/.test(String($json.error ?? '')) }}",
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
        id: '70793f10-e5f6-42c6-ae4d-08413c8b661b',
        name: 'Already alerted',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1040, 90],
    })
    AlreadyAlerted = {};

    @node({
        id: '6f134486-cf8a-47ef-a248-883dfb8464cc',
        name: 'Alert anyway',
        type: 'n8n-nodes-base.slack',
        version: 2.3,
        position: [1040, 270],
        credentials: { slackApi: { id: '__CRED:slack__', name: 'Slack' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    AlertAnyway = {
        resource: 'message',
        operation: 'post',
        select: 'channel',
        channelId: {
            __rl: true,
            mode: 'name',
            value: "={{ '#ops-alerts' }}",
        },
        text: "={{ ':rotating_light: ' + $('Describe the failure').first().json.workflow + ' failed at \"' + $('Describe the failure').first().json.node + '\": ' + $('Describe the failure').first().json.message + ' (and the error log could not be written)' }}",
        otherOptions: {
            includeLinkToWorkflow: false,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.OnWorkflowError.out(0).to(this.DescribeTheFailure.in(0));
        this.DescribeTheFailure.out(0).to(this.LogTheError.in(0));
        this.LogTheError.out(0).to(this.AlertTheTeam.in(0));
        this.LogTheError.out(1).to(this.SeenThisHour.in(0));
        this.SeenThisHour.out(0).to(this.AlreadyAlerted.in(0));
        this.SeenThisHour.out(1).to(this.AlertAnyway.in(0));
    }
}
