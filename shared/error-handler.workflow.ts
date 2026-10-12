import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Reliability · Error handler
// Nodes   : 7  |  Connections: 5
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// OnWorkflowError                    errorTrigger
// DescribeTheFailure                 code
// LogTheError                        httpRequest                [alwaysOutput] [retry]
// FirstTimeThisHour                  if
// AlertTheTeam                       httpRequest                [retry]
// AlreadyAlerted                     noOp
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// OnWorkflowError
//    → DescribeTheFailure
//      → LogTheError
//        → FirstTimeThisHour
//          → AlertTheTeam
//         .out(1) → AlreadyAlerted
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
        position: [-40, -390],
    })
    AboutThisWorkflow = {
        width: 620,
        height: 220,
        content: `## Reliability · Error handler
Catches a failure in any workflow, logs it, and alerts once per distinct error per hour so a broken loop cannot flood the channel.

**Needs:** ALERT_CHANNEL, CHAT_API_KEY, CHAT_BASE_URL, DB_API_KEY, DB_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`shared\``,
    };

    @node({
        id: 'dce5f972-b3db-473f-adb8-7414b84ad45b',
        name: 'On workflow error',
        type: 'n8n-nodes-base.errorTrigger',
        version: 1,
        position: [0, 0],
    })
    OnWorkflowError = {};

    @node({
        id: '99310d67-a0d8-47ab-a8e1-df3139244ad2',
        name: 'Describe the failure',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [240, 0],
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
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [480, 0],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LogTheError = {
        method: 'POST',
        url: '={{ $env.DB_BASE_URL }}/workflow_errors',
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
                    value: 'resolution=ignore-duplicates,return=representation',
                },
            ],
        },
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'on_conflict',
                    value: "={{ 'fingerprint' }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify($json) }}',
    };

    @node({
        id: '5485f3d1-55dd-4cfa-af7c-1c94460243ff',
        name: 'First time this hour?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [720, 0],
    })
    FirstTimeThisHour = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '1b52a6e5-2630-4b58-a577-9ce45358a32c',
                    leftValue: '={{ !!$json.id }}',
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
        id: 'c8d93d0f-8888-4d65-a12f-33ac1fd0c634',
        name: 'Alert the team',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [960, -90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    AlertTheTeam = {
        method: 'POST',
        url: '={{ $env.CHAT_BASE_URL }}/chat.postMessage',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.CHAT_API_KEY }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: `={{ JSON.stringify({
  channel: $env.ALERT_CHANNEL,
  text: ':rotating_light: ' + $('Describe the failure').first().json.workflow + ' failed at "' + $('Describe the failure').first().json.node + '": ' + $('Describe the failure').first().json.message
}) }}`,
    };

    @node({
        id: '70793f10-e5f6-42c6-ae4d-08413c8b661b',
        name: 'Already alerted',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [960, 90],
    })
    AlreadyAlerted = {};

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.OnWorkflowError.out(0).to(this.DescribeTheFailure.in(0));
        this.DescribeTheFailure.out(0).to(this.LogTheError.in(0));
        this.LogTheError.out(0).to(this.FirstTimeThisHour.in(0));
        this.FirstTimeThisHour.out(0).to(this.AlertTheTeam.in(0));
        this.FirstTimeThisHour.out(1).to(this.AlreadyAlerted.in(0));
    }
}
