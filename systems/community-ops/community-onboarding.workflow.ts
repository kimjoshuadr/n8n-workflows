import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Community ops · Member onboarding
// Nodes   : 14  |  Connections: 12
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// MemberJoined                       webhook
// ReadTheMember                      code
// APerson                            if
// SeenBefore                         executeWorkflow
// FirstJoin                          if
// SaveTheMember                      supabase                   [creds] [retry]
// BrandNewAccount                    if
// ReviewMessage                      code
// AskAModerator                      executeWorkflow
// GiveStarterRole                    discord                    [creds] [retry]
// WelcomeThem                        discord                    [onError→regular] [creds] [retry]
// IgnoreBots                         noOp
// Rejoined                           noOp
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// MemberJoined
//    → ReadTheMember
//      → APerson
//        → SeenBefore
//          → FirstJoin
//            → SaveTheMember
//              → BrandNewAccount
//                → ReviewMessage
//                  → AskAModerator
//               .out(1) → GiveStarterRole
//                  → WelcomeThem
//           .out(1) → Rejoined
//       .out(1) → IgnoreBots
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Community ops · Member onboarding',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class CommunityOpsMemberOnboardingWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '5272c6f9-c9a3-4a27-a309-8982c71da519',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Community ops · Member onboarding
Welcomes a new member, gives them the starter role, records them, and flags accounts created minutes ago for a moderator to look at.

**Platforms:** Supabase, Discord
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/community-ops\``,
    };

    @node({
        id: 'e059afcd-3601-4e69-a3d7-22b8df581ab1',
        webhookId: '6e6bf0fc-804f-4050-a9da-a756b5aef125',
        name: 'Member joined',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 180],
    })
    MemberJoined = {
        httpMethod: 'POST',
        path: 'member-joined',
        responseMode: 'onReceived',
        options: {},
    };

    @node({
        id: '4e0dec90-ac80-41e2-aae3-0d4a1ecea46e',
        name: 'Read the member',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 180],
    })
    ReadTheMember = {
        jsCode: `const m = $input.first().json.body ?? {};
const created = m.user?.created_at ? new Date(m.user.created_at).getTime() : null;
const ageDays = created ? (Date.now() - created) / 864e5 : null;
return [{ json: { user_id: String(m.user?.id), username: m.user?.username ?? "new member", guild_id: String(m.guild_id), bot: !!m.user?.bot, account_age_days: ageDays === null ? null : Math.floor(ageDays), suspicious: ageDays !== null && ageDays < 1, scope: "member-joined", key: m.guild_id + ":" + m.user?.id } }];`,
    };

    @node({
        id: '95ec3f75-8384-49d8-ad60-1bbc0cc3124c',
        name: 'A person?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [520, 180],
    })
    APerson = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '125b1fb0-66b3-4459-ae26-eeb5531ab86c',
                    leftValue: '={{ !$json.bot }}',
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
        id: 'be2489a8-0193-46f5-a5fb-d07430bde7d3',
        name: 'Seen before?',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [780, 90],
    })
    SeenBefore = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:idempotency-guard__',
        },
        options: {},
    };

    @node({
        id: 'd7a1aae2-1f8e-4e2c-a079-20ff98850948',
        name: 'First join?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1040, 180],
    })
    FirstJoin = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'a50052a4-c487-47a8-a08d-359ddeb5e712',
                    leftValue: '={{ !$json.duplicate }}',
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
        id: '536eb07d-1ee8-4cbd-a0a3-203e85d5e5c5',
        name: 'Save the member',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1300, 90],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SaveTheMember = {
        resource: 'row',
        operation: 'create',
        tableId: 'members',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'user_id',
                    fieldValue: '={{ $json.user_id }}',
                },
                {
                    fieldId: 'username',
                    fieldValue: '={{ $json.username }}',
                },
                {
                    fieldId: 'guild_id',
                    fieldValue: '={{ $json.guild_id }}',
                },
                {
                    fieldId: 'joined_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
                {
                    fieldId: 'suspicious',
                    fieldValue: '={{ $json.suspicious }}',
                },
            ],
        },
    };

    @node({
        id: 'fdae915b-fb3a-4004-a837-e8f949ed2232',
        name: 'Brand new account?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1560, 180],
    })
    BrandNewAccount = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '5b17c6cc-bb28-4d4b-a1db-2e82e1ad31d0',
                    leftValue: "={{ $('First join?').first().json.suspicious }}",
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
        id: 'b12e7464-4f69-488e-a292-1c3b581452fc',
        name: 'Review message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1820, 90],
    })
    ReviewMessage = {
        jsCode: `const m = $("First join?").first().json;
return [{ json: { channel: "#mods", level: "warn", text: m.username + " joined with an account under a day old. Held without a role until someone checks." } }];`,
    };

    @node({
        id: '425e4729-319a-47e8-a6b2-aed0b4428eb9',
        name: 'Ask a moderator',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [2080, 90],
    })
    AskAModerator = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    @node({
        id: '4c0f6157-2935-4fea-ac74-bebd537606a0',
        name: 'Give starter role',
        type: 'n8n-nodes-base.discord',
        version: 2,
        position: [1820, 270],
        credentials: { discordBotApi: { id: '__CRED:discord__', name: 'Discord' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GiveStarterRole = {
        authentication: 'botToken',
        resource: 'member',
        operation: 'roleAdd',
        guildId: {
            __rl: true,
            mode: 'id',
            value: "={{ '100000000000000001' }}",
        },
        userId: {
            __rl: true,
            mode: 'id',
            value: "={{ $('First join?').first().json.user_id }}",
        },
        role: ['100000000000000010'],
    };

    @node({
        id: '99234657-a229-41b2-a4fa-81f0ea228f12',
        name: 'Welcome them',
        type: 'n8n-nodes-base.discord',
        version: 2,
        position: [2080, 270],
        credentials: { discordBotApi: { id: '__CRED:discord__', name: 'Discord' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    WelcomeThem = {
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
            value: "={{ '100000000000000002' }}",
        },
        content:
            "={{ 'Welcome <@' + $('First join?').first().json.user_id + '>! Start in #introductions, and read #rules before posting.' }}",
        options: {},
    };

    @node({
        id: '5e0c8e26-6be8-4648-a7bc-de87547925fb',
        name: 'Ignore bots',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [780, 270],
    })
    IgnoreBots = {};

    @node({
        id: 'dee8a18f-0d90-45db-a501-62c0fecef08f',
        name: 'Rejoined',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1300, 270],
    })
    Rejoined = {};

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.MemberJoined.out(0).to(this.ReadTheMember.in(0));
        this.ReadTheMember.out(0).to(this.APerson.in(0));
        this.APerson.out(0).to(this.SeenBefore.in(0));
        this.APerson.out(1).to(this.IgnoreBots.in(0));
        this.SeenBefore.out(0).to(this.FirstJoin.in(0));
        this.FirstJoin.out(0).to(this.SaveTheMember.in(0));
        this.FirstJoin.out(1).to(this.Rejoined.in(0));
        this.SaveTheMember.out(0).to(this.BrandNewAccount.in(0));
        this.BrandNewAccount.out(0).to(this.ReviewMessage.in(0));
        this.BrandNewAccount.out(1).to(this.GiveStarterRole.in(0));
        this.ReviewMessage.out(0).to(this.AskAModerator.in(0));
        this.GiveStarterRole.out(0).to(this.WelcomeThem.in(0));
    }
}
