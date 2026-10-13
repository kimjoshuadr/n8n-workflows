import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Content · Industry news digest
// Nodes   : 14  |  Connections: 11
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Friday1500                         scheduleTrigger
// FeedsToRead                        supabase                   [creds] [alwaysOutput] [retry]
// FetchTheFeed                       httpRequest                [onError→regular]
// CollectTheItems                    code
// AlreadySeen                        supabase                   [creds] [alwaysOutput] [executeOnce] [retry]
// OnlyTheNewOnes                     code
// AnythingNew                        if
// OneRowPerItem                      code
// RememberThem                       supabase                   [creds] [retry]
// WriteTheDigest                     agent                      [AI] [onError→regular] [executeOnce]
// WriteTheDigestClaude               lmChatAnthropic            [creds] [ai_languageModel]
// SendTheDigest                      sendGrid                   [creds] [executeOnce] [retry]
// QuietWeek                          noOp
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Friday1500
//    → FeedsToRead
//      → FetchTheFeed
//        → CollectTheItems
//          → AlreadySeen
//            → OnlyTheNewOnes
//              → AnythingNew
//                → OneRowPerItem
//                  → RememberThem
//                    → WriteTheDigest
//                      → SendTheDigest
//               .out(1) → QuietWeek
//
// AI CONNECTIONS
// WriteTheDigest.uses({ ai_languageModel: WriteTheDigestClaude })
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Content · Industry news digest',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class ContentIndustryNewsDigestWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'de86528e-868c-4517-ad9d-ebc048846226',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Content · Industry news digest
Each Friday, reads the feeds you follow, drops what was already sent, and emails a short digest of what is new.

**Platforms:** Supabase, Claude, SendGrid
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`workflows/content\``,
    };

    @node({
        id: 'cc9d4449-7460-44ef-a9f2-fa35b2b73ace',
        name: 'Friday 15:00',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 220],
    })
    Friday1500 = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 15 * * 5',
                },
            ],
        },
    };

    @node({
        id: '177a9f15-bba1-4e84-af8d-87fa87c9c578',
        name: 'Feeds to read',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [260, 220],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    FeedsToRead = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'feeds',
        returnAll: true,
    };

    @node({
        id: 'af78b7b8-9ef8-4c32-a03a-2aae5929a03e',
        name: 'Fetch the feed',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [520, 220],
        onError: 'continueRegularOutput',
    })
    FetchTheFeed = {
        method: 'GET',
        url: '={{ $json.url }}',
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: 'b5b5a71e-36ae-40cf-a4cf-a539b9df84a0',
        name: 'Collect the items',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [780, 220],
    })
    CollectTheItems = {
        jsCode: `const items = $input.all().flatMap((i) => i.json.items ?? []).filter((x) => x && x.url && x.title);
const unique = [...new Map(items.map((x) => [x.url, x])).values()];
return unique.map((x) => ({ json: { url: x.url, title: x.title, summary: String(x.summary ?? "").slice(0, 500) } }));`,
    };

    @node({
        id: '05df5be8-302d-4487-a531-153c7bfc50ee',
        name: 'Already seen',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1040, 220],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        executeOnce: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    AlreadySeen = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'seen_items',
        returnAll: true,
    };

    @node({
        id: '2eb7e7c6-d7ce-4959-acd8-37877e2c7ef5',
        name: 'Only the new ones',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1300, 220],
    })
    OnlyTheNewOnes = {
        jsCode: `const seen = new Set($input.all().map((i) => i.json.url).filter(Boolean));
const fresh = $("Collect the items").all().map((i) => i.json).filter((r) => r.url && !seen.has(r.url));
return [{ json: { count: fresh.length, rows: fresh, list: fresh.map((r) => "- " + r.title + " (" + r.url + "): " + r.summary).join("\\n") } }];`,
    };

    @node({
        id: '04fdcfe1-4e46-42f6-a010-4d958b1cf685',
        name: 'Anything new?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1560, 220],
    })
    AnythingNew = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '8895fcd1-c460-45d2-aefa-96592b3fae89',
                    leftValue: '={{ $json.count > 0 }}',
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
        id: '628c70eb-cbe1-4b3d-a89a-69b1edec1054',
        name: 'One row per item',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1820, 130],
    })
    OneRowPerItem = {
        jsCode: 'return $input.first().json.rows.map((json) => ({ json }));',
    };

    @node({
        id: 'd4cf86df-9008-4e6f-a86e-b30dc94dcfe2',
        name: 'Remember them',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [2080, 220],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    RememberThem = {
        resource: 'row',
        operation: 'create',
        tableId: 'seen_items',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'url',
                    fieldValue: '={{ $json.url }}',
                },
                {
                    fieldId: 'title',
                    fieldValue: '={{ $json.title }}',
                },
                {
                    fieldId: 'summary',
                    fieldValue: '={{ $json.summary }}',
                },
            ],
        },
    };

    @node({
        id: '2f1e68eb-7eb0-4d16-ae21-bc626f046626',
        name: 'Write the digest',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [2340, 90],
        onError: 'continueRegularOutput',
        executeOnce: true,
    })
    WriteTheDigest = {
        promptType: 'define',
        text: "={{ $('Only the new ones').first().json.list }}",
        hasOutputParser: false,
        options: {
            systemMessage:
                '[task:summarise] Write a short weekly digest from these items: one line per item saying why it matters, grouped under at most three headings. Keep every link. Add nothing that is not in the items.',
            maxIterations: 2,
        },
    };

    @node({
        id: '172a48a6-7bb4-4bb0-abc5-21ca3afb15bb',
        name: 'Write the digest · Claude',
        type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
        version: 1.3,
        position: [2340, 310],
        credentials: { anthropicApi: { id: '__CRED:anthropic__', name: 'Claude' } },
    })
    WriteTheDigestClaude = {
        model: {
            __rl: true,
            mode: 'id',
            value: 'claude-sonnet-4-5',
        },
        options: {
            temperature: 0.2,
        },
    };

    @node({
        id: '1961c6f0-8d98-4f07-a0c4-0e729f31c566',
        name: 'Send the digest',
        type: 'n8n-nodes-base.sendGrid',
        version: 1,
        position: [2600, 220],
        credentials: { sendGridApi: { id: '__CRED:sendgrid__', name: 'SendGrid' } },
        executeOnce: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendTheDigest = {
        resource: 'mail',
        operation: 'send',
        fromEmail: "={{ 'hello@example.com' }}",
        fromName: "={{ 'Acme' }}",
        toEmail: "={{ 'team@example.com' }}",
        subject: "={{ 'This week: ' + $('Only the new ones').first().json.count + ' things worth reading' }}",
        dynamicTemplate: false,
        contentType: 'text/plain',
        contentValue: "={{ $json.output ?? $('Only the new ones').first().json.list }}",
        additionalFields: {},
    };

    @node({
        id: '66d3f369-29ed-409e-a4e9-9b6197aa6b76',
        name: 'Quiet week',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1820, 310],
    })
    QuietWeek = {};

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Friday1500.out(0).to(this.FeedsToRead.in(0));
        this.FeedsToRead.out(0).to(this.FetchTheFeed.in(0));
        this.FetchTheFeed.out(0).to(this.CollectTheItems.in(0));
        this.CollectTheItems.out(0).to(this.AlreadySeen.in(0));
        this.AlreadySeen.out(0).to(this.OnlyTheNewOnes.in(0));
        this.OnlyTheNewOnes.out(0).to(this.AnythingNew.in(0));
        this.AnythingNew.out(0).to(this.OneRowPerItem.in(0));
        this.AnythingNew.out(1).to(this.QuietWeek.in(0));
        this.OneRowPerItem.out(0).to(this.RememberThem.in(0));
        this.RememberThem.out(0).to(this.WriteTheDigest.in(0));
        this.WriteTheDigest.out(0).to(this.SendTheDigest.in(0));

        this.WriteTheDigest.uses({
            ai_languageModel: this.WriteTheDigestClaude.output,
        });
    }
}
