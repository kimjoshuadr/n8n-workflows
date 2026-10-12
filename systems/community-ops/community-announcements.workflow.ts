import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Community ops · Scheduled announcements
// Nodes   : 12  |  Connections: 10
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Every5Minutes                      scheduleTrigger
// DueAnnouncements                   httpRequest                [alwaysOutput] [retry]
// AnyDue                             if
// ClaimIt                            httpRequest                [alwaysOutput] [retry]
// Claimed                            if
// PostIt                             httpRequest                [onError→out(1)] [retry]
// MarkSent                           httpRequest                [retry]
// MarkFailed                         httpRequest                [retry]
// FailureMessage                     code
// TellTheTeam                        executeWorkflow
// NothingDue                         noOp
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Every5Minutes
//    → DueAnnouncements
//      → AnyDue
//        → ClaimIt
//          → Claimed
//            → PostIt
//              → MarkSent
//             .out(1) → MarkFailed
//                → FailureMessage
//                  → TellTheTeam
//       .out(1) → NothingDue
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Community ops · Scheduled announcements',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class CommunityOpsScheduledAnnouncementsWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '102ecbf1-c4d8-4df8-a281-9ca0252cdc62',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-40, -390],
    })
    AboutThisWorkflow = {
        width: 620,
        height: 220,
        content: `## Community ops · Scheduled announcements
Posts announcements at the time they were scheduled for, once, and reports any that could not be posted.

**Needs:** DB_API_KEY, DB_BASE_URL, DISCORD_API_KEY, DISCORD_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/community-ops\``,
    };

    @node({
        id: '94a3fee6-4122-409d-a687-86e048b23b04',
        name: 'Every 5 minutes',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 0],
    })
    Every5Minutes = {
        rule: {
            interval: [
                {
                    field: 'minutes',
                    minutesInterval: 5,
                },
            ],
        },
    };

    @node({
        id: 'e18b8fd2-19a7-472a-abf3-226d8e12a57f',
        name: 'Due announcements',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [240, 0],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    DueAnnouncements = {
        method: 'GET',
        url: '={{ $env.DB_BASE_URL }}/announcements',
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
                    name: 'status',
                    value: "={{ 'eq.scheduled' }}",
                },
                {
                    name: 'send_at',
                    value: "={{ 'lte.' + $now.toISO() }}",
                },
            ],
        },
    };

    @node({
        id: '93c7d4cd-691f-4efc-a129-1725bdbcea4b',
        name: 'Any due?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [480, 0],
    })
    AnyDue = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '7125bf0e-bf22-4fac-a3ea-eb96788fcc72',
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
        id: '827d27d6-4baa-4653-ab50-756f07e67c05',
        name: 'Claim it',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [720, -90],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ClaimIt = {
        method: 'PATCH',
        url: '={{ $env.DB_BASE_URL }}/announcements',
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
                {
                    name: 'status',
                    value: "={{ 'eq.scheduled' }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: "={{ JSON.stringify({ status: 'sending' }) }}",
    };

    @node({
        id: '4e9bed98-201b-4067-a15b-6dc31d676d3c',
        name: 'Claimed?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [960, 0],
    })
    Claimed = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'd2884e8b-6ff0-4d17-a44b-f99996ad5e65',
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
        id: '15c59722-fa30-44b8-a0f1-5313b8358198',
        name: 'Post it',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1200, 0],
        onError: 'continueErrorOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PostIt = {
        method: 'POST',
        url: '={{ $env.DISCORD_BASE_URL }}/channels/announcements/messages',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.DISCORD_API_KEY }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            '={{ JSON.stringify({ channel: $json.channel, content: $json.content, mention_everyone: $json.mention_everyone === true }) }}',
    };

    @node({
        id: '8c10dae4-67df-420a-a827-914fff88de0d',
        name: 'Mark sent',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1440, -90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MarkSent = {
        method: 'PATCH',
        url: '={{ $env.DB_BASE_URL }}/announcements',
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
                    value: "={{ 'eq.' + $('Claimed?').item.json.id }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: "={{ JSON.stringify({ status: 'sent', sent_at: $now.toISO() }) }}",
    };

    @node({
        id: 'bd231682-82ba-4c0d-a09f-a46fcc86076d',
        name: 'Mark failed',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1440, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MarkFailed = {
        method: 'PATCH',
        url: '={{ $env.DB_BASE_URL }}/announcements',
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
                    value: "={{ 'eq.' + $('Claimed?').item.json.id }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: "={{ JSON.stringify({ status: 'failed' }) }}",
    };

    @node({
        id: 'b8c9a21d-f837-4a5a-a4bf-553c9cdccf9f',
        name: 'Failure message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1680, 0],
    })
    FailureMessage = {
        jsCode: 'return $input.all().map((i) => ({ json: { channel: "#mods", level: "warn", text: "An announcement could not be posted and was marked failed: \\"" + String(i.json.content ?? "").slice(0, 120) + "\\"" } }));',
    };

    @node({
        id: '846f044b-d042-484b-a597-9b0e21a47e6c',
        name: 'Tell the team',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [1920, 0],
    })
    TellTheTeam = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    @node({
        id: '69c0f051-6c6b-496e-aea2-44e3fda0d8a9',
        name: 'Nothing due',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [720, 90],
    })
    NothingDue = {};

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Every5Minutes.out(0).to(this.DueAnnouncements.in(0));
        this.DueAnnouncements.out(0).to(this.AnyDue.in(0));
        this.AnyDue.out(0).to(this.ClaimIt.in(0));
        this.AnyDue.out(1).to(this.NothingDue.in(0));
        this.ClaimIt.out(0).to(this.Claimed.in(0));
        this.Claimed.out(0).to(this.PostIt.in(0));
        this.PostIt.out(0).to(this.MarkSent.in(0));
        this.PostIt.out(1).to(this.MarkFailed.in(0));
        this.MarkFailed.out(0).to(this.FailureMessage.in(0));
        this.FailureMessage.out(0).to(this.TellTheTeam.in(0));
    }
}
