import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Content pipeline · Share what was published
// Nodes   : 11  |  Connections: 10
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Hourly                             scheduleTrigger
// PublishedNotShared                 httpRequest                [alwaysOutput] [retry]
// AnythingNew                        if
// EachArticle                        splitInBatches
// WriteThePosts                      httpRequest                [onError→regular] [retry]
// OneItemPerNetwork                  code
// ScheduleThePost                    httpRequest                [onError→regular] [retry]
// MarkShared                         httpRequest                [retry]
// NothingNew                         noOp
// Done                               noOp
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Hourly
//    → PublishedNotShared
//      → AnythingNew
//        → EachArticle
//          → Done
//         .out(1) → WriteThePosts
//            → OneItemPerNetwork
//              → ScheduleThePost
//                → MarkShared
//                  → EachArticle (↩ loop)
//       .out(1) → NothingNew
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Content pipeline · Share what was published',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class ContentPipelineShareWhatWasPublishedWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'd08a7ced-6fb1-4dc6-a28b-32265d00c566',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-40, -390],
    })
    AboutThisWorkflow = {
        width: 620,
        height: 220,
        content: `## Content pipeline · Share what was published
Every hour, writes a post per network for anything newly published and schedules it. One network failing does not stop the others.

**Needs:** DB_API_KEY, DB_BASE_URL, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, SOCIAL_API_KEY, SOCIAL_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/content-pipeline\``,
    };

    @node({
        id: '036d7389-17dd-4ba5-a054-9e611fda1d69',
        name: 'Hourly',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 0],
    })
    Hourly = {
        rule: {
            interval: [
                {
                    field: 'hours',
                    hoursInterval: 1,
                },
            ],
        },
    };

    @node({
        id: 'd817ebe2-d13c-4dc0-ab13-f027000f2d9a',
        name: 'Published, not shared',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [240, 0],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PublishedNotShared = {
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
                    name: 'status',
                    value: "={{ 'eq.published' }}",
                },
                {
                    name: 'shared',
                    value: "={{ 'eq.false' }}",
                },
            ],
        },
    };

    @node({
        id: 'b1be9994-856d-42cc-ab3a-c475e1fa85d7',
        name: 'Anything new?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [480, 0],
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
        id: '4592c543-8ffe-466b-ae2b-8a73509434b2',
        name: 'Each article',
        type: 'n8n-nodes-base.splitInBatches',
        version: 3,
        position: [720, -90],
    })
    EachArticle = {
        batchSize: 1,
        options: {},
    };

    @node({
        id: 'c1c10a8f-f873-4cba-a408-0c73981fe02a',
        name: 'Write the posts',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [960, -90],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    WriteThePosts = {
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
  response_format: { type: "json_object" },
  messages: [
    { role: "system", content: "[task:social] Write one post per network for this article. Reply with JSON: { x: string (max 260 chars), linkedin: string, facebook: string }. No hashtags stuffing, no invented claims." },
    { role: "user", content: $json.title + '\\n\\n' + String($json.body).slice(0, 1500) }
  ]
}) }}`,
    };

    @node({
        id: '59b33689-10df-428f-a8c2-a1774b912f31',
        name: 'One item per network',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1200, 0],
    })
    OneItemPerNetwork = {
        jsCode: `const a = $("Each article").first().json;
let posts = {};
try { posts = JSON.parse($input.first().json.choices[0].message.content); } catch (e) {}
const fallback = "New on the blog: " + a.title;
return ["x", "linkedin", "facebook"].map((network) => ({ json: { draft_id: a.id, network, text: String(posts[network] || fallback).slice(0, network === "x" ? 260 : 2000) } }));`,
    };

    @node({
        id: '2306ed84-5499-4b7e-a44b-7b5532034fa9',
        name: 'Schedule the post',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1440, 0],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ScheduleThePost = {
        method: 'POST',
        url: '={{ $env.SOCIAL_BASE_URL }}/updates/create',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.SOCIAL_API_KEY }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ network: $json.network, text: $json.text }) }}',
    };

    @node({
        id: 'f6063fae-3d9d-465a-a446-c1d7489e7cea',
        name: 'Mark shared',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1680, 0],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MarkShared = {
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
                    value: "={{ 'eq.' + $('Each article').first().json.id }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ shared: true, shared_at: $now.toISO() }) }}',
    };

    @node({
        id: 'c218a248-0804-4ebb-aa86-f712bd24fd60',
        name: 'Nothing new',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [720, 90],
    })
    NothingNew = {};

    @node({
        id: '978b2aea-298a-45ad-ad79-9933b7b48ea6',
        name: 'Done',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [960, 90],
    })
    Done = {};

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Hourly.out(0).to(this.PublishedNotShared.in(0));
        this.PublishedNotShared.out(0).to(this.AnythingNew.in(0));
        this.AnythingNew.out(0).to(this.EachArticle.in(0));
        this.AnythingNew.out(1).to(this.NothingNew.in(0));
        this.EachArticle.out(0).to(this.Done.in(0));
        this.EachArticle.out(1).to(this.WriteThePosts.in(0));
        this.WriteThePosts.out(0).to(this.OneItemPerNetwork.in(0));
        this.OneItemPerNetwork.out(0).to(this.ScheduleThePost.in(0));
        this.ScheduleThePost.out(0).to(this.MarkShared.in(0));
        this.MarkShared.out(0).to(this.EachArticle.in(0));
    }
}
