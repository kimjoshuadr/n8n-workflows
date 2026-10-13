import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Content pipeline · Share what was published
// Nodes   : 15  |  Connections: 12
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Hourly                             scheduleTrigger
// PublishedNotShared                 supabase                   [creds] [alwaysOutput] [retry]
// AnythingNew                        if
// EachArticle                        splitInBatches
// WriteThePosts                      agent                      [AI] [onError→regular]
// WriteThePostsGpt                   lmChatOpenAi               [creds] [ai_languageModel]
// WriteThePostsShape                 outputParserStructured     [ai_outputParser]
// CutEachPostToLength                code
// PostToLinkedin                     linkedIn                   [onError→regular] [creds] [retry]
// PostToX                            twitter                    [onError→regular] [creds] [retry]
// PostToFacebook                     facebookGraphApi           [onError→regular] [creds] [retry]
// MarkShared                         supabase                   [creds] [retry]
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
//            → CutEachPostToLength
//              → PostToLinkedin
//                → PostToX
//                  → PostToFacebook
//                    → MarkShared
//                      → EachArticle (↩ loop)
//       .out(1) → NothingNew
//
// AI CONNECTIONS
// WriteThePosts.uses({ ai_languageModel: WriteThePostsGpt, ai_outputParser: WriteThePostsShape })
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
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Content pipeline · Share what was published
Every hour, writes a post per network for anything newly published and schedules it. One network failing does not stop the others.

**Platforms:** Supabase, OpenAI, LinkedIn, X, Facebook
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/content-pipeline\``,
    };

    @node({
        id: '036d7389-17dd-4ba5-a054-9e611fda1d69',
        name: 'Hourly',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 310],
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
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [260, 310],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PublishedNotShared = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'content_drafts',
        returnAll: true,
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'status',
                    condition: 'eq',
                    keyValue: "={{ 'published' }}",
                },
                {
                    keyName: 'shared',
                    condition: 'eq',
                    keyValue: "={{ 'false' }}",
                },
            ],
        },
    };

    @node({
        id: 'b1be9994-856d-42cc-ab3a-c475e1fa85d7',
        name: 'Anything new?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [520, 310],
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
        position: [780, 220],
    })
    EachArticle = {
        batchSize: 1,
        options: {},
    };

    @node({
        id: 'c1c10a8f-f873-4cba-a408-0c73981fe02a',
        name: 'Write the posts',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [1140, 90],
        onError: 'continueRegularOutput',
    })
    WriteThePosts = {
        promptType: 'define',
        text: "={{ $json.title + '\\n\\n' + String($json.body).slice(0, 1500) }}",
        hasOutputParser: true,
        options: {
            systemMessage:
                '[task:social] Write one post per network for this article. Reply with JSON: { x: string (max 260 chars), linkedin: string, facebook: string }. No hashtags stuffing, no invented claims.',
            maxIterations: 2,
        },
    };

    @node({
        id: 'bdba154d-59fb-4b23-a3f8-4184b7c6c49c',
        name: 'Write the posts · GPT',
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        version: 1.2,
        position: [1040, 310],
        credentials: { openAiApi: { id: '__CRED:openai__', name: 'OpenAI' } },
    })
    WriteThePostsGpt = {
        model: {
            __rl: true,
            mode: 'id',
            value: 'gpt-4o-mini',
        },
        options: {
            temperature: 0,
        },
    };

    @node({
        id: '1768495c-e8b2-47f6-a7ec-4eda11bf7ac8',
        name: 'Write the posts · shape',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [1240, 310],
    })
    WriteThePostsShape = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "x": "The X post",
  "linkedin": "The LinkedIn post",
  "facebook": "The Facebook post"
}`,
    };

    @node({
        id: 'f5de6dc0-bf3c-4b6c-a458-d84c59afa8de',
        name: 'Cut each post to length',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1500, 310],
    })
    CutEachPostToLength = {
        jsCode: `const a = $("Each article").first().json;
const o = $input.first().json.output ?? {};
const fallback = "New on the blog: " + a.title;
const post = (network, max) => String(typeof o[network] === "string" && o[network].trim() ? o[network] : fallback).slice(0, max);
return [{ json: { draft_id: a.id, x: post("x", 260), linkedin: post("linkedin", 2000), facebook: post("facebook", 2000) } }];`,
    };

    @node({
        id: '6de2d4b3-6c68-4be0-a5f0-17060508ec2b',
        name: 'Post to LinkedIn',
        type: 'n8n-nodes-base.linkedIn',
        version: 1,
        position: [1760, 310],
        credentials: { linkedInOAuth2Api: { id: '__CRED:linkedin__', name: 'LinkedIn' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PostToLinkedin = {
        resource: 'post',
        operation: 'create',
        postAs: 'organization',
        organization: '1234567',
        text: "={{ $('Cut each post to length').first().json.linkedin }}",
        additionalFields: {},
    };

    @node({
        id: 'f5402db7-d4be-4551-a0ac-a0012d3e519c',
        name: 'Post to X',
        type: 'n8n-nodes-base.twitter',
        version: 2,
        position: [2020, 310],
        credentials: { twitterOAuth2Api: { id: '__CRED:x__', name: 'X' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PostToX = {
        resource: 'tweet',
        operation: 'create',
        text: "={{ $('Cut each post to length').first().json.x }}",
        additionalFields: {},
    };

    @node({
        id: '72a54932-d0a8-4e87-a1c7-f2c8e03e71e5',
        name: 'Post to Facebook',
        type: 'n8n-nodes-base.facebookGraphApi',
        version: 1,
        position: [2280, 310],
        credentials: { facebookGraphApi: { id: '__CRED:facebook__', name: 'Facebook' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PostToFacebook = {
        hostUrl: 'graph.facebook.com',
        httpRequestMethod: 'POST',
        graphApiVersion: 'v23.0',
        node: 'acme-page',
        edge: 'feed',
        options: {
            queryParameters: {
                parameter: [
                    {
                        name: 'message',
                        value: "={{ $('Cut each post to length').first().json.facebook }}",
                    },
                ],
            },
        },
    };

    @node({
        id: 'f6063fae-3d9d-465a-a446-c1d7489e7cea',
        name: 'Mark shared',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [2540, 310],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MarkShared = {
        resource: 'row',
        operation: 'update',
        tableId: 'content_drafts',
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'id',
                    condition: 'eq',
                    keyValue: "={{ $('Each article').first().json.id }}",
                },
            ],
        },
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'shared',
                    fieldValue: '={{ true }}',
                },
                {
                    fieldId: 'shared_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: 'c218a248-0804-4ebb-aa86-f712bd24fd60',
        name: 'Nothing new',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [780, 400],
    })
    NothingNew = {};

    @node({
        id: '978b2aea-298a-45ad-ad79-9933b7b48ea6',
        name: 'Done',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1140, 530],
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
        this.WriteThePosts.out(0).to(this.CutEachPostToLength.in(0));
        this.CutEachPostToLength.out(0).to(this.PostToLinkedin.in(0));
        this.PostToLinkedin.out(0).to(this.PostToX.in(0));
        this.PostToX.out(0).to(this.PostToFacebook.in(0));
        this.PostToFacebook.out(0).to(this.MarkShared.in(0));
        this.MarkShared.out(0).to(this.EachArticle.in(0));

        this.WriteThePosts.uses({
            ai_languageModel: this.WriteThePostsGpt.output,
            ai_outputParser: this.WriteThePostsShape.output,
        });
    }
}
