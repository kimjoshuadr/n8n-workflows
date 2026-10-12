import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Content · Industry news digest
// Nodes   : 11  |  Connections: 9
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Friday1500                         scheduleTrigger
// FeedsToRead                        httpRequest                [alwaysOutput] [retry]
// FetchTheFeed                       httpRequest                [onError→regular]
// CollectTheItems                    code
// ClaimAsSeen                        httpRequest                [alwaysOutput] [retry]
// OnlyTheNewOnes                     code
// AnythingNew                        if
// WriteTheDigest                     httpRequest                [onError→regular] [retry]
// SendTheDigest                      httpRequest                [retry]
// QuietWeek                          noOp
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Friday1500
//    → FeedsToRead
//      → FetchTheFeed
//        → CollectTheItems
//          → ClaimAsSeen
//            → OnlyTheNewOnes
//              → AnythingNew
//                → WriteTheDigest
//                  → SendTheDigest
//               .out(1) → QuietWeek
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
        position: [-40, -390],
    })
    AboutThisWorkflow = {
        width: 620,
        height: 220,
        content: `## Content · Industry news digest
Each Friday, reads the feeds you follow, drops what was already sent, and emails a short digest of what is new.

**Needs:** DB_API_KEY, DB_BASE_URL, EMAIL_API_KEY, EMAIL_BASE_URL, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`workflows/content\``,
    };

    @node({
        id: 'cc9d4449-7460-44ef-a9f2-fa35b2b73ace',
        name: 'Friday 15:00',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 0],
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
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [240, 0],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    FeedsToRead = {
        method: 'GET',
        url: '={{ $env.DB_BASE_URL }}/feeds',
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
    };

    @node({
        id: 'af78b7b8-9ef8-4c32-a03a-2aae5929a03e',
        name: 'Fetch the feed',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [480, 0],
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
        position: [720, 0],
    })
    CollectTheItems = {
        jsCode: `const items = $input.all().flatMap((i) => i.json.items ?? []).filter((x) => x && x.url && x.title);
const unique = [...new Map(items.map((x) => [x.url, x])).values()];
return unique.map((x) => ({ json: { url: x.url, title: x.title, summary: String(x.summary ?? "").slice(0, 500) } }));`,
    };

    @node({
        id: '0b5672e7-ce8f-4afa-aa63-7ee83469328b',
        name: 'Claim as seen',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [960, 0],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ClaimAsSeen = {
        method: 'POST',
        url: '={{ $env.DB_BASE_URL }}/seen_items',
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
                    name: 'on_conflict',
                    value: "={{ 'url' }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ url: $json.url, title: $json.title, summary: $json.summary }) }}',
    };

    @node({
        id: '2eb7e7c6-d7ce-4959-acd8-37877e2c7ef5',
        name: 'Only the new ones',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1200, 0],
    })
    OnlyTheNewOnes = {
        jsCode: `const fresh = $input.all().map((i) => i.json).filter((r) => r && r.url);
return [{ json: { count: fresh.length, list: fresh.map((r) => "- " + r.title + " (" + r.url + "): " + r.summary).join("\\n") } }];`,
    };

    @node({
        id: '04fdcfe1-4e46-42f6-a010-4d958b1cf685',
        name: 'Anything new?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1440, 0],
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
        id: '2f1e68eb-7eb0-4d16-ae21-bc626f046626',
        name: 'Write the digest',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1680, -90],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    WriteTheDigest = {
        method: 'POST',
        url: '={{ $env.LLM_BASE_URL }}/chat/completions',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.LLM_API_KEY }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: `={{ JSON.stringify({
  model: $env.LLM_MODEL,
  temperature: 0.2,
  messages: [
    { role: "system", content: "[task:summarise] Write a short weekly digest from these items: one line per item saying why it matters, grouped under at most three headings. Keep every link. Add nothing that is not in the items." },
    { role: "user", content: $json.list }
  ]
}) }}`,
    };

    @node({
        id: '1961c6f0-8d98-4f07-a0c4-0e729f31c566',
        name: 'Send the digest',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1920, 0],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendTheDigest = {
        method: 'POST',
        url: '={{ $env.EMAIL_BASE_URL }}/emails',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.EMAIL_API_KEY }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ to: 'team@example.com', subject: 'This week: ' + $('Only the new ones').first().json.count + ' things worth reading', text: $json.choices?.[0]?.message?.content ?? $('Only the new ones').first().json.list }) }}",
    };

    @node({
        id: '66d3f369-29ed-409e-a4e9-9b6197aa6b76',
        name: 'Quiet week',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1680, 90],
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
        this.CollectTheItems.out(0).to(this.ClaimAsSeen.in(0));
        this.ClaimAsSeen.out(0).to(this.OnlyTheNewOnes.in(0));
        this.OnlyTheNewOnes.out(0).to(this.AnythingNew.in(0));
        this.AnythingNew.out(0).to(this.WriteTheDigest.in(0));
        this.AnythingNew.out(1).to(this.QuietWeek.in(0));
        this.WriteTheDigest.out(0).to(this.SendTheDigest.in(0));
    }
}
