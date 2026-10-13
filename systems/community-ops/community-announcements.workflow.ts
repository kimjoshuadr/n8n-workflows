import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Community ops · Scheduled announcements
// Nodes   : 13  |  Connections: 11
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Every5Minutes                      scheduleTrigger
// DueAnnouncements                   supabase                   [creds] [alwaysOutput] [retry]
// AnyDue                             if
// ClaimIt                            supabase                   [creds] [alwaysOutput] [retry]
// Claimed                            if
// PostIt                             discord                    [onError→regular] [creds] [retry]
// Posted                             if
// MarkSent                           supabase                   [creds] [retry]
// MarkFailed                         supabase                   [creds] [retry]
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
//              → Posted
//                → MarkSent
//               .out(1) → MarkFailed
//                  → FailureMessage
//                    → TellTheTeam
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
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Community ops · Scheduled announcements
Posts announcements at the time they were scheduled for, once, and reports any that could not be posted.

**Platforms:** Supabase, Discord
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/community-ops\``,
    };

    @node({
        id: '94a3fee6-4122-409d-a687-86e048b23b04',
        name: 'Every 5 minutes',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 180],
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
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [260, 180],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    DueAnnouncements = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'announcements',
        returnAll: true,
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'status',
                    condition: 'eq',
                    keyValue: "={{ 'scheduled' }}",
                },
                {
                    keyName: 'send_at',
                    condition: 'lte',
                    keyValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '93c7d4cd-691f-4efc-a129-1725bdbcea4b',
        name: 'Any due?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [520, 180],
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
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [780, 90],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ClaimIt = {
        resource: 'row',
        operation: 'update',
        tableId: 'announcements',
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'id',
                    condition: 'eq',
                    keyValue: '={{ $json.id }}',
                },
                {
                    keyName: 'status',
                    condition: 'eq',
                    keyValue: "={{ 'scheduled' }}",
                },
            ],
        },
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'status',
                    fieldValue: "={{ 'sending' }}",
                },
            ],
        },
    };

    @node({
        id: '4e9bed98-201b-4067-a15b-6dc31d676d3c',
        name: 'Claimed?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1040, 180],
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
        type: 'n8n-nodes-base.discord',
        version: 2,
        position: [1300, 180],
        credentials: { discordBotApi: { id: '__CRED:discord__', name: 'Discord' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PostIt = {
        authentication: 'botToken',
        resource: 'message',
        operation: 'send',
        guildId: {
            __rl: true,
            mode: 'id',
            value: "={{ '100000000000000001' }}",
        },
        channelId: {
            __rl: true,
            mode: 'id',
            value: '={{ $json.channel_id }}',
        },
        content: '={{ $json.content }}',
        options: {},
    };

    @node({
        id: '656b5821-8b52-44cf-a645-659353213818',
        name: 'Posted?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1560, 180],
    })
    Posted = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '959be091-4f39-4086-a411-1b3fb6712f34',
                    leftValue: '={{ !!$json.id && !$json.error }}',
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
        id: '8c10dae4-67df-420a-a827-914fff88de0d',
        name: 'Mark sent',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1820, 90],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MarkSent = {
        resource: 'row',
        operation: 'update',
        tableId: 'announcements',
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'id',
                    condition: 'eq',
                    keyValue: "={{ $('Claimed?').item.json.id }}",
                },
            ],
        },
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'status',
                    fieldValue: "={{ 'sent' }}",
                },
                {
                    fieldId: 'sent_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: 'bd231682-82ba-4c0d-a09f-a46fcc86076d',
        name: 'Mark failed',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1820, 270],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MarkFailed = {
        resource: 'row',
        operation: 'update',
        tableId: 'announcements',
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'id',
                    condition: 'eq',
                    keyValue: "={{ $('Claimed?').item.json.id }}",
                },
            ],
        },
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'status',
                    fieldValue: "={{ 'failed' }}",
                },
            ],
        },
    };

    @node({
        id: 'b8c9a21d-f837-4a5a-a4bf-553c9cdccf9f',
        name: 'Failure message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2080, 180],
    })
    FailureMessage = {
        jsCode: 'return $input.all().map((i) => ({ json: { channel: "#mods", level: "warn", text: "An announcement could not be posted and was marked failed: \\"" + String(i.json.content ?? "").slice(0, 120) + "\\"" } }));',
    };

    @node({
        id: '846f044b-d042-484b-a597-9b0e21a47e6c',
        name: 'Tell the team',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [2340, 180],
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
        position: [780, 270],
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
        this.PostIt.out(0).to(this.Posted.in(0));
        this.Posted.out(0).to(this.MarkSent.in(0));
        this.Posted.out(1).to(this.MarkFailed.in(0));
        this.MarkFailed.out(0).to(this.FailureMessage.in(0));
        this.FailureMessage.out(0).to(this.TellTheTeam.in(0));
    }
}
