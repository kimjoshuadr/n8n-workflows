import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : AI content studio · Research to published, voiced and shared
// Nodes   : 91  |  Connections: 66
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// SectionResearchAndOutline          stickyNote
// SectionWriteFactCheckEditOptimise  stickyNote
// SectionAPersonDecides              stickyNote
// SectionPublishIllustrateVoice      stickyNote
// SectionShare                       stickyNote
// SectionLearnFromWhatWasRead        stickyNote
// Weekdays0700                       scheduleTrigger
// NextTopic                          supabase                   [creds] [alwaysOutput] [retry]
// IsThereATopic                      if
// QueueIsEmpty                       noOp
// ClaimTheTopic                      supabase                   [creds] [alwaysOutput] [retry]
// ClaimedIt                          if
// AnotherRunHasIt                    noOp
// SearchTheTopic                     httpRequest                [onError→regular] [creds]
// CollectTheSources                  code
// EnoughToWriteFrom                  if
// ResearchAgent                      agent                      [AI] [onError→regular]
// ClaudeResearch                     lmChatAnthropic            [creds] [ai_languageModel]
// ReasonItThrough                    toolThink                  [ai_tool]
// ResearchNotes                      outputParserStructured     [ai_outputParser]
// KeepTheSupportedPoints             code
// OutlineAgent                       agent                      [AI] [onError→regular]
// ClaudeOutline                      lmChatAnthropic            [creds] [ai_languageModel]
// PastArticles                       vectorStorePinecone        [AI] [creds] [ai_tool]
// EmbeddingsPastArticles             embeddingsOpenAi           [creds] [ai_embedding]
// Outline                            outputParserStructured     [ai_outputParser]
// CheckTheOutline                    code
// UsableOutline                      if
// WriterAgent                        agent                      [AI] [onError→regular]
// ClaudeWriting                      lmChatAnthropic            [creds] [ai_languageModel]
// HouseStyle                         vectorStorePinecone        [AI] [creds] [ai_tool]
// EmbeddingsStyle                    embeddingsOpenAi           [creds] [ai_embedding]
// ReadTheArticle                     code
// FactCheckAgent                     agent                      [AI] [onError→regular]
// GptFactCheck                       lmChatOpenAi               [creds] [ai_languageModel]
// Claims                             outputParserStructured     [ai_outputParser]
// WeighTheClaims                     code
// EveryClaimSupported                if
// WorthARewrite                      if
// EditorAgent                        agent                      [AI] [onError→regular]
// ClaudeEditing                      lmChatAnthropic            [creds] [ai_languageModel]
// RecheckTheEdit                     code
// CleanNow                           if
// SeoAgent                           agent                      [AI] [onError→regular]
// GptSeo                             lmChatOpenAi               [creds] [ai_languageModel]
// Meta                               outputParserStructured     [ai_outputParser]
// EnforceTheLimits                   code
// SaveTheDraft                       supabase                   [creds] [retry]
// AskForApproval                     slack                      [creds] [retry]
// CouldNotFinish                     code
// ReturnTheTopic                     supabase                   [creds] [alwaysOutput] [retry]
// ReturnedMessage                    code
// TellTheEditor                      executeWorkflow
// Decision                           webhook
// ReadTheDecision                    code
// Valid                              if
// BadRequest                         respondToWebhook
// TakeItIfPending                    supabase                   [creds] [alwaysOutput] [retry]
// AwaitingApproval                   if
// NotPending                         respondToWebhook
// Approved                           if
// Rejected                           respondToWebhook
// Publishing                         respondToWebhook
// PublishToWordpress                 wordpress                  [creds] [retry]
// MarkPublished                      supabase                   [creds] [alwaysOutput] [retry]
// MakeACoverImage                    httpRequest                [onError→regular] [creds]
// ScriptForTheVoice                  code
// RecordTheVoiceOver                 httpRequest                [onError→regular] [creds]
// RecordTheAssets                    supabase                   [creds] [alwaysOutput] [retry]
// SocialAgent                        agent                      [AI] [onError→regular]
// ClaudeSocial                       lmChatAnthropic            [creds] [ai_languageModel]
// Posts                              outputParserStructured     [ai_outputParser]
// CutEachPostToLength                code
// PostToLinkedin                     linkedIn                   [onError→regular] [creds] [retry]
// PostToX                            twitter                    [onError→regular] [creds] [retry]
// PostToFacebook                     facebookGraphApi           [onError→regular] [creds] [retry]
// MarkShared                         supabase                   [creds] [alwaysOutput] [retry]
// SayItIsLive                        slack                      [creds] [retry]
// Friday1600                         scheduleTrigger
// PublishedThisMonth                 supabase                   [creds] [alwaysOutput] [retry]
// CountTheReaders                    httpRequest                [onError→regular] [creds]
// RankTheArticles                    code
// AnythingMeasured                   if
// StrategistAgent                    agent                      [AI] [onError→regular]
// ClaudeStrategy                     lmChatAnthropic            [creds] [ai_languageModel]
// Topics                             outputParserStructured     [ai_outputParser]
// KeepTheNewOnes                     code
// QueueTheTopic                      supabase                   [creds] [retry]
// PostNextWeekSTopics                slack                      [creds] [executeOnce] [retry]
// TooLittleDataYet                   noOp
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Weekdays0700
//    → NextTopic
//      → IsThereATopic
//        → ClaimTheTopic
//          → ClaimedIt
//            → SearchTheTopic
//              → CollectTheSources
//                → EnoughToWriteFrom
//                  → ResearchAgent
//                    → KeepTheSupportedPoints
//                      → OutlineAgent
//                        → CheckTheOutline
//                          → UsableOutline
//                            → WriterAgent
//                              → ReadTheArticle
//                                → FactCheckAgent
//                                  → WeighTheClaims
//                                    → EveryClaimSupported
//                                      → SeoAgent
//                                        → EnforceTheLimits
//                                          → SaveTheDraft
//                                            → AskForApproval
//                                     .out(1) → WorthARewrite
//                                        → EditorAgent
//                                          → RecheckTheEdit
//                                            → CleanNow
//                                              → SeoAgent (↩ loop)
//                                             .out(1) → CouldNotFinish
//                                                → ReturnTheTopic
//                                                  → ReturnedMessage
//                                                    → TellTheEditor
//                                       .out(1) → CouldNotFinish (↩ loop)
//                           .out(1) → CouldNotFinish (↩ loop)
//                 .out(1) → CouldNotFinish (↩ loop)
//           .out(1) → AnotherRunHasIt
//       .out(1) → QueueIsEmpty
// Decision
//    → ReadTheDecision
//      → Valid
//        → TakeItIfPending
//          → AwaitingApproval
//            → Approved
//              → Publishing
//                → PublishToWordpress
//                  → MarkPublished
//                    → MakeACoverImage
//                      → ScriptForTheVoice
//                        → RecordTheVoiceOver
//                          → RecordTheAssets
//                            → SocialAgent
//                              → CutEachPostToLength
//                                → PostToLinkedin
//                                  → PostToX
//                                    → PostToFacebook
//                                      → MarkShared
//                                        → SayItIsLive
//             .out(1) → Rejected
//           .out(1) → NotPending
//       .out(1) → BadRequest
// Friday1600
//    → PublishedThisMonth
//      → CountTheReaders
//        → RankTheArticles
//          → AnythingMeasured
//            → StrategistAgent
//              → KeepTheNewOnes
//                → QueueTheTopic
//                  → PostNextWeekSTopics
//           .out(1) → TooLittleDataYet
//
// AI CONNECTIONS
// ResearchAgent.uses({ ai_languageModel: ClaudeResearch, ai_tool: [ReasonItThrough], ai_outputParser: ResearchNotes })
// OutlineAgent.uses({ ai_languageModel: ClaudeOutline, ai_tool: [PastArticles], ai_outputParser: Outline })
// PastArticles.uses({ ai_embedding: EmbeddingsPastArticles })
// WriterAgent.uses({ ai_languageModel: ClaudeWriting, ai_tool: [HouseStyle] })
// HouseStyle.uses({ ai_embedding: EmbeddingsStyle })
// FactCheckAgent.uses({ ai_languageModel: GptFactCheck, ai_outputParser: Claims })
// EditorAgent.uses({ ai_languageModel: ClaudeEditing })
// SeoAgent.uses({ ai_languageModel: GptSeo, ai_outputParser: Meta })
// SocialAgent.uses({ ai_languageModel: ClaudeSocial, ai_outputParser: Posts })
// StrategistAgent.uses({ ai_languageModel: ClaudeStrategy, ai_outputParser: Topics })
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'AI content studio · Research to published, voiced and shared',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class AiContentStudioResearchToPublishedVoicedAndSharedWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'ca8044c5-8ef2-43a5-a41b-223998778a92',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -220],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## AI content studio · Research to published, voiced and shared
Seven agents take a topic from research to a fact-checked, optimised draft. A person approves it in Slack, then it is published to WordPress with a cover image and an ElevenLabs voice-over, shared to LinkedIn, X and Facebook, and its results in PostHog become next week's topics.

**Platforms:** Supabase, SerpAPI, Claude, Pinecone, OpenAI, Slack, WordPress, ElevenLabs, LinkedIn, X, Facebook, PostHog
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/ai-content-studio\``,
    };

    @node({
        id: 'f32fa069-1ab5-4ee4-ad4c-1cb493190a46',
        name: 'Section: Research and outline',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 0],
    })
    SectionResearchAndOutline = {
        width: 4300,
        height: 770,
        color: 4,
        content: `## 1. Research and outline
SerpAPI finds sources. Points that cite no real source are dropped before anyone writes from them.`,
    };

    @node({
        id: '93896693-f6c8-4fcb-a77f-a684844262d9',
        name: 'Section: Write, fact-check, edit, optimise',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 850],
    })
    SectionWriteFactCheckEditOptimise = {
        width: 4100,
        height: 770,
        color: 5,
        content: `## 2. Write, fact-check, edit, optimise
A different model checks the writer. Unsupported claims get one edit, then the topic goes back.`,
    };

    @node({
        id: 'e72c8ac4-991b-49af-a8c1-4f47a45f386d',
        name: 'Section: A person decides',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 1700],
    })
    SectionAPersonDecides = {
        width: 1940,
        height: 510,
        color: 6,
        content: `## 3. A person decides
Nothing below this line runs without a yes.`,
    };

    @node({
        id: 'c0ffb324-ad62-442f-ac0c-ddd8b66cf22e',
        name: 'Section: Publish, illustrate, voice',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 2290],
    })
    SectionPublishIllustrateVoice = {
        width: 1680,
        height: 330,
        color: 3,
        content: '## 4. Publish, illustrate, voice',
    };

    @node({
        id: '63bedea8-8b71-4f5d-aced-e1b1ae9af680',
        name: 'Section: Share',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 2700],
    })
    SectionShare = {
        width: 2140,
        height: 590,
        color: 7,
        content: '## 5. Share',
    };

    @node({
        id: '8e205987-3281-45a0-ab18-bd24afc193e6',
        name: 'Section: Learn from what was read',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 3370],
    })
    SectionLearnFromWhatWasRead = {
        width: 2660,
        height: 770,
        color: 2,
        content: '## 6. Learn from what was read',
    };

    @node({
        id: '0463dbc1-2204-4e1c-a3e8-ab0305cecc0d',
        name: 'Weekdays 07:00',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 420],
    })
    Weekdays0700 = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 7 * * 1-5',
                },
            ],
        },
    };

    @node({
        id: '967ddc6f-9013-4e3c-ab3c-0c13b82b093a',
        name: 'Next topic',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [260, 420],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    NextTopic = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'content_topics',
        returnAll: false,
        limit: 1,
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'status',
                    condition: 'eq',
                    keyValue: "={{ 'queued' }}",
                },
            ],
        },
    };

    @node({
        id: 'f2476f73-8894-4cfe-ab83-b4927643a758',
        name: 'Is there a topic?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [520, 420],
    })
    IsThereATopic = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'db8ad273-72ab-439a-a5bb-8a1b22ccd5eb',
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
        id: '1a3d104e-b4a5-4e64-a5a4-f41a4e760454',
        name: 'Queue is empty',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [780, 330],
    })
    QueueIsEmpty = {};

    @node({
        id: 'de0d9054-fd9e-4a1a-a38c-04393142041d',
        name: 'Claim the topic',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [780, 510],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ClaimTheTopic = {
        resource: 'row',
        operation: 'update',
        tableId: 'content_topics',
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
                    keyValue: "={{ 'queued' }}",
                },
            ],
        },
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'status',
                    fieldValue: "={{ 'drafting' }}",
                },
                {
                    fieldId: 'started_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '50732d36-5bab-45f5-ad37-77f6aa4e2013',
        name: 'Claimed it?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1040, 420],
    })
    ClaimedIt = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '6beb1f25-5410-4168-a394-58d42f6fb69f',
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
        id: 'dddee331-d826-4bf1-a40d-ee638b356236',
        name: 'Another run has it',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1300, 330],
    })
    AnotherRunHasIt = {};

    @node({
        id: 'cc23d717-8054-47db-abfc-d274deca3144',
        name: 'Search the topic',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1300, 510],
        credentials: { serpApi: { id: '__CRED:serpapi__', name: 'SerpAPI' } },
        onError: 'continueRegularOutput',
    })
    SearchTheTopic = {
        method: 'GET',
        url: "={{ 'https://serpapi.com/search.json' }}",
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'serpApi',
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'q',
                    value: "={{ $('Is there a topic?').first().json.topic }}",
                },
                {
                    name: 'num',
                    value: "={{ '10' }}",
                },
            ],
        },
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: 'a6dedc3c-395c-4fdc-a91f-0891ede78616',
        name: 'Collect the sources',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1560, 420],
    })
    CollectTheSources = {
        jsCode: `const t = $("Is there a topic?").first().json;
const found = $input.first().json ?? {};
const sources = (found.organic_results ?? []).slice(0, 6).map((r, i) => ({ n: i + 1, title: r.title, url: r.link, says: String(r.snippet ?? "").slice(0, 500) }));
return [{ json: { topic_id: t.id, topic: t.topic, audience: t.audience ?? "business owners", sources, enough: sources.length >= 2 } }];`,
    };

    @node({
        id: '2ce8c95e-f45f-4ea7-a934-8fd376ee980d',
        name: 'Enough to write from?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1820, 420],
    })
    EnoughToWriteFrom = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '07f9d9c4-d210-40dd-a6e4-1999a2c80c31',
                    leftValue: '={{ $json.enough }}',
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
        id: '04a5a38d-a155-4c98-a8e0-8cc8ee1d14f1',
        name: 'Research agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [2280, 290],
        onError: 'continueRegularOutput',
    })
    ResearchAgent = {
        promptType: 'define',
        text: '={{ JSON.stringify({ topic: $json.topic, audience: $json.audience, sources: $json.sources }) }}',
        hasOutputParser: true,
        options: {
            systemMessage:
                'You are the Research agent in a content studio. From the numbered sources, work out the angle worth taking for this audience and the key points an article should make. Every key point must name the source numbers it rests on. If the sources disagree, say so. Use nothing that is not in the sources.',
            maxIterations: 6,
        },
    };

    @node({
        id: 'aa9d7d00-3d9e-41ce-ac43-a48667b9d071',
        name: 'Claude · research',
        type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
        version: 1.3,
        position: [2080, 510],
        credentials: { anthropicApi: { id: '__CRED:anthropic__', name: 'Claude' } },
    })
    ClaudeResearch = {
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
        id: '31cd810e-ef53-498e-adc1-899d13b91c01',
        name: 'Reason it through',
        type: '@n8n/n8n-nodes-langchain.toolThink',
        version: 1,
        position: [2280, 510],
    })
    ReasonItThrough = {};

    @node({
        id: '7b861e46-edee-49e1-a6a7-f67dce03e9f4',
        name: 'Research notes',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [2480, 510],
    })
    ResearchNotes = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "angle": "The angle to take.",
  "key_points": [
    {
      "point": "A point the article should make",
      "sources": [
        1,
        2
      ]
    }
  ]
}`,
    };

    @node({
        id: '7a6ac93d-a39a-47dd-af10-4e7ae73b1f8a',
        name: 'Keep the supported points',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2740, 420],
    })
    KeepTheSupportedPoints = {
        jsCode: `const s = $("Collect the sources").first().json;
const o = $input.first().json.output;
const known = new Set(s.sources.map((x) => x.n));
// A point that cites no real source is dropped here, before anyone writes from it.
const points = (o?.key_points ?? []).filter((p) => p && p.point && Array.isArray(p.sources) && p.sources.length && p.sources.every((n) => known.has(n)));
return [{ json: { ...s, angle: o?.angle ?? null, points, researched: !!o?.angle && points.length >= 2 } }];`,
    };

    @node({
        id: 'c4bd7947-b03b-4ec6-a8d2-f99daae3f52f',
        name: 'Outline agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [3200, 200],
        onError: 'continueRegularOutput',
    })
    OutlineAgent = {
        promptType: 'define',
        text: '={{ JSON.stringify({ topic: $json.topic, audience: $json.audience, angle: $json.angle, points: $json.points }) }}',
        hasOutputParser: true,
        options: {
            systemMessage:
                'You are the Outline agent. Turn the angle and key points into an article outline: a title, four to six section headings, and three search keywords. Search the past articles first and do not propose a title or angle that repeats one of them.',
            maxIterations: 6,
        },
    };

    @node({
        id: '98de970d-611d-4f0f-a517-0a0bb0fc5a53',
        name: 'Claude · outline',
        type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
        version: 1.3,
        position: [3000, 420],
        credentials: { anthropicApi: { id: '__CRED:anthropic__', name: 'Claude' } },
    })
    ClaudeOutline = {
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
        id: '9d8250b9-6b22-4cb7-ac82-7fb859ce2d4b',
        name: 'Past articles',
        type: '@n8n/n8n-nodes-langchain.vectorStorePinecone',
        version: 1.3,
        position: [3200, 420],
        credentials: { pineconeApi: { id: '__CRED:pinecone__', name: 'Pinecone' } },
    })
    PastArticles = {
        mode: 'retrieve-as-tool',
        toolDescription: 'Search the articles already published, to avoid repeating one. Pass the topic.',
        pineconeIndex: {
            __rl: true,
            mode: 'id',
            value: 'content-index',
        },
        topK: 4,
        options: {},
    };

    @node({
        id: '3352451b-a52c-42b5-a34e-42a3c4d2f411',
        name: 'Embeddings · past articles',
        type: '@n8n/n8n-nodes-langchain.embeddingsOpenAi',
        version: 1.2,
        position: [3200, 640],
        credentials: { openAiApi: { id: '__CRED:openai__', name: 'OpenAI' } },
    })
    EmbeddingsPastArticles = {
        model: 'text-embedding-3-small',
        options: {},
    };

    @node({
        id: 'ed0faa82-2092-4af3-af20-cb28336d65b4',
        name: 'Outline',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [3400, 420],
    })
    Outline = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "title": "The article title",
  "sections": [
    "A section heading"
  ],
  "keywords": [
    "a keyword"
  ]
}`,
    };

    @node({
        id: '94ff60bf-e393-4fae-aac4-c74ad9899af6',
        name: 'Check the outline',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [3660, 420],
    })
    CheckTheOutline = {
        jsCode: `const r = $("Keep the supported points").first().json;
const o = $input.first().json.output;
const ok = r.researched && o && typeof o.title === "string" && Array.isArray(o.sections) && o.sections.length >= 3;
return [{ json: { ...r, title: ok ? o.title.trim() : null, sections: ok ? o.sections : [], keywords: ok ? (o.keywords ?? []).slice(0, 5) : [], outlined: !!ok } }];`,
    };

    @node({
        id: '8a1b781f-9f29-4acc-ae19-bec2d5ef2c50',
        name: 'Usable outline?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [3920, 420],
    })
    UsableOutline = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '3a91b1aa-fbe4-4cf7-ac56-b94cada24ba4',
                    leftValue: '={{ $json.outlined }}',
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
        id: 'a1ccefe5-6981-417f-a8c5-7d51064270fd',
        name: 'Writer agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [100, 1050],
        onError: 'continueRegularOutput',
    })
    WriterAgent = {
        promptType: 'define',
        text: '={{ JSON.stringify({ title: $json.title, sections: $json.sections, audience: $json.audience, points: $json.points }) }}',
        hasOutputParser: false,
        options: {
            systemMessage:
                'You are the Writer agent. Write the article in Markdown from the outline: 600 to 900 words, plain language, short paragraphs, one H2 per section. Make only the listed key points and cite each with its source number in square brackets, like [2]. Search the house style guide before you start and follow it. No statistics, quotes or names that are not in the key points.',
            maxIterations: 6,
        },
    };

    @node({
        id: 'f779c768-1116-4b29-aa12-48e1263a0a3b',
        name: 'Claude · writing',
        type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
        version: 1.3,
        position: [0, 1270],
        credentials: { anthropicApi: { id: '__CRED:anthropic__', name: 'Claude' } },
    })
    ClaudeWriting = {
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
        id: '6416caf6-c4b5-4a47-ae74-2df8b80f188b',
        name: 'House style',
        type: '@n8n/n8n-nodes-langchain.vectorStorePinecone',
        version: 1.3,
        position: [200, 1270],
        credentials: { pineconeApi: { id: '__CRED:pinecone__', name: 'Pinecone' } },
    })
    HouseStyle = {
        mode: 'retrieve-as-tool',
        toolDescription: 'Search the house style guide: tone, banned phrases, formatting rules.',
        pineconeIndex: {
            __rl: true,
            mode: 'id',
            value: 'content-index',
        },
        topK: 4,
        options: {},
    };

    @node({
        id: 'df132967-92c2-4318-aa4b-2b3357c30510',
        name: 'Embeddings · style',
        type: '@n8n/n8n-nodes-langchain.embeddingsOpenAi',
        version: 1.2,
        position: [200, 1490],
        credentials: { openAiApi: { id: '__CRED:openai__', name: 'OpenAI' } },
    })
    EmbeddingsStyle = {
        model: 'text-embedding-3-small',
        options: {},
    };

    @node({
        id: '61682856-2ade-4c52-a253-7f268638c964',
        name: 'Read the article',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [460, 1270],
    })
    ReadTheArticle = {
        jsCode: `const o = $("Check the outline").first().json;
const body = typeof $input.first().json.output === "string" ? $input.first().json.output.trim() : "";
const words = body.split(/\\s+/).filter(Boolean).length;
return [{ json: { ...o, body, words, written: words >= 150 } }];`,
    };

    @node({
        id: 'e86ad36a-39b2-42cb-afa1-9b7e8f538155',
        name: 'Fact-check agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [820, 1140],
        onError: 'continueRegularOutput',
    })
    FactCheckAgent = {
        promptType: 'define',
        text: '={{ JSON.stringify({ article: $json.body, sources: $json.sources }) }}',
        hasOutputParser: true,
        options: {
            systemMessage:
                "You are the Fact-check agent. You did not write this article. List every factual claim in it: numbers, dates, names, causes, comparisons. For each, say whether the numbered sources support it and which source. Be strict: 'plausible' is not 'supported'.",
            maxIterations: 6,
        },
    };

    @node({
        id: 'b5f973ea-182a-40b4-ae0a-c2ef4760431a',
        name: 'GPT · fact-check',
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        version: 1.2,
        position: [720, 1360],
        credentials: { openAiApi: { id: '__CRED:openai__', name: 'OpenAI' } },
    })
    GptFactCheck = {
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
        id: '17d62a64-cb86-4c27-ab37-07eb6d479db4',
        name: 'Claims',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [920, 1360],
    })
    Claims = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "claims": [
    {
      "claim": "A factual claim from the article",
      "supported": true,
      "source": 1
    }
  ]
}`,
    };

    @node({
        id: '82ae24b6-041d-4dd8-ae54-bfcad97abdf9',
        name: 'Weigh the claims',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1180, 1270],
    })
    WeighTheClaims = {
        jsCode: `const a = $("Read the article").first().json;
const o = $input.first().json.output;
const checked = o && Array.isArray(o.claims);
const unsupported = checked ? o.claims.filter((c) => c && c.supported !== true).map((c) => c.claim) : [];
// A citation to a source that does not exist is unsupported whatever the checker said.
const cited = [...a.body.matchAll(/\\[(\\d+)\\]/g)].map((m) => Number(m[1]));
const phantom = [...new Set(cited.filter((n) => !a.sources.some((s) => s.n === n)))];
if (phantom.length) unsupported.push("cites source " + phantom.join(", ") + ", which does not exist");
return [{ json: { ...a, checked: !!checked, unsupported, clean: !!checked && unsupported.length === 0 && a.written } }];`,
    };

    @node({
        id: '36d3ca0c-e75e-46d9-a015-9287eb36fedb',
        name: 'Every claim supported?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1440, 1270],
    })
    EveryClaimSupported = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '84c77888-90ca-47c1-a2ec-3c56a039c456',
                    leftValue: '={{ $json.clean }}',
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
        id: '03aa2fbb-416c-4810-a61b-8f99d6a1c119',
        name: 'Worth a rewrite?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1700, 1270],
    })
    WorthARewrite = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '77e8781b-a3a3-49dd-a1be-31ceed687567',
                    leftValue: '={{ $json.checked && $json.written && $json.unsupported.length <= 4 }}',
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
        id: '142b8906-f589-4f17-ae45-a51d358df8e5',
        name: 'Editor agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [1960, 1140],
        onError: 'continueRegularOutput',
    })
    EditorAgent = {
        promptType: 'define',
        text: '={{ JSON.stringify({ article: $json.body, unsupported: $json.unsupported, sources: $json.sources }) }}',
        hasOutputParser: false,
        options: {
            systemMessage:
                'You are the Editor agent. Remove or rewrite every listed unsupported claim so the article says only what the sources support. Change nothing else. Return the full article in Markdown.',
            maxIterations: 6,
        },
    };

    @node({
        id: 'fd276988-f10b-4842-acd7-6a08fa1165d9',
        name: 'Claude · editing',
        type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
        version: 1.3,
        position: [1960, 1360],
        credentials: { anthropicApi: { id: '__CRED:anthropic__', name: 'Claude' } },
    })
    ClaudeEditing = {
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
        id: '02e3da50-fd1b-415b-a6e6-c4e78a495f6c',
        name: 'Recheck the edit',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2220, 1270],
    })
    RecheckTheEdit = {
        jsCode: `const a = $("Worth a rewrite?").first().json;
const body = typeof $input.first().json.output === "string" ? $input.first().json.output.trim() : "";
const words = body.split(/\\s+/).filter(Boolean).length;
const cited = [...body.matchAll(/\\[(\\d+)\\]/g)].map((m) => Number(m[1]));
const phantom = cited.some((n) => !a.sources.some((s) => s.n === n));
// The removed claims must be gone: compare on their first few words.
const still = a.unsupported.filter((c) => body.toLowerCase().includes(String(c).toLowerCase().split(/\\s+/).slice(0, 6).join(" ")));
return [{ json: { ...a, body: words >= 150 ? body : a.body, words, edited: true, clean: words >= 150 && !phantom && still.length === 0, unsupported: still } }];`,
    };

    @node({
        id: '427ec507-eba4-4d39-ab67-e0f7bd160455',
        name: 'Clean now?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [2480, 1270],
    })
    CleanNow = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'bbbae641-15d5-4a0f-a2bd-f444b06da26f',
                    leftValue: '={{ $json.clean }}',
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
        id: '4c696a95-dd38-4583-a598-8c3d734bbbef',
        name: 'SEO agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [2840, 1050],
        onError: 'continueRegularOutput',
    })
    SeoAgent = {
        promptType: 'define',
        text: '={{ JSON.stringify({ title: $json.title, keywords: $json.keywords, opening: $json.body.slice(0, 600) }) }}',
        hasOutputParser: true,
        options: {
            systemMessage:
                'You are the SEO agent. Write a meta title (under 60 characters), a meta description (under 155 characters) and a URL slug (lowercase words joined by hyphens) for this article. Describe what the article says; do not oversell it.',
            maxIterations: 6,
        },
    };

    @node({
        id: '6290254e-3df2-4586-ae65-51f64f04fb9d',
        name: 'GPT · SEO',
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        version: 1.2,
        position: [2740, 1270],
        credentials: { openAiApi: { id: '__CRED:openai__', name: 'OpenAI' } },
    })
    GptSeo = {
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
        id: '3e300648-507d-4610-a2f7-0f14a124ba51',
        name: 'Meta',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [2940, 1270],
    })
    Meta = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "meta_title": "Under 60 characters",
  "meta_description": "Under 155 characters",
  "slug": "a-url-slug"
}`,
    };

    @node({
        id: '238c37c2-9d3d-47c8-a49e-78af230c7def',
        name: 'Enforce the limits',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [3200, 1180],
    })
    EnforceTheLimits = {
        jsCode: `const a = $("Clean now?").isExecuted ? $("Clean now?").first().json : $("Every claim supported?").first().json;
const m = $input.first().json.output ?? {};
const slugify = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
// Lengths are cut here, so a model that overshoots cannot break the page.
return [{ json: { ...a, meta_title: String(m.meta_title || a.title).slice(0, 60), meta_description: String(m.meta_description || a.angle || "").slice(0, 155), slug: slugify(m.slug || a.title) } }];`,
    };

    @node({
        id: '658bec1f-f501-4d49-a483-07b833cff87f',
        name: 'Save the draft',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [3460, 1180],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SaveTheDraft = {
        resource: 'row',
        operation: 'create',
        tableId: 'content_drafts',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'topic_id',
                    fieldValue: '={{ $json.topic_id }}',
                },
                {
                    fieldId: 'title',
                    fieldValue: '={{ $json.title }}',
                },
                {
                    fieldId: 'slug',
                    fieldValue: '={{ $json.slug }}',
                },
                {
                    fieldId: 'meta_title',
                    fieldValue: '={{ $json.meta_title }}',
                },
                {
                    fieldId: 'meta_description',
                    fieldValue: '={{ $json.meta_description }}',
                },
                {
                    fieldId: 'keywords',
                    fieldValue: '={{ $json.keywords }}',
                },
                {
                    fieldId: 'sources',
                    fieldValue: '={{ $json.sources }}',
                },
                {
                    fieldId: 'body',
                    fieldValue: '={{ $json.body }}',
                },
                {
                    fieldId: 'words',
                    fieldValue: '={{ $json.words }}',
                },
                {
                    fieldId: 'edited',
                    fieldValue: '={{ $json.edited === true }}',
                },
                {
                    fieldId: 'status',
                    fieldValue: "={{ 'awaiting_approval' }}",
                },
                {
                    fieldId: 'created_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '763661d8-4a9a-4f23-ab02-a31905ea445c',
        name: 'Ask for approval',
        type: 'n8n-nodes-base.slack',
        version: 2.3,
        position: [3720, 1180],
        credentials: { slackApi: { id: '__CRED:slack__', name: 'Slack' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    AskForApproval = {
        resource: 'message',
        operation: 'post',
        select: 'channel',
        channelId: {
            __rl: true,
            mode: 'name',
            value: "={{ '#content' }}",
        },
        text: "={{ ':memo: Draft ready: \"' + $json.title + '\" (' + $json.words + ' words' + ($json.edited ? ', edited after fact-check' : '') + '). Approve or reject draft ' + $json.id + '.' }}",
        otherOptions: {
            includeLinkToWorkflow: false,
        },
    };

    @node({
        id: 'ce905556-58e6-446f-a6c3-1657cb623837',
        name: 'Could not finish',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2840, 1490],
    })
    CouldNotFinish = {
        jsCode: `const candidates = ["Recheck the edit", "Weigh the claims", "Check the outline", "Collect the sources"];
const name = candidates.find((n) => $(n).isExecuted);
const s = $(name).first().json;
const why = !s.enough && name === "Collect the sources" ? "too few sources were found" : !s.outlined && name === "Check the outline" ? "no usable outline could be made" : (s.unsupported ?? []).length ? "claims the sources do not support: " + s.unsupported.slice(0, 3).join("; ") : "the article could not be written";
return [{ json: { topic_id: s.topic_id, topic: s.topic, why } }];`,
    };

    @node({
        id: '5d0b8259-7b93-470d-ad6b-8552ef36186b',
        name: 'Return the topic',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [3200, 1360],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ReturnTheTopic = {
        resource: 'row',
        operation: 'update',
        tableId: 'content_topics',
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'id',
                    condition: 'eq',
                    keyValue: '={{ $json.topic_id }}',
                },
            ],
        },
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'status',
                    fieldValue: "={{ 'needs_brief' }}",
                },
                {
                    fieldId: 'note',
                    fieldValue: '={{ $json.why }}',
                },
            ],
        },
    };

    @node({
        id: '458199c7-e8ac-42b2-ab14-d334f4053a62',
        name: 'Returned message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [3460, 1360],
    })
    ReturnedMessage = {
        jsCode: `const r = $("Could not finish").first().json;
return [{ json: { channel: "#content", level: "warn", text: "\\"" + r.topic + "\\" was sent back for a better brief: " + r.why + "." } }];`,
    };

    @node({
        id: '94016080-39c3-4e28-a045-f858fbb2a5a9',
        name: 'Tell the editor',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [3720, 1360],
    })
    TellTheEditor = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    @node({
        id: '3f89b47f-083d-4e20-a6ff-a0af59eefdcb',
        webhookId: '6c577dad-5ff6-47ea-a6aa-11cad33e4e49',
        name: 'Decision',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 1990],
    })
    Decision = {
        httpMethod: 'POST',
        path: 'content-studio-decision',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        id: 'd3f98ee9-4896-44db-a00c-f3184f81a302',
        name: 'Read the decision',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 1990],
    })
    ReadTheDecision = {
        jsCode: `const b = $input.first().json.body ?? {};
const d = b.decision === "approve" ? "approve" : b.decision === "reject" ? "reject" : null;
return [{ json: { valid: !!d && !!b.draft_id, decision: d, draft_id: String(b.draft_id ?? ""), by: String(b.by ?? "unknown"), reason: String(b.reason ?? "").slice(0, 500) } }];`,
    };

    @node({
        id: '49ffbc3c-db24-4e94-a0d9-3318bc71b07a',
        name: 'Valid?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [520, 1990],
    })
    Valid = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '8ba548b6-353c-474e-a581-189fba03a955',
                    leftValue: '={{ $json.valid }}',
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
        id: '10e1c2d0-f371-40d3-a27a-a06801ec39b2',
        name: 'Bad request',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [780, 1900],
    })
    BadRequest = {
        respondWith: 'json',
        responseBody: "={{ JSON.stringify({ ok: false, error: 'Need draft_id and decision: approve | reject' }) }}",
        options: {
            responseCode: 400,
        },
    };

    @node({
        id: '9b3e481d-7695-4668-afe4-b04572359e60',
        name: 'Take it if pending',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [780, 2080],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    TakeItIfPending = {
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
                    keyValue: '={{ $json.draft_id }}',
                },
                {
                    keyName: 'status',
                    condition: 'eq',
                    keyValue: "={{ 'awaiting_approval' }}",
                },
            ],
        },
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'status',
                    fieldValue: "={{ $json.decision === 'approve' ? 'publishing' : 'rejected' }}",
                },
                {
                    fieldId: 'decided_by',
                    fieldValue: '={{ $json.by }}',
                },
                {
                    fieldId: 'decided_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
                {
                    fieldId: 'reason',
                    fieldValue: '={{ $json.reason }}',
                },
            ],
        },
    };

    @node({
        id: 'bf8e44b7-7a6c-4a9b-a4a7-f386e38f14f4',
        name: 'Awaiting approval?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1040, 1990],
    })
    AwaitingApproval = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '3a75bed8-d918-40a0-a3b4-807a1bba03c9',
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
        id: 'b8754bd1-d965-45ed-a349-3a436112d8f7',
        name: 'Not pending',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [1300, 1900],
    })
    NotPending = {
        respondWith: 'json',
        responseBody: "={{ JSON.stringify({ ok: false, error: 'That draft is not awaiting approval' }) }}",
        options: {
            responseCode: 409,
        },
    };

    @node({
        id: '43df83c4-ac76-4298-a0c3-ea14dbafedea',
        name: 'Approved?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1300, 2080],
    })
    Approved = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'b604e61a-1df5-4742-a368-1493d5c22ea0',
                    leftValue: "={{ $('Read the decision').first().json.decision === 'approve' }}",
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
        id: '2d05d49f-dc0a-40e2-ab72-056a293de906',
        name: 'Rejected',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [1560, 1900],
    })
    Rejected = {
        respondWith: 'json',
        responseBody: "={{ JSON.stringify({ ok: true, status: 'rejected' }) }}",
        options: {
            responseCode: 200,
        },
    };

    @node({
        id: '4080de5e-80bf-4869-a7ad-0faab2fda4d0',
        name: 'Publishing',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [1560, 2080],
    })
    Publishing = {
        respondWith: 'json',
        responseBody: "={{ JSON.stringify({ ok: true, status: 'publishing' }) }}",
        options: {
            responseCode: 200,
        },
    };

    @node({
        id: '3f9e1aa5-f2a5-42a1-a9c2-582cc4665259',
        name: 'Publish to WordPress',
        type: 'n8n-nodes-base.wordpress',
        version: 1,
        position: [0, 2490],
        credentials: { wordpressApi: { id: '__CRED:wordpress__', name: 'WordPress' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PublishToWordpress = {
        resource: 'post',
        operation: 'create',
        title: "={{ $('Awaiting approval?').first().json.title }}",
        additionalFields: {
            content: "={{ $('Awaiting approval?').first().json.body }}",
            status: "={{ 'publish' }}",
        },
    };

    @node({
        id: '409bf789-00d0-4de5-aa4b-e4036df0a045',
        name: 'Mark published',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [260, 2490],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MarkPublished = {
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
                    keyValue: "={{ $('Awaiting approval?').first().json.id }}",
                },
            ],
        },
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'status',
                    fieldValue: "={{ 'published' }}",
                },
                {
                    fieldId: 'post_id',
                    fieldValue: "={{ String($json.id ?? '') }}",
                },
                {
                    fieldId: 'published_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '494a520c-02b3-461e-ab3d-861420c1a73f',
        name: 'Make a cover image',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [520, 2490],
        credentials: { openAiApi: { id: '__CRED:openai__', name: 'OpenAI' } },
        onError: 'continueRegularOutput',
    })
    MakeACoverImage = {
        method: 'POST',
        url: "={{ 'https://api.openai.com/v1/images/generations' }}",
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'openAiApi',
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ model: 'gpt-image-1', prompt: 'An editorial illustration, flat shapes, two colours, no text, for an article titled: ' + $('Awaiting approval?').first().json.title, size: '1536x1024', n: 1 }) }}",
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: 'bbace7cc-d895-41dc-a24c-ec4f3fd24845',
        name: 'Script for the voice',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [780, 2490],
    })
    ScriptForTheVoice = {
        jsCode: `const d = $("Awaiting approval?").first().json;
// Read aloud: no Markdown marks, no citation numbers, no links.
const script = String(d.body).replace(/\\[(\\d+)\\]/g, "").replace(/[#*_>\`]/g, "").replace(/\\[([^\\]]+)\\]\\([^)]+\\)/g, "$1").replace(/\\n{2,}/g, "\\n\\n").trim().slice(0, 4500);
return [{ json: { script, image_url: $input.first().json.data?.[0]?.url ?? null } }];`,
    };

    @node({
        id: 'b662cb26-9cec-4e05-ae70-2fe5e77f2f47',
        name: 'Record the voice-over',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1040, 2490],
        credentials: { httpHeaderAuth: { id: '__CRED:elevenlabs__', name: 'ElevenLabs API key' } },
        onError: 'continueRegularOutput',
    })
    RecordTheVoiceOver = {
        method: 'POST',
        url: "={{ 'https://api.elevenlabs.io/v1/text-to-speech/' + 'narrator' }}",
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: "={{ JSON.stringify({ text: $json.script, model_id: 'eleven_multilingual_v2' }) }}",
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: '0de8a26c-ca3e-4f0c-a538-49e5ab6c07e8',
        name: 'Record the assets',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1300, 2490],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    RecordTheAssets = {
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
                    keyValue: "={{ $('Awaiting approval?').first().json.id }}",
                },
            ],
        },
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'cover_image',
                    fieldValue: "={{ $('Script for the voice').first().json.image_url }}",
                },
                {
                    fieldId: 'has_voice_over',
                    fieldValue: '={{ !$json.error }}',
                },
            ],
        },
    };

    @node({
        id: '78d76b15-7d06-4068-acf1-64214f2c2453',
        name: 'Social agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [100, 2900],
        onError: 'continueRegularOutput',
    })
    SocialAgent = {
        promptType: 'define',
        text: "={{ JSON.stringify({ title: $('Awaiting approval?').first().json.title, description: $('Awaiting approval?').first().json.meta_description, opening: String($('Awaiting approval?').first().json.body).slice(0, 800) }) }}",
        hasOutputParser: true,
        options: {
            systemMessage:
                'You are the Social agent. Write one post per network announcing this article. LinkedIn: three short paragraphs, professional. X: under 250 characters. Facebook: two friendly sentences. Say what the article is about; make no claim the article does not make. No hashtags.',
            maxIterations: 6,
        },
    };

    @node({
        id: 'c82d29e6-9085-494e-abe7-aa1486ca78b7',
        name: 'Claude · social',
        type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
        version: 1.3,
        position: [0, 3120],
        credentials: { anthropicApi: { id: '__CRED:anthropic__', name: 'Claude' } },
    })
    ClaudeSocial = {
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
        id: 'bdee1bb9-3cf2-42a7-a813-900e448a0a0f',
        name: 'Posts',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [200, 3120],
    })
    Posts = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "linkedin": "The LinkedIn post",
  "x": "The X post",
  "facebook": "The Facebook post"
}`,
    };

    @node({
        id: 'ca9d4c1d-bb13-424d-aa62-5aae07e95656',
        name: 'Cut each post to length',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [460, 3030],
    })
    CutEachPostToLength = {
        jsCode: `const d = $("Awaiting approval?").first().json;
const o = $input.first().json.output ?? {};
const link = "https://acme.wordpress.test/" + d.slug;
const plain = "New on the blog: " + d.title;
const limit = { linkedin: 2800, x: 250, facebook: 1500 };
// A post the agent did not write falls back to the plain title, so sharing never waits on a model.
const post = (network) => String(typeof o[network] === "string" && o[network].trim() ? o[network] : plain).slice(0, limit[network]).trim() + "\\n" + link;
return [{ json: { linkedin: post("linkedin"), x: post("x"), facebook: post("facebook") } }];`,
    };

    @node({
        id: 'cfee875e-0c79-450d-afb2-e670a27fa3c7',
        name: 'Post to LinkedIn',
        type: 'n8n-nodes-base.linkedIn',
        version: 1,
        position: [720, 3030],
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
        id: 'b269b6ef-8edf-4582-a70c-7d6ab6b97b37',
        name: 'Post to X',
        type: 'n8n-nodes-base.twitter',
        version: 2,
        position: [980, 3030],
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
        id: 'a7848129-6332-4b72-a0c0-ccad31408c95',
        name: 'Post to Facebook',
        type: 'n8n-nodes-base.facebookGraphApi',
        version: 1,
        position: [1240, 3030],
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
        id: '5376d20e-f617-4b2a-a5ba-c7d9335944cb',
        name: 'Mark shared',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1500, 3030],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
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
                    keyValue: "={{ $('Awaiting approval?').first().json.id }}",
                },
            ],
        },
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'shared_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: 'd6ec603a-f5ab-485f-a7d2-0cae34e18e46',
        name: 'Say it is live',
        type: 'n8n-nodes-base.slack',
        version: 2.3,
        position: [1760, 3030],
        credentials: { slackApi: { id: '__CRED:slack__', name: 'Slack' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SayItIsLive = {
        resource: 'message',
        operation: 'post',
        select: 'channel',
        channelId: {
            __rl: true,
            mode: 'name',
            value: "={{ '#content' }}",
        },
        text: "={{ ':tada: Published and shared: \"' + $('Awaiting approval?').first().json.title + '\"' }}",
        otherOptions: {
            includeLinkToWorkflow: false,
        },
    };

    @node({
        id: '41bef5d3-ea29-4964-a2e2-187bacf069d4',
        name: 'Friday 16:00',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 3790],
    })
    Friday1600 = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 16 * * 5',
                },
            ],
        },
    };

    @node({
        id: '3ab87678-ac5b-466f-a6fe-a2f28fb1ab1d',
        name: 'Published this month',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [260, 3790],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PublishedThisMonth = {
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
                    keyName: 'published_at',
                    condition: 'gte',
                    keyValue: '={{ $now.minus({ days: 30 }).toISO() }}',
                },
            ],
        },
    };

    @node({
        id: 'd3ff5f06-84c1-42af-a7ab-899c4a02f5ca',
        name: 'Count the readers',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [520, 3790],
        credentials: { postHogApi: { id: '__CRED:posthog__', name: 'PostHog' } },
        onError: 'continueRegularOutput',
    })
    CountTheReaders = {
        method: 'POST',
        url: "={{ 'https://app.posthog.com/api/projects/@current/query/' }}",
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'postHogApi',
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ query: { kind: 'HogQLQuery', query: \"select count() from events where event = '$pageview' and properties.$pathname = '\" + '/' + $json.slug + \"' and timestamp > now() - interval 30 day\" } }) }}",
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: 'dcd909b3-59af-4c22-a156-0f0b08b57ec5',
        name: 'Rank the articles',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [780, 3790],
    })
    RankTheArticles = {
        jsCode: `const drafts = $("Published this month").all().map((i) => i.json);
const rows = $input.all().map((item, i) => ({ title: drafts[i]?.title, slug: drafts[i]?.slug, keywords: drafts[i]?.keywords ?? [], views: Number(item.json?.results?.[0]?.[0] ?? NaN) })).filter((r) => r.title);
const known = rows.filter((r) => Number.isFinite(r.views)).sort((a, b) => b.views - a.views);
return [{ json: { measured: known.length, of: rows.length, best: known.slice(0, 3), worst: known.slice(-3).reverse(), existing: rows.map((r) => r.title) } }];`,
    };

    @node({
        id: '2f3e177f-80d8-4e0e-a11e-3e9bfbec2f07',
        name: 'Anything measured?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1040, 3790],
    })
    AnythingMeasured = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '3220a5c7-5cad-4ff9-a59d-852000440df7',
                    leftValue: '={{ $json.measured >= 2 }}',
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
        id: 'b31d27be-ae77-40b0-a3f8-7b0bf808421f',
        name: 'Strategist agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [1400, 3570],
        onError: 'continueRegularOutput',
    })
    StrategistAgent = {
        promptType: 'define',
        text: '={{ JSON.stringify($json) }}',
        hasOutputParser: true,
        options: {
            systemMessage:
                'You are the Strategist agent. From which articles were read most and least, propose three topics for next week. Each must be a clear step on from something that worked, and none may repeat an existing title. Give one sentence of reasoning that refers to the numbers.',
            maxIterations: 6,
        },
    };

    @node({
        id: '3d80f343-b20d-43d4-a195-d37f5c3f624f',
        name: 'Claude · strategy',
        type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
        version: 1.3,
        position: [1300, 3790],
        credentials: { anthropicApi: { id: '__CRED:anthropic__', name: 'Claude' } },
    })
    ClaudeStrategy = {
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
        id: 'eb1aea11-e935-483c-a0d0-b0b0a97d934a',
        name: 'Topics',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [1500, 3790],
    })
    Topics = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "topics": [
    {
      "topic": "A topic to write next",
      "why": "Why, referring to the numbers"
    }
  ]
}`,
    };

    @node({
        id: 'b39dd4d9-5b17-44be-ad27-3b1a52d7413c',
        name: 'Keep the new ones',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1760, 3790],
    })
    KeepTheNewOnes = {
        jsCode: `const r = $("Rank the articles").first().json;
const seen = new Set(r.existing.map((t) => String(t).toLowerCase().trim()));
const out = [];
for (const t of $input.first().json.output?.topics ?? []) {
  const key = String(t?.topic ?? "").toLowerCase().trim();
  if (!key || seen.has(key)) continue;
  seen.add(key);
  out.push({ json: { topic: t.topic.trim(), why: String(t.why ?? "").slice(0, 300) } });
}
return out.slice(0, 3);`,
    };

    @node({
        id: '9bf4bb6c-b4ad-4106-acc8-a829528e06b2',
        name: 'Queue the topic',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [2020, 3790],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    QueueTheTopic = {
        resource: 'row',
        operation: 'create',
        tableId: 'content_topics',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'topic',
                    fieldValue: '={{ $json.topic }}',
                },
                {
                    fieldId: 'note',
                    fieldValue: '={{ $json.why }}',
                },
                {
                    fieldId: 'status',
                    fieldValue: "={{ 'queued' }}",
                },
                {
                    fieldId: 'suggested_by',
                    fieldValue: "={{ 'strategist' }}",
                },
                {
                    fieldId: 'created_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '552cbdf8-c6a2-4160-a68a-c06e3488afbe',
        name: "Post next week's topics",
        type: 'n8n-nodes-base.slack',
        version: 2.3,
        position: [2280, 3790],
        credentials: { slackApi: { id: '__CRED:slack__', name: 'Slack' } },
        executeOnce: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PostNextWeekSTopics = {
        resource: 'message',
        operation: 'post',
        select: 'channel',
        channelId: {
            __rl: true,
            mode: 'name',
            value: "={{ '#content' }}",
        },
        text: "={{ ':compass: Queued for next week: ' + $('Keep the new ones').all().map((i) => i.json.topic).join(' · ') }}",
        otherOptions: {
            includeLinkToWorkflow: false,
        },
    };

    @node({
        id: '0b5d24a0-0017-4b0c-a21d-04511f823593',
        name: 'Too little data yet',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1400, 4010],
    })
    TooLittleDataYet = {};

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Weekdays0700.out(0).to(this.NextTopic.in(0));
        this.NextTopic.out(0).to(this.IsThereATopic.in(0));
        this.IsThereATopic.out(0).to(this.ClaimTheTopic.in(0));
        this.IsThereATopic.out(1).to(this.QueueIsEmpty.in(0));
        this.ClaimTheTopic.out(0).to(this.ClaimedIt.in(0));
        this.ClaimedIt.out(0).to(this.SearchTheTopic.in(0));
        this.ClaimedIt.out(1).to(this.AnotherRunHasIt.in(0));
        this.SearchTheTopic.out(0).to(this.CollectTheSources.in(0));
        this.CollectTheSources.out(0).to(this.EnoughToWriteFrom.in(0));
        this.EnoughToWriteFrom.out(0).to(this.ResearchAgent.in(0));
        this.EnoughToWriteFrom.out(1).to(this.CouldNotFinish.in(0));
        this.ResearchAgent.out(0).to(this.KeepTheSupportedPoints.in(0));
        this.KeepTheSupportedPoints.out(0).to(this.OutlineAgent.in(0));
        this.OutlineAgent.out(0).to(this.CheckTheOutline.in(0));
        this.CheckTheOutline.out(0).to(this.UsableOutline.in(0));
        this.UsableOutline.out(0).to(this.WriterAgent.in(0));
        this.UsableOutline.out(1).to(this.CouldNotFinish.in(0));
        this.WriterAgent.out(0).to(this.ReadTheArticle.in(0));
        this.ReadTheArticle.out(0).to(this.FactCheckAgent.in(0));
        this.FactCheckAgent.out(0).to(this.WeighTheClaims.in(0));
        this.WeighTheClaims.out(0).to(this.EveryClaimSupported.in(0));
        this.EveryClaimSupported.out(0).to(this.SeoAgent.in(0));
        this.EveryClaimSupported.out(1).to(this.WorthARewrite.in(0));
        this.SeoAgent.out(0).to(this.EnforceTheLimits.in(0));
        this.EnforceTheLimits.out(0).to(this.SaveTheDraft.in(0));
        this.SaveTheDraft.out(0).to(this.AskForApproval.in(0));
        this.WorthARewrite.out(0).to(this.EditorAgent.in(0));
        this.WorthARewrite.out(1).to(this.CouldNotFinish.in(0));
        this.EditorAgent.out(0).to(this.RecheckTheEdit.in(0));
        this.RecheckTheEdit.out(0).to(this.CleanNow.in(0));
        this.CleanNow.out(0).to(this.SeoAgent.in(0));
        this.CleanNow.out(1).to(this.CouldNotFinish.in(0));
        this.CouldNotFinish.out(0).to(this.ReturnTheTopic.in(0));
        this.ReturnTheTopic.out(0).to(this.ReturnedMessage.in(0));
        this.ReturnedMessage.out(0).to(this.TellTheEditor.in(0));
        this.Decision.out(0).to(this.ReadTheDecision.in(0));
        this.ReadTheDecision.out(0).to(this.Valid.in(0));
        this.Valid.out(0).to(this.TakeItIfPending.in(0));
        this.Valid.out(1).to(this.BadRequest.in(0));
        this.TakeItIfPending.out(0).to(this.AwaitingApproval.in(0));
        this.AwaitingApproval.out(0).to(this.Approved.in(0));
        this.AwaitingApproval.out(1).to(this.NotPending.in(0));
        this.Approved.out(0).to(this.Publishing.in(0));
        this.Approved.out(1).to(this.Rejected.in(0));
        this.Publishing.out(0).to(this.PublishToWordpress.in(0));
        this.PublishToWordpress.out(0).to(this.MarkPublished.in(0));
        this.MarkPublished.out(0).to(this.MakeACoverImage.in(0));
        this.MakeACoverImage.out(0).to(this.ScriptForTheVoice.in(0));
        this.ScriptForTheVoice.out(0).to(this.RecordTheVoiceOver.in(0));
        this.RecordTheVoiceOver.out(0).to(this.RecordTheAssets.in(0));
        this.RecordTheAssets.out(0).to(this.SocialAgent.in(0));
        this.SocialAgent.out(0).to(this.CutEachPostToLength.in(0));
        this.CutEachPostToLength.out(0).to(this.PostToLinkedin.in(0));
        this.PostToLinkedin.out(0).to(this.PostToX.in(0));
        this.PostToX.out(0).to(this.PostToFacebook.in(0));
        this.PostToFacebook.out(0).to(this.MarkShared.in(0));
        this.MarkShared.out(0).to(this.SayItIsLive.in(0));
        this.Friday1600.out(0).to(this.PublishedThisMonth.in(0));
        this.PublishedThisMonth.out(0).to(this.CountTheReaders.in(0));
        this.CountTheReaders.out(0).to(this.RankTheArticles.in(0));
        this.RankTheArticles.out(0).to(this.AnythingMeasured.in(0));
        this.AnythingMeasured.out(0).to(this.StrategistAgent.in(0));
        this.AnythingMeasured.out(1).to(this.TooLittleDataYet.in(0));
        this.StrategistAgent.out(0).to(this.KeepTheNewOnes.in(0));
        this.KeepTheNewOnes.out(0).to(this.QueueTheTopic.in(0));
        this.QueueTheTopic.out(0).to(this.PostNextWeekSTopics.in(0));

        this.ResearchAgent.uses({
            ai_languageModel: this.ClaudeResearch.output,
            ai_outputParser: this.ResearchNotes.output,
            ai_tool: [this.ReasonItThrough.output],
        });
        this.OutlineAgent.uses({
            ai_languageModel: this.ClaudeOutline.output,
            ai_outputParser: this.Outline.output,
            ai_tool: [this.PastArticles.output],
        });
        this.PastArticles.uses({
            ai_embedding: this.EmbeddingsPastArticles.output,
        });
        this.WriterAgent.uses({
            ai_languageModel: this.ClaudeWriting.output,
            ai_tool: [this.HouseStyle.output],
        });
        this.HouseStyle.uses({
            ai_embedding: this.EmbeddingsStyle.output,
        });
        this.FactCheckAgent.uses({
            ai_languageModel: this.GptFactCheck.output,
            ai_outputParser: this.Claims.output,
        });
        this.EditorAgent.uses({
            ai_languageModel: this.ClaudeEditing.output,
        });
        this.SeoAgent.uses({
            ai_languageModel: this.GptSeo.output,
            ai_outputParser: this.Meta.output,
        });
        this.SocialAgent.uses({
            ai_languageModel: this.ClaudeSocial.output,
            ai_outputParser: this.Posts.output,
        });
        this.StrategistAgent.uses({
            ai_languageModel: this.ClaudeStrategy.output,
            ai_outputParser: this.Topics.output,
        });
    }
}
