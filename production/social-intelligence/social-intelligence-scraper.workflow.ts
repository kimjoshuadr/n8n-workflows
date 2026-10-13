import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Social intelligence · Omnichannel scraper
// Nodes   : 53  |  Connections: 54
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// SectionInstagram                   stickyNote
// SectionX                           stickyNote
// SectionTiktok                      stickyNote
// SectionYoutube                     stickyNote
// SectionFacebook                    stickyNote
// Schedule                           scheduleTrigger
// SetInstagramAccounts               set
// ScrapePost                         apify                      [creds] [retry]
// SwitchAccounts1                    switch
// CreateRow1                         googleSheets               [creds] [retry]
// CreateRow2                         googleSheets               [creds] [retry]
// CreateRow3                         googleSheets               [creds] [retry]
// CreateRow4                         googleSheets               [creds] [retry]
// CreateRow5                         googleSheets               [creds] [retry]
// CreateRow6                         googleSheets               [creds] [retry]
// ScrapeReel                         apify                      [creds] [retry]
// Abort                              httpRequest                [creds] [retry]
// GetDataset1                        apify                      [creds] [retry]
// SwitchAccounts2                    switch
// CreateRow7                         googleSheets               [creds] [retry]
// CreateRow8                         googleSheets               [creds] [retry]
// CreateRow9                         googleSheets               [creds] [retry]
// CreateRow10                        googleSheets               [creds] [retry]
// CreateRow11                        googleSheets               [creds] [retry]
// CreateRow12                        googleSheets               [creds] [retry]
// SetXAccounts                       set
// SplitAccounts1                     splitOut
// ForEachAccount1                    splitInBatches
// ScrapeTweet                        apify                      [creds] [alwaysOutput] [retry]
// SwitchAccounts3                    switch
// CreateRow13                        googleSheets               [creds] [retry]
// CreateRow14                        googleSheets               [creds] [retry]
// SetTiktokAccounts                  set
// ScrapeTiktok                       apify                      [creds] [retry]
// CreateRow15                        googleSheets               [creds] [retry]
// SetYoutubeAccounts                 set
// ScrapeYt                           apify                      [creds] [retry]
// SwitchAccounts4                    switch
// CreateRow16                        googleSheets               [creds] [retry]
// CreateRow17                        googleSheets               [creds] [retry]
// SetFacebookAccounts                set
// SplitAccounts2                     splitOut
// ForEachAccount2                    splitInBatches
// ScrapeFb                           apify                      [creds] [retry]
// Abort1                             httpRequest                [creds] [retry]
// GetDataset2                        apify                      [creds] [alwaysOutput] [retry]
// SetPostdate                        set
// SwitchAccounts5                    switch
// CreateRow18                        googleSheets               [creds] [retry]
// CreateRow19                        googleSheets               [creds] [retry]
// CreateRow20                        googleSheets               [creds] [retry]
// CreateRow21                        googleSheets               [creds] [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Schedule
//    → SetInstagramAccounts
//      → ScrapePost
//        → SwitchAccounts1
//          → CreateRow1
//         .out(1) → CreateRow2
//         .out(2) → CreateRow3
//         .out(3) → CreateRow4
//         .out(4) → CreateRow5
//         .out(5) → CreateRow6
//      → ScrapeReel
//        → Abort
//          → GetDataset1
//            → SwitchAccounts2
//              → CreateRow7
//             .out(1) → CreateRow8
//             .out(2) → CreateRow9
//             .out(3) → CreateRow10
//             .out(4) → CreateRow11
//             .out(5) → CreateRow12
//    → SetXAccounts
//      → SplitAccounts1
//        → ForEachAccount1
//         .out(1) → ScrapeTweet
//            → SwitchAccounts3
//              → CreateRow13
//                → ForEachAccount1 (↩ loop)
//             .out(1) → CreateRow14
//                → ForEachAccount1 (↩ loop)
//             .out(2) → ForEachAccount1 (↩ loop)
//    → SetTiktokAccounts
//      → ScrapeTiktok
//        → CreateRow15
//    → SetYoutubeAccounts
//      → ScrapeYt
//        → SwitchAccounts4
//          → CreateRow16
//         .out(1) → CreateRow17
//    → SetFacebookAccounts
//      → SplitAccounts2
//        → ForEachAccount2
//         .out(1) → ScrapeFb
//            → Abort1
//              → GetDataset2
//                → SetPostdate
//                  → SwitchAccounts5
//                    → CreateRow18
//                      → ForEachAccount2 (↩ loop)
//                   .out(1) → CreateRow19
//                      → ForEachAccount2 (↩ loop)
//                   .out(2) → CreateRow20
//                      → ForEachAccount2 (↩ loop)
//                   .out(3) → CreateRow21
//                      → ForEachAccount2 (↩ loop)
//                   .out(4) → ForEachAccount2 (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Social intelligence · Omnichannel scraper',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class SocialIntelligenceOmnichannelScraperWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'fc72d132-1355-4f96-a1d3-8a2d4fa060b8',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -220],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Social intelligence · Omnichannel scraper
Every morning, Apify tasks collect posts from Instagram (posts and reels), X, TikTok, YouTube and Facebook for the brand's own accounts and its competitors'. Each post is routed by account and written to that account's Google Sheet, which is the source a Tableau dashboard reads.

**Platforms:** Apify, Google Sheets
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`production/social-intelligence\``,
    };

    @node({
        id: 'e630e65b-d454-4ebe-aa6f-9d6341b635a2',
        name: 'Section: Instagram',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 0],
    })
    SectionInstagram = {
        width: 1940,
        height: 1410,
        color: 4,
        content: `## 1. Instagram
Posts in one Apify task, reels in another. Each is sorted by account.`,
    };

    @node({
        id: 'ff3d7472-b37d-4c16-ad90-477795aa00d3',
        name: 'Section: X',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 1490],
    })
    SectionX = {
        width: 1680,
        height: 510,
        color: 5,
        content: `## 2. X
One account per pass.`,
    };

    @node({
        id: '82e5c502-fe4b-49aa-abda-9ffdff62e86b',
        name: 'Section: TikTok',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 2080],
    })
    SectionTiktok = {
        width: 900,
        height: 330,
        color: 6,
        content: '## 3. TikTok',
    };

    @node({
        id: 'e493462c-2328-4a13-a517-55242ca24f44',
        name: 'Section: YouTube',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 2490],
    })
    SectionYoutube = {
        width: 1160,
        height: 510,
        color: 3,
        content: '## 4. YouTube',
    };

    @node({
        id: '4cc9af94-01bd-4c26-a1b7-5bf5ce6b189e',
        name: 'Section: Facebook',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 3080],
    })
    SectionFacebook = {
        width: 2460,
        height: 870,
        color: 7,
        content: `## 5. Facebook
One page per pass. The post date is normalised before it is written.`,
    };

    @node({
        id: '23afa7f9-da37-48a5-a92f-9d056f04e475',
        name: 'schedule',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 740],
    })
    Schedule = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 6 * * *',
                },
            ],
        },
    };

    @node({
        id: '55105b6c-98f7-4517-a340-beda53dbe532',
        name: 'set_instagram_accounts',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [260, 740],
    })
    SetInstagramAccounts = {
        assignments: {
            assignments: [
                {
                    id: 'b2d2dd6d-def1-4fed-ad24-30e7aabb1427',
                    name: 'accounts',
                    value: "={{ ['ourbrand', 'rival_one', 'rival_two', 'rival_three', 'rival_four', 'rival_five'] }}",
                    type: 'array',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: 'a04cd22b-adc4-4715-a797-788f2334c846',
        name: 'scrape_post',
        type: '@apify/n8n-nodes-apify.apify',
        version: 2,
        position: [520, 650],
        credentials: { apifyApi: { id: '__CRED:apify__', name: 'Apify' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ScrapePost = {
        resource: 'Actor tasks',
        operation: 'Run task and get dataset',
        actorTaskId: 'acme~instagram-posts',
        useCustomBody: true,
        customBody: '={{ JSON.stringify({ username: $json.accounts, resultsLimit: 30 }) }}',
    };

    @node({
        id: 'dfd4eef6-9bf2-49d2-aeac-227648ae7ff6',
        name: 'switch_accounts_1',
        type: 'n8n-nodes-base.switch',
        version: 3.2,
        position: [780, 650],
    })
    SwitchAccounts1 = {
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
                                id: '2a5bb28b-06e9-489a-a8fd-924c3967f95b',
                                leftValue: "={{ String($json.ownerUsername ?? '').toLowerCase() === 'ourbrand' }}",
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
                    outputKey: 'ourbrand',
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
                                id: 'efc97750-38e2-4a18-af3e-c6d5a8d2cffa',
                                leftValue: "={{ String($json.ownerUsername ?? '').toLowerCase() === 'rival_one' }}",
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
                    outputKey: 'rival_one',
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
                                id: '4591bee5-d0f6-4926-ae78-ffc669806bf6',
                                leftValue: "={{ String($json.ownerUsername ?? '').toLowerCase() === 'rival_two' }}",
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
                    outputKey: 'rival_two',
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
                                id: 'f58db272-5e58-4430-a15a-69d28b934ee2',
                                leftValue: "={{ String($json.ownerUsername ?? '').toLowerCase() === 'rival_three' }}",
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
                    outputKey: 'rival_three',
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
                                id: '6bb7ecea-c122-4db3-a0c2-3e3d1e2b1c71',
                                leftValue: "={{ String($json.ownerUsername ?? '').toLowerCase() === 'rival_four' }}",
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
                    outputKey: 'rival_four',
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
                                id: '7a0b6272-2e29-4332-a82c-ebd05dc69548',
                                leftValue: "={{ String($json.ownerUsername ?? '').toLowerCase() === 'rival_five' }}",
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
                    outputKey: 'rival_five',
                },
            ],
        },
        options: {
            fallbackOutput: 'extra',
        },
    };

    @node({
        id: '0bc7a71f-9362-4eff-ab22-1e74304cecc0',
        name: 'create_row_1',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [1040, 200],
        credentials: { googleSheetsOAuth2Api: { id: '__CRED:googleSheets__', name: 'Google Sheets' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateRow1 = {
        resource: 'sheet',
        operation: 'appendOrUpdate',
        documentId: {
            __rl: true,
            mode: 'id',
            value: 'social-ourbrand',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'Instagram posts',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                url: '={{ $json.url }}',
                account: '={{ $json.ownerUsername }}',
                text: "={{ String($json.caption ?? '').slice(0, 500) }}",
                likes: '={{ $json.likesCount ?? 0 }}',
                comments: '={{ $json.commentsCount ?? 0 }}',
                views: "={{ '' }}",
                posted: "={{ $json.timestamp ?? '' }}",
            },
            matchingColumns: ['url'],
            schema: [
                {
                    id: 'url',
                    displayName: 'url',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'account',
                    displayName: 'account',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'text',
                    displayName: 'text',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'likes',
                    displayName: 'likes',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'comments',
                    displayName: 'comments',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'views',
                    displayName: 'views',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'posted',
                    displayName: 'posted',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
            ],
        },
        options: {},
    };

    @node({
        id: '61576c83-19d7-4b68-ac24-6e426749c05c',
        name: 'create_row_2',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [1040, 380],
        credentials: { googleSheetsOAuth2Api: { id: '__CRED:googleSheets__', name: 'Google Sheets' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateRow2 = {
        resource: 'sheet',
        operation: 'appendOrUpdate',
        documentId: {
            __rl: true,
            mode: 'id',
            value: 'social-rival_one',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'Instagram posts',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                url: '={{ $json.url }}',
                account: '={{ $json.ownerUsername }}',
                text: "={{ String($json.caption ?? '').slice(0, 500) }}",
                likes: '={{ $json.likesCount ?? 0 }}',
                comments: '={{ $json.commentsCount ?? 0 }}',
                views: "={{ '' }}",
                posted: "={{ $json.timestamp ?? '' }}",
            },
            matchingColumns: ['url'],
            schema: [
                {
                    id: 'url',
                    displayName: 'url',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'account',
                    displayName: 'account',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'text',
                    displayName: 'text',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'likes',
                    displayName: 'likes',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'comments',
                    displayName: 'comments',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'views',
                    displayName: 'views',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'posted',
                    displayName: 'posted',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
            ],
        },
        options: {},
    };

    @node({
        id: 'b26d02e0-d8fd-48fe-abf9-e0e7f0ffeaf0',
        name: 'create_row_3',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [1040, 560],
        credentials: { googleSheetsOAuth2Api: { id: '__CRED:googleSheets__', name: 'Google Sheets' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateRow3 = {
        resource: 'sheet',
        operation: 'appendOrUpdate',
        documentId: {
            __rl: true,
            mode: 'id',
            value: 'social-rival_two',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'Instagram posts',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                url: '={{ $json.url }}',
                account: '={{ $json.ownerUsername }}',
                text: "={{ String($json.caption ?? '').slice(0, 500) }}",
                likes: '={{ $json.likesCount ?? 0 }}',
                comments: '={{ $json.commentsCount ?? 0 }}',
                views: "={{ '' }}",
                posted: "={{ $json.timestamp ?? '' }}",
            },
            matchingColumns: ['url'],
            schema: [
                {
                    id: 'url',
                    displayName: 'url',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'account',
                    displayName: 'account',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'text',
                    displayName: 'text',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'likes',
                    displayName: 'likes',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'comments',
                    displayName: 'comments',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'views',
                    displayName: 'views',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'posted',
                    displayName: 'posted',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
            ],
        },
        options: {},
    };

    @node({
        id: '3adf58d8-1614-4923-a49b-c49658da60e6',
        name: 'create_row_4',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [1040, 740],
        credentials: { googleSheetsOAuth2Api: { id: '__CRED:googleSheets__', name: 'Google Sheets' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateRow4 = {
        resource: 'sheet',
        operation: 'appendOrUpdate',
        documentId: {
            __rl: true,
            mode: 'id',
            value: 'social-rival_three',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'Instagram posts',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                url: '={{ $json.url }}',
                account: '={{ $json.ownerUsername }}',
                text: "={{ String($json.caption ?? '').slice(0, 500) }}",
                likes: '={{ $json.likesCount ?? 0 }}',
                comments: '={{ $json.commentsCount ?? 0 }}',
                views: "={{ '' }}",
                posted: "={{ $json.timestamp ?? '' }}",
            },
            matchingColumns: ['url'],
            schema: [
                {
                    id: 'url',
                    displayName: 'url',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'account',
                    displayName: 'account',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'text',
                    displayName: 'text',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'likes',
                    displayName: 'likes',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'comments',
                    displayName: 'comments',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'views',
                    displayName: 'views',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'posted',
                    displayName: 'posted',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
            ],
        },
        options: {},
    };

    @node({
        id: '30251aa4-f8f3-4c34-ad11-72b46edfa149',
        name: 'create_row_5',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [1040, 920],
        credentials: { googleSheetsOAuth2Api: { id: '__CRED:googleSheets__', name: 'Google Sheets' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateRow5 = {
        resource: 'sheet',
        operation: 'appendOrUpdate',
        documentId: {
            __rl: true,
            mode: 'id',
            value: 'social-rival_four',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'Instagram posts',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                url: '={{ $json.url }}',
                account: '={{ $json.ownerUsername }}',
                text: "={{ String($json.caption ?? '').slice(0, 500) }}",
                likes: '={{ $json.likesCount ?? 0 }}',
                comments: '={{ $json.commentsCount ?? 0 }}',
                views: "={{ '' }}",
                posted: "={{ $json.timestamp ?? '' }}",
            },
            matchingColumns: ['url'],
            schema: [
                {
                    id: 'url',
                    displayName: 'url',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'account',
                    displayName: 'account',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'text',
                    displayName: 'text',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'likes',
                    displayName: 'likes',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'comments',
                    displayName: 'comments',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'views',
                    displayName: 'views',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'posted',
                    displayName: 'posted',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
            ],
        },
        options: {},
    };

    @node({
        id: '1e208669-e254-482b-a376-1b4b2ed47e55',
        name: 'create_row_6',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [1040, 1100],
        credentials: { googleSheetsOAuth2Api: { id: '__CRED:googleSheets__', name: 'Google Sheets' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateRow6 = {
        resource: 'sheet',
        operation: 'appendOrUpdate',
        documentId: {
            __rl: true,
            mode: 'id',
            value: 'social-rival_five',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'Instagram posts',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                url: '={{ $json.url }}',
                account: '={{ $json.ownerUsername }}',
                text: "={{ String($json.caption ?? '').slice(0, 500) }}",
                likes: '={{ $json.likesCount ?? 0 }}',
                comments: '={{ $json.commentsCount ?? 0 }}',
                views: "={{ '' }}",
                posted: "={{ $json.timestamp ?? '' }}",
            },
            matchingColumns: ['url'],
            schema: [
                {
                    id: 'url',
                    displayName: 'url',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'account',
                    displayName: 'account',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'text',
                    displayName: 'text',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'likes',
                    displayName: 'likes',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'comments',
                    displayName: 'comments',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'views',
                    displayName: 'views',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'posted',
                    displayName: 'posted',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
            ],
        },
        options: {},
    };

    @node({
        id: '0143be77-349f-4955-a9a5-0dc40c3bca65',
        name: 'scrape_reel',
        type: '@apify/n8n-nodes-apify.apify',
        version: 2,
        position: [520, 830],
        credentials: { apifyApi: { id: '__CRED:apify__', name: 'Apify' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ScrapeReel = {
        resource: 'Actor tasks',
        operation: 'Run task',
        actorTaskId: 'acme~instagram-reels',
        waitForFinish: true,
        timeout: 600,
        useCustomBody: true,
        customBody: '={{ JSON.stringify({ username: $json.accounts, resultsLimit: 30 }) }}',
    };

    @node({
        id: '7b6ec867-2871-4aa4-a9e4-c8ab1e5c29cc',
        name: 'abort',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [780, 830],
        credentials: { apifyApi: { id: '__CRED:apify__', name: 'Apify' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    Abort = {
        method: 'POST',
        url: "={{ 'https://api.apify.com/v2/actor-runs/' + $json.id + '/abort' }}",
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'apifyApi',
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: 'f681d19d-0bd4-48da-afcc-5e16bdacadcb',
        name: 'get_dataset_1',
        type: '@apify/n8n-nodes-apify.apify',
        version: 2,
        position: [1040, 1280],
        credentials: { apifyApi: { id: '__CRED:apify__', name: 'Apify' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetDataset1 = {
        resource: 'Datasets',
        operation: 'Get items',
        datasetId: "={{ $('scrape_reel').first().json.defaultDatasetId }}",
        offset: 0,
        limit: 200,
        options: {},
    };

    @node({
        id: 'f8cc90ec-d811-448f-aa92-82c5d57baea2',
        name: 'switch_accounts_2',
        type: 'n8n-nodes-base.switch',
        version: 3.2,
        position: [1300, 740],
    })
    SwitchAccounts2 = {
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
                                id: 'ac90b790-a425-46e2-a49f-e69aeee0da45',
                                leftValue: "={{ String($json.ownerUsername ?? '').toLowerCase() === 'ourbrand' }}",
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
                    outputKey: 'ourbrand',
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
                                id: 'a0801d3d-50ac-4564-acac-601a7cca6dbd',
                                leftValue: "={{ String($json.ownerUsername ?? '').toLowerCase() === 'rival_one' }}",
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
                    outputKey: 'rival_one',
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
                                id: '1995c20e-82b7-42b4-a983-e1491ac23ba8',
                                leftValue: "={{ String($json.ownerUsername ?? '').toLowerCase() === 'rival_two' }}",
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
                    outputKey: 'rival_two',
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
                                id: 'fc82cba6-5a77-438e-ab36-3b959c0825c2',
                                leftValue: "={{ String($json.ownerUsername ?? '').toLowerCase() === 'rival_three' }}",
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
                    outputKey: 'rival_three',
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
                                id: 'a9bb9319-a45f-49de-a526-ad0ed4e4f392',
                                leftValue: "={{ String($json.ownerUsername ?? '').toLowerCase() === 'rival_four' }}",
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
                    outputKey: 'rival_four',
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
                                id: '2c11e545-7e20-4c90-a572-64ab94e6f8d2',
                                leftValue: "={{ String($json.ownerUsername ?? '').toLowerCase() === 'rival_five' }}",
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
                    outputKey: 'rival_five',
                },
            ],
        },
        options: {
            fallbackOutput: 'extra',
        },
    };

    @node({
        id: 'afcf3081-a4d8-4346-a31a-59767a809588',
        name: 'create_row_7',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [1560, 290],
        credentials: { googleSheetsOAuth2Api: { id: '__CRED:googleSheets__', name: 'Google Sheets' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateRow7 = {
        resource: 'sheet',
        operation: 'appendOrUpdate',
        documentId: {
            __rl: true,
            mode: 'id',
            value: 'social-ourbrand',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'Instagram reels',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                url: '={{ $json.url }}',
                account: '={{ $json.ownerUsername }}',
                text: "={{ String($json.caption ?? '').slice(0, 500) }}",
                likes: '={{ $json.likesCount ?? 0 }}',
                comments: '={{ $json.commentsCount ?? 0 }}',
                views: '={{ $json.videoViewCount ?? 0 }}',
                posted: "={{ $json.timestamp ?? '' }}",
            },
            matchingColumns: ['url'],
            schema: [
                {
                    id: 'url',
                    displayName: 'url',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'account',
                    displayName: 'account',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'text',
                    displayName: 'text',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'likes',
                    displayName: 'likes',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'comments',
                    displayName: 'comments',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'views',
                    displayName: 'views',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'posted',
                    displayName: 'posted',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
            ],
        },
        options: {},
    };

    @node({
        id: '1f85af06-6acf-4808-a5ad-fbe14d424f0d',
        name: 'create_row_8',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [1560, 470],
        credentials: { googleSheetsOAuth2Api: { id: '__CRED:googleSheets__', name: 'Google Sheets' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateRow8 = {
        resource: 'sheet',
        operation: 'appendOrUpdate',
        documentId: {
            __rl: true,
            mode: 'id',
            value: 'social-rival_one',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'Instagram reels',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                url: '={{ $json.url }}',
                account: '={{ $json.ownerUsername }}',
                text: "={{ String($json.caption ?? '').slice(0, 500) }}",
                likes: '={{ $json.likesCount ?? 0 }}',
                comments: '={{ $json.commentsCount ?? 0 }}',
                views: '={{ $json.videoViewCount ?? 0 }}',
                posted: "={{ $json.timestamp ?? '' }}",
            },
            matchingColumns: ['url'],
            schema: [
                {
                    id: 'url',
                    displayName: 'url',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'account',
                    displayName: 'account',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'text',
                    displayName: 'text',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'likes',
                    displayName: 'likes',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'comments',
                    displayName: 'comments',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'views',
                    displayName: 'views',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'posted',
                    displayName: 'posted',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
            ],
        },
        options: {},
    };

    @node({
        id: '0aa9beb2-1b4d-4611-ad32-96605d13a2a9',
        name: 'create_row_9',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [1560, 650],
        credentials: { googleSheetsOAuth2Api: { id: '__CRED:googleSheets__', name: 'Google Sheets' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateRow9 = {
        resource: 'sheet',
        operation: 'appendOrUpdate',
        documentId: {
            __rl: true,
            mode: 'id',
            value: 'social-rival_two',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'Instagram reels',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                url: '={{ $json.url }}',
                account: '={{ $json.ownerUsername }}',
                text: "={{ String($json.caption ?? '').slice(0, 500) }}",
                likes: '={{ $json.likesCount ?? 0 }}',
                comments: '={{ $json.commentsCount ?? 0 }}',
                views: '={{ $json.videoViewCount ?? 0 }}',
                posted: "={{ $json.timestamp ?? '' }}",
            },
            matchingColumns: ['url'],
            schema: [
                {
                    id: 'url',
                    displayName: 'url',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'account',
                    displayName: 'account',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'text',
                    displayName: 'text',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'likes',
                    displayName: 'likes',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'comments',
                    displayName: 'comments',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'views',
                    displayName: 'views',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'posted',
                    displayName: 'posted',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
            ],
        },
        options: {},
    };

    @node({
        id: '3ddcdfc2-e8ec-4920-adc6-97f7a4631a0b',
        name: 'create_row_10',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [1560, 830],
        credentials: { googleSheetsOAuth2Api: { id: '__CRED:googleSheets__', name: 'Google Sheets' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateRow10 = {
        resource: 'sheet',
        operation: 'appendOrUpdate',
        documentId: {
            __rl: true,
            mode: 'id',
            value: 'social-rival_three',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'Instagram reels',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                url: '={{ $json.url }}',
                account: '={{ $json.ownerUsername }}',
                text: "={{ String($json.caption ?? '').slice(0, 500) }}",
                likes: '={{ $json.likesCount ?? 0 }}',
                comments: '={{ $json.commentsCount ?? 0 }}',
                views: '={{ $json.videoViewCount ?? 0 }}',
                posted: "={{ $json.timestamp ?? '' }}",
            },
            matchingColumns: ['url'],
            schema: [
                {
                    id: 'url',
                    displayName: 'url',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'account',
                    displayName: 'account',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'text',
                    displayName: 'text',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'likes',
                    displayName: 'likes',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'comments',
                    displayName: 'comments',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'views',
                    displayName: 'views',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'posted',
                    displayName: 'posted',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
            ],
        },
        options: {},
    };

    @node({
        id: '4775febc-aa83-48c4-a9ce-f650e713ffa9',
        name: 'create_row_11',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [1560, 1010],
        credentials: { googleSheetsOAuth2Api: { id: '__CRED:googleSheets__', name: 'Google Sheets' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateRow11 = {
        resource: 'sheet',
        operation: 'appendOrUpdate',
        documentId: {
            __rl: true,
            mode: 'id',
            value: 'social-rival_four',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'Instagram reels',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                url: '={{ $json.url }}',
                account: '={{ $json.ownerUsername }}',
                text: "={{ String($json.caption ?? '').slice(0, 500) }}",
                likes: '={{ $json.likesCount ?? 0 }}',
                comments: '={{ $json.commentsCount ?? 0 }}',
                views: '={{ $json.videoViewCount ?? 0 }}',
                posted: "={{ $json.timestamp ?? '' }}",
            },
            matchingColumns: ['url'],
            schema: [
                {
                    id: 'url',
                    displayName: 'url',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'account',
                    displayName: 'account',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'text',
                    displayName: 'text',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'likes',
                    displayName: 'likes',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'comments',
                    displayName: 'comments',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'views',
                    displayName: 'views',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'posted',
                    displayName: 'posted',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
            ],
        },
        options: {},
    };

    @node({
        id: 'd68baa72-89d5-4b25-a064-34be3c9b2f52',
        name: 'create_row_12',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [1560, 1190],
        credentials: { googleSheetsOAuth2Api: { id: '__CRED:googleSheets__', name: 'Google Sheets' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateRow12 = {
        resource: 'sheet',
        operation: 'appendOrUpdate',
        documentId: {
            __rl: true,
            mode: 'id',
            value: 'social-rival_five',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'Instagram reels',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                url: '={{ $json.url }}',
                account: '={{ $json.ownerUsername }}',
                text: "={{ String($json.caption ?? '').slice(0, 500) }}",
                likes: '={{ $json.likesCount ?? 0 }}',
                comments: '={{ $json.commentsCount ?? 0 }}',
                views: '={{ $json.videoViewCount ?? 0 }}',
                posted: "={{ $json.timestamp ?? '' }}",
            },
            matchingColumns: ['url'],
            schema: [
                {
                    id: 'url',
                    displayName: 'url',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'account',
                    displayName: 'account',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'text',
                    displayName: 'text',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'likes',
                    displayName: 'likes',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'comments',
                    displayName: 'comments',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'views',
                    displayName: 'views',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'posted',
                    displayName: 'posted',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
            ],
        },
        options: {},
    };

    @node({
        id: 'b097b1dc-c0d4-4d3d-aeb9-002d82ad1e87',
        name: 'set_x_accounts',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [0, 1780],
    })
    SetXAccounts = {
        assignments: {
            assignments: [
                {
                    id: '6c1c46cc-64f6-42f0-aea4-a0f52ce372b0',
                    name: 'accounts',
                    value: "={{ ['ourbrand', 'rival_one'] }}",
                    type: 'array',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '416b9dc3-eb73-4041-a673-310f8e38c527',
        name: 'split_accounts_1',
        type: 'n8n-nodes-base.splitOut',
        version: 1,
        position: [260, 1780],
    })
    SplitAccounts1 = {
        fieldToSplitOut: 'accounts',
        options: {},
    };

    @node({
        id: 'eaeb1254-cbea-4cbb-a996-17b7167c081f',
        name: 'for_each_account_1',
        type: 'n8n-nodes-base.splitInBatches',
        version: 3,
        position: [520, 1780],
    })
    ForEachAccount1 = {
        batchSize: 1,
        options: {},
    };

    @node({
        id: '1ffbe1a6-c99a-4b06-ad1f-11b4a9452b24',
        name: 'scrape_tweet',
        type: '@apify/n8n-nodes-apify.apify',
        version: 2,
        position: [780, 1780],
        credentials: { apifyApi: { id: '__CRED:apify__', name: 'Apify' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ScrapeTweet = {
        resource: 'Actor tasks',
        operation: 'Run task and get dataset',
        actorTaskId: 'acme~x-posts',
        useCustomBody: true,
        customBody: '={{ JSON.stringify({ twitterHandles: [$json.accounts], maxItems: 50 }) }}',
    };

    @node({
        id: 'dd458f11-cb3d-4760-ad9d-308eb73baf07',
        name: 'switch_accounts_3',
        type: 'n8n-nodes-base.switch',
        version: 3.2,
        position: [1040, 1780],
    })
    SwitchAccounts3 = {
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
                                id: '68b76e2e-0ace-4fb3-a626-ddb5776d6bf8',
                                leftValue: "={{ String($json.author?.userName ?? '').toLowerCase() === 'ourbrand' }}",
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
                    outputKey: 'ourbrand',
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
                                id: 'a63126ac-8da1-4862-a2e6-bca6267011fd',
                                leftValue: "={{ String($json.author?.userName ?? '').toLowerCase() === 'rival_one' }}",
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
                    outputKey: 'rival_one',
                },
            ],
        },
        options: {
            fallbackOutput: 'extra',
        },
    };

    @node({
        id: 'bb385192-3f61-4a93-abca-7bfc6f5b6469',
        name: 'create_row_13',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [1300, 1690],
        credentials: { googleSheetsOAuth2Api: { id: '__CRED:googleSheets__', name: 'Google Sheets' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateRow13 = {
        resource: 'sheet',
        operation: 'appendOrUpdate',
        documentId: {
            __rl: true,
            mode: 'id',
            value: 'social-ourbrand',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'X posts',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                url: '={{ $json.url }}',
                account: '={{ $json.author.userName }}',
                text: "={{ String($json.text ?? '').slice(0, 500) }}",
                likes: '={{ $json.likeCount ?? 0 }}',
                comments: '={{ $json.replyCount ?? 0 }}',
                views: '={{ $json.viewCount ?? 0 }}',
                posted: "={{ $json.createdAt ?? '' }}",
            },
            matchingColumns: ['url'],
            schema: [
                {
                    id: 'url',
                    displayName: 'url',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'account',
                    displayName: 'account',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'text',
                    displayName: 'text',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'likes',
                    displayName: 'likes',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'comments',
                    displayName: 'comments',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'views',
                    displayName: 'views',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'posted',
                    displayName: 'posted',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
            ],
        },
        options: {},
    };

    @node({
        id: '467b32c9-7994-4946-ab23-c77a3e66e283',
        name: 'create_row_14',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [1300, 1870],
        credentials: { googleSheetsOAuth2Api: { id: '__CRED:googleSheets__', name: 'Google Sheets' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateRow14 = {
        resource: 'sheet',
        operation: 'appendOrUpdate',
        documentId: {
            __rl: true,
            mode: 'id',
            value: 'social-rival_one',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'X posts',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                url: '={{ $json.url }}',
                account: '={{ $json.author.userName }}',
                text: "={{ String($json.text ?? '').slice(0, 500) }}",
                likes: '={{ $json.likeCount ?? 0 }}',
                comments: '={{ $json.replyCount ?? 0 }}',
                views: '={{ $json.viewCount ?? 0 }}',
                posted: "={{ $json.createdAt ?? '' }}",
            },
            matchingColumns: ['url'],
            schema: [
                {
                    id: 'url',
                    displayName: 'url',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'account',
                    displayName: 'account',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'text',
                    displayName: 'text',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'likes',
                    displayName: 'likes',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'comments',
                    displayName: 'comments',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'views',
                    displayName: 'views',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'posted',
                    displayName: 'posted',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
            ],
        },
        options: {},
    };

    @node({
        id: 'd00fdacb-b60d-439f-ab7d-ca2db58e1848',
        name: 'set_tiktok_accounts',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [0, 2280],
    })
    SetTiktokAccounts = {
        assignments: {
            assignments: [
                {
                    id: '46a78bbe-9c07-495c-afac-dfef1963c5d0',
                    name: 'accounts',
                    value: "={{ ['ourbrand'] }}",
                    type: 'array',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '7f29714d-6ff2-4cbf-a802-180461f0ac2e',
        name: 'scrape_tiktok',
        type: '@apify/n8n-nodes-apify.apify',
        version: 2,
        position: [260, 2280],
        credentials: { apifyApi: { id: '__CRED:apify__', name: 'Apify' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ScrapeTiktok = {
        resource: 'Actor tasks',
        operation: 'Run task and get dataset',
        actorTaskId: 'acme~tiktok-videos',
        useCustomBody: true,
        customBody: '={{ JSON.stringify({ profiles: $json.accounts, resultsPerPage: 30 }) }}',
    };

    @node({
        id: 'ed092f24-e7ba-4640-af5a-455e1dc3e264',
        name: 'create_row_15',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [520, 2280],
        credentials: { googleSheetsOAuth2Api: { id: '__CRED:googleSheets__', name: 'Google Sheets' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateRow15 = {
        resource: 'sheet',
        operation: 'appendOrUpdate',
        documentId: {
            __rl: true,
            mode: 'id',
            value: 'social-ourbrand',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'TikTok videos',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                url: '={{ $json.webVideoUrl }}',
                account: "={{ $json.authorMeta?.name ?? '' }}",
                text: "={{ String($json.text ?? '').slice(0, 500) }}",
                likes: '={{ $json.diggCount ?? 0 }}',
                comments: '={{ $json.commentCount ?? 0 }}',
                views: '={{ $json.playCount ?? 0 }}',
                posted: "={{ $json.createTimeISO ?? '' }}",
            },
            matchingColumns: ['url'],
            schema: [
                {
                    id: 'url',
                    displayName: 'url',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'account',
                    displayName: 'account',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'text',
                    displayName: 'text',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'likes',
                    displayName: 'likes',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'comments',
                    displayName: 'comments',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'views',
                    displayName: 'views',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'posted',
                    displayName: 'posted',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
            ],
        },
        options: {},
    };

    @node({
        id: '289a403b-5dff-43ae-a326-7cd884e08de2',
        name: 'set_youtube_accounts',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [0, 2780],
    })
    SetYoutubeAccounts = {
        assignments: {
            assignments: [
                {
                    id: 'fdbee644-f44f-4a1e-a94c-01ca48ce65dd',
                    name: 'accounts',
                    value: "={{ ['ourbrand', 'rival_one'] }}",
                    type: 'array',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '062a60ec-c0a4-496b-a37b-c0da536a7041',
        name: 'scrape_yt',
        type: '@apify/n8n-nodes-apify.apify',
        version: 2,
        position: [260, 2780],
        credentials: { apifyApi: { id: '__CRED:apify__', name: 'Apify' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ScrapeYt = {
        resource: 'Actor tasks',
        operation: 'Run task and get dataset',
        actorTaskId: 'acme~youtube-videos',
        useCustomBody: true,
        customBody: '={{ JSON.stringify({ channels: $json.accounts, maxResults: 30 }) }}',
    };

    @node({
        id: '1c8792bd-91b7-4633-a137-f0c2b42b7e14',
        name: 'switch_accounts_4',
        type: 'n8n-nodes-base.switch',
        version: 3.2,
        position: [520, 2780],
    })
    SwitchAccounts4 = {
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
                                id: 'b16b555e-19ee-4284-a85f-5fd5a0abddf7',
                                leftValue: "={{ String($json.channelUsername ?? '').toLowerCase() === 'ourbrand' }}",
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
                    outputKey: 'ourbrand',
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
                                id: 'c2c3c379-edd2-4b0a-a8f2-2d760246e1b8',
                                leftValue: "={{ String($json.channelUsername ?? '').toLowerCase() === 'rival_one' }}",
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
                    outputKey: 'rival_one',
                },
            ],
        },
        options: {
            fallbackOutput: 'extra',
        },
    };

    @node({
        id: 'da74077c-21c1-4beb-afb8-ba78e238d985',
        name: 'create_row_16',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [780, 2690],
        credentials: { googleSheetsOAuth2Api: { id: '__CRED:googleSheets__', name: 'Google Sheets' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateRow16 = {
        resource: 'sheet',
        operation: 'appendOrUpdate',
        documentId: {
            __rl: true,
            mode: 'id',
            value: 'social-ourbrand',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'YouTube videos',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                url: '={{ $json.url }}',
                account: '={{ $json.channelUsername }}',
                text: "={{ String($json.title ?? '').slice(0, 500) }}",
                likes: '={{ $json.likes ?? 0 }}',
                comments: '={{ $json.commentsCount ?? 0 }}',
                views: '={{ $json.viewCount ?? 0 }}',
                posted: "={{ $json.date ?? '' }}",
            },
            matchingColumns: ['url'],
            schema: [
                {
                    id: 'url',
                    displayName: 'url',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'account',
                    displayName: 'account',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'text',
                    displayName: 'text',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'likes',
                    displayName: 'likes',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'comments',
                    displayName: 'comments',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'views',
                    displayName: 'views',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'posted',
                    displayName: 'posted',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
            ],
        },
        options: {},
    };

    @node({
        id: 'bf880341-8070-4803-a7b7-319627f7ef74',
        name: 'create_row_17',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [780, 2870],
        credentials: { googleSheetsOAuth2Api: { id: '__CRED:googleSheets__', name: 'Google Sheets' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateRow17 = {
        resource: 'sheet',
        operation: 'appendOrUpdate',
        documentId: {
            __rl: true,
            mode: 'id',
            value: 'social-rival_one',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'YouTube videos',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                url: '={{ $json.url }}',
                account: '={{ $json.channelUsername }}',
                text: "={{ String($json.title ?? '').slice(0, 500) }}",
                likes: '={{ $json.likes ?? 0 }}',
                comments: '={{ $json.commentsCount ?? 0 }}',
                views: '={{ $json.viewCount ?? 0 }}',
                posted: "={{ $json.date ?? '' }}",
            },
            matchingColumns: ['url'],
            schema: [
                {
                    id: 'url',
                    displayName: 'url',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'account',
                    displayName: 'account',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'text',
                    displayName: 'text',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'likes',
                    displayName: 'likes',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'comments',
                    displayName: 'comments',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'views',
                    displayName: 'views',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'posted',
                    displayName: 'posted',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
            ],
        },
        options: {},
    };

    @node({
        id: '6c287745-0560-4e1f-a91e-44f3d000cae0',
        name: 'set_facebook_accounts',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [0, 3550],
    })
    SetFacebookAccounts = {
        assignments: {
            assignments: [
                {
                    id: 'fcf21a85-9972-4960-a1ae-5b11cdd882b4',
                    name: 'accounts',
                    value: "={{ ['ourbrand', 'rival_one', 'rival_two', 'rival_three'] }}",
                    type: 'array',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '41ce97de-2d60-4280-afe1-19122b827664',
        name: 'split_accounts_2',
        type: 'n8n-nodes-base.splitOut',
        version: 1,
        position: [260, 3550],
    })
    SplitAccounts2 = {
        fieldToSplitOut: 'accounts',
        options: {},
    };

    @node({
        id: 'f414d843-405c-4511-a9a8-48c81517be19',
        name: 'for_each_account_2',
        type: 'n8n-nodes-base.splitInBatches',
        version: 3,
        position: [520, 3550],
    })
    ForEachAccount2 = {
        batchSize: 1,
        options: {},
    };

    @node({
        id: '5d794e31-78b8-4c2e-ac17-56fb768eb46e',
        name: 'scrape_fb',
        type: '@apify/n8n-nodes-apify.apify',
        version: 2,
        position: [780, 3550],
        credentials: { apifyApi: { id: '__CRED:apify__', name: 'Apify' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ScrapeFb = {
        resource: 'Actor tasks',
        operation: 'Run task',
        actorTaskId: 'acme~facebook-posts',
        waitForFinish: true,
        timeout: 600,
        useCustomBody: true,
        customBody:
            "={{ JSON.stringify({ startUrls: [ { url: 'https://www.facebook.com/' + $json.accounts } ], resultsLimit: 30 }) }}",
    };

    @node({
        id: 'ed2f5cf3-94f4-40d4-a1db-04c2f5aeac14',
        name: 'abort1',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1040, 3550],
        credentials: { apifyApi: { id: '__CRED:apify__', name: 'Apify' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    Abort1 = {
        method: 'POST',
        url: "={{ 'https://api.apify.com/v2/actor-runs/' + $json.id + '/abort' }}",
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'apifyApi',
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: 'e36b8dd1-70b5-4369-aeac-66b9c19c18f2',
        name: 'get_dataset_2',
        type: '@apify/n8n-nodes-apify.apify',
        version: 2,
        position: [1300, 3550],
        credentials: { apifyApi: { id: '__CRED:apify__', name: 'Apify' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetDataset2 = {
        resource: 'Datasets',
        operation: 'Get items',
        datasetId: "={{ $('scrape_fb').first().json.defaultDatasetId }}",
        offset: 0,
        limit: 200,
        options: {},
    };

    @node({
        id: 'cc76ac9f-f692-4faa-ab77-5c3eec9edd90',
        name: 'set_postdate',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [1560, 3550],
    })
    SetPostdate = {
        assignments: {
            assignments: [
                {
                    id: '576c027d-a0b0-4ff3-ac36-67d5f858e4fc',
                    name: 'posted',
                    value: "={{ $json.time ? new Date($json.time).toISOString().slice(0, 10) : '' }}",
                    type: 'string',
                },
            ],
        },
        includeOtherFields: true,
        options: {},
    };

    @node({
        id: '6f5c1c6b-4a86-413a-a70f-0916d0fec322',
        name: 'switch_accounts_5',
        type: 'n8n-nodes-base.switch',
        version: 3.2,
        position: [1820, 3550],
    })
    SwitchAccounts5 = {
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
                                id: '75b675f2-2125-4551-a0fb-48fb54acb765',
                                leftValue: "={{ String($json.pageName ?? '').toLowerCase() === 'ourbrand' }}",
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
                    outputKey: 'ourbrand',
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
                                id: '57925754-3d11-4e84-a45d-8d3e0199c8a7',
                                leftValue: "={{ String($json.pageName ?? '').toLowerCase() === 'rival_one' }}",
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
                    outputKey: 'rival_one',
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
                                id: '622969e0-028d-4c84-afdc-3d0f77bbff70',
                                leftValue: "={{ String($json.pageName ?? '').toLowerCase() === 'rival_two' }}",
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
                    outputKey: 'rival_two',
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
                                id: '8079b10c-62eb-47f0-a411-f82fcb1b7a4b',
                                leftValue: "={{ String($json.pageName ?? '').toLowerCase() === 'rival_three' }}",
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
                    outputKey: 'rival_three',
                },
            ],
        },
        options: {
            fallbackOutput: 'extra',
        },
    };

    @node({
        id: '2dde3cd9-6463-4faf-a1af-d968097daa8e',
        name: 'create_row_18',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [2080, 3280],
        credentials: { googleSheetsOAuth2Api: { id: '__CRED:googleSheets__', name: 'Google Sheets' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateRow18 = {
        resource: 'sheet',
        operation: 'appendOrUpdate',
        documentId: {
            __rl: true,
            mode: 'id',
            value: 'social-ourbrand',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'Facebook posts',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                url: '={{ $json.url }}',
                account: '={{ $json.pageName }}',
                text: "={{ String($json.text ?? '').slice(0, 500) }}",
                likes: '={{ $json.likes ?? 0 }}',
                comments: '={{ $json.comments ?? 0 }}',
                views: "={{ '' }}",
                posted: '={{ $json.posted }}',
            },
            matchingColumns: ['url'],
            schema: [
                {
                    id: 'url',
                    displayName: 'url',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'account',
                    displayName: 'account',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'text',
                    displayName: 'text',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'likes',
                    displayName: 'likes',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'comments',
                    displayName: 'comments',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'views',
                    displayName: 'views',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'posted',
                    displayName: 'posted',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
            ],
        },
        options: {},
    };

    @node({
        id: 'c2e6aaae-c2e7-4dbf-a8f2-21274c7e6981',
        name: 'create_row_19',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [2080, 3460],
        credentials: { googleSheetsOAuth2Api: { id: '__CRED:googleSheets__', name: 'Google Sheets' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateRow19 = {
        resource: 'sheet',
        operation: 'appendOrUpdate',
        documentId: {
            __rl: true,
            mode: 'id',
            value: 'social-rival_one',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'Facebook posts',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                url: '={{ $json.url }}',
                account: '={{ $json.pageName }}',
                text: "={{ String($json.text ?? '').slice(0, 500) }}",
                likes: '={{ $json.likes ?? 0 }}',
                comments: '={{ $json.comments ?? 0 }}',
                views: "={{ '' }}",
                posted: '={{ $json.posted }}',
            },
            matchingColumns: ['url'],
            schema: [
                {
                    id: 'url',
                    displayName: 'url',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'account',
                    displayName: 'account',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'text',
                    displayName: 'text',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'likes',
                    displayName: 'likes',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'comments',
                    displayName: 'comments',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'views',
                    displayName: 'views',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'posted',
                    displayName: 'posted',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
            ],
        },
        options: {},
    };

    @node({
        id: '9517943b-7956-4c53-a9ac-b4ef5abe724b',
        name: 'create_row_20',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [2080, 3640],
        credentials: { googleSheetsOAuth2Api: { id: '__CRED:googleSheets__', name: 'Google Sheets' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateRow20 = {
        resource: 'sheet',
        operation: 'appendOrUpdate',
        documentId: {
            __rl: true,
            mode: 'id',
            value: 'social-rival_two',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'Facebook posts',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                url: '={{ $json.url }}',
                account: '={{ $json.pageName }}',
                text: "={{ String($json.text ?? '').slice(0, 500) }}",
                likes: '={{ $json.likes ?? 0 }}',
                comments: '={{ $json.comments ?? 0 }}',
                views: "={{ '' }}",
                posted: '={{ $json.posted }}',
            },
            matchingColumns: ['url'],
            schema: [
                {
                    id: 'url',
                    displayName: 'url',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'account',
                    displayName: 'account',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'text',
                    displayName: 'text',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'likes',
                    displayName: 'likes',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'comments',
                    displayName: 'comments',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'views',
                    displayName: 'views',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'posted',
                    displayName: 'posted',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
            ],
        },
        options: {},
    };

    @node({
        id: '63068114-bb8b-4032-a85c-848bd5a68a00',
        name: 'create_row_21',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [2080, 3820],
        credentials: { googleSheetsOAuth2Api: { id: '__CRED:googleSheets__', name: 'Google Sheets' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateRow21 = {
        resource: 'sheet',
        operation: 'appendOrUpdate',
        documentId: {
            __rl: true,
            mode: 'id',
            value: 'social-rival_three',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'Facebook posts',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                url: '={{ $json.url }}',
                account: '={{ $json.pageName }}',
                text: "={{ String($json.text ?? '').slice(0, 500) }}",
                likes: '={{ $json.likes ?? 0 }}',
                comments: '={{ $json.comments ?? 0 }}',
                views: "={{ '' }}",
                posted: '={{ $json.posted }}',
            },
            matchingColumns: ['url'],
            schema: [
                {
                    id: 'url',
                    displayName: 'url',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'account',
                    displayName: 'account',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'text',
                    displayName: 'text',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'likes',
                    displayName: 'likes',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'comments',
                    displayName: 'comments',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'views',
                    displayName: 'views',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'posted',
                    displayName: 'posted',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
            ],
        },
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Schedule.out(0).to(this.SetInstagramAccounts.in(0));
        this.Schedule.out(0).to(this.SetXAccounts.in(0));
        this.Schedule.out(0).to(this.SetTiktokAccounts.in(0));
        this.Schedule.out(0).to(this.SetYoutubeAccounts.in(0));
        this.Schedule.out(0).to(this.SetFacebookAccounts.in(0));
        this.SetInstagramAccounts.out(0).to(this.ScrapePost.in(0));
        this.SetInstagramAccounts.out(0).to(this.ScrapeReel.in(0));
        this.ScrapePost.out(0).to(this.SwitchAccounts1.in(0));
        this.SwitchAccounts1.out(0).to(this.CreateRow1.in(0));
        this.SwitchAccounts1.out(1).to(this.CreateRow2.in(0));
        this.SwitchAccounts1.out(2).to(this.CreateRow3.in(0));
        this.SwitchAccounts1.out(3).to(this.CreateRow4.in(0));
        this.SwitchAccounts1.out(4).to(this.CreateRow5.in(0));
        this.SwitchAccounts1.out(5).to(this.CreateRow6.in(0));
        this.ScrapeReel.out(0).to(this.Abort.in(0));
        this.Abort.out(0).to(this.GetDataset1.in(0));
        this.GetDataset1.out(0).to(this.SwitchAccounts2.in(0));
        this.SwitchAccounts2.out(0).to(this.CreateRow7.in(0));
        this.SwitchAccounts2.out(1).to(this.CreateRow8.in(0));
        this.SwitchAccounts2.out(2).to(this.CreateRow9.in(0));
        this.SwitchAccounts2.out(3).to(this.CreateRow10.in(0));
        this.SwitchAccounts2.out(4).to(this.CreateRow11.in(0));
        this.SwitchAccounts2.out(5).to(this.CreateRow12.in(0));
        this.SetXAccounts.out(0).to(this.SplitAccounts1.in(0));
        this.SplitAccounts1.out(0).to(this.ForEachAccount1.in(0));
        this.ForEachAccount1.out(1).to(this.ScrapeTweet.in(0));
        this.ScrapeTweet.out(0).to(this.SwitchAccounts3.in(0));
        this.SwitchAccounts3.out(0).to(this.CreateRow13.in(0));
        this.SwitchAccounts3.out(1).to(this.CreateRow14.in(0));
        this.SwitchAccounts3.out(2).to(this.ForEachAccount1.in(0));
        this.CreateRow13.out(0).to(this.ForEachAccount1.in(0));
        this.CreateRow14.out(0).to(this.ForEachAccount1.in(0));
        this.SetTiktokAccounts.out(0).to(this.ScrapeTiktok.in(0));
        this.ScrapeTiktok.out(0).to(this.CreateRow15.in(0));
        this.SetYoutubeAccounts.out(0).to(this.ScrapeYt.in(0));
        this.ScrapeYt.out(0).to(this.SwitchAccounts4.in(0));
        this.SwitchAccounts4.out(0).to(this.CreateRow16.in(0));
        this.SwitchAccounts4.out(1).to(this.CreateRow17.in(0));
        this.SetFacebookAccounts.out(0).to(this.SplitAccounts2.in(0));
        this.SplitAccounts2.out(0).to(this.ForEachAccount2.in(0));
        this.ForEachAccount2.out(1).to(this.ScrapeFb.in(0));
        this.ScrapeFb.out(0).to(this.Abort1.in(0));
        this.Abort1.out(0).to(this.GetDataset2.in(0));
        this.GetDataset2.out(0).to(this.SetPostdate.in(0));
        this.SetPostdate.out(0).to(this.SwitchAccounts5.in(0));
        this.SwitchAccounts5.out(0).to(this.CreateRow18.in(0));
        this.SwitchAccounts5.out(1).to(this.CreateRow19.in(0));
        this.SwitchAccounts5.out(2).to(this.CreateRow20.in(0));
        this.SwitchAccounts5.out(3).to(this.CreateRow21.in(0));
        this.SwitchAccounts5.out(4).to(this.ForEachAccount2.in(0));
        this.CreateRow18.out(0).to(this.ForEachAccount2.in(0));
        this.CreateRow19.out(0).to(this.ForEachAccount2.in(0));
        this.CreateRow20.out(0).to(this.ForEachAccount2.in(0));
        this.CreateRow21.out(0).to(this.ForEachAccount2.in(0));
    }
}
