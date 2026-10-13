import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Research · Content aggregation engine
// Nodes   : 67  |  Connections: 61
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// SectionScrapeSources               stickyNote
// SectionScrapeContent               stickyNote
// SectionValidation                  stickyNote
// SectionStoreData                   stickyNote
// Schedule1                          scheduleTrigger
// GetFeed1                           httpRequest                [retry]
// SplitResults1                      splitOut
// ReadFeed1                          rssFeedRead                [onError→regular] [retry]
// FilterRecent1                      filter
// DataManipulation1                  code
// Schedule2                          scheduleTrigger
// GetFeed2                           httpRequest                [retry]
// SplitResults2                      splitOut
// ReadFeed2                          rssFeedRead                [onError→regular] [retry]
// FilterRecent2                      filter
// DataManipulation2                  code
// Schedule3                          scheduleTrigger
// GetFeed3                           httpRequest                [retry]
// SplitResults3                      splitOut
// ReadFeed3                          rssFeedRead                [onError→regular] [retry]
// FilterRecent3                      filter
// DataManipulation3                  code
// Schedule4                          scheduleTrigger
// GetBlog1                           httpRequest                [retry]
// SplitResults4                      splitOut
// DataManipulation4                  code
// Schedule5                          scheduleTrigger
// GetBlog2                           httpRequest                [retry]
// SplitResults5                      splitOut
// DataManipulation5                  code
// Schedule6                          scheduleTrigger
// GetBlog3                           httpRequest                [retry]
// SplitResults6                      splitOut
// DataManipulation6                  code
// Schedule7                          scheduleTrigger
// GetBlog4                           httpRequest                [retry]
// SplitResults7                      splitOut
// DataManipulation7                  code
// Schedule8                          scheduleTrigger
// GetBlog5                           httpRequest                [retry]
// SplitResults8                      splitOut
// DataManipulation8                  code
// Schedule9                          scheduleTrigger
// GetBlog6                           httpRequest                [retry]
// SplitResults9                      splitOut
// DataManipulation9                  code
// Schedule10                         scheduleTrigger
// GetBlog7                           httpRequest                [retry]
// SplitResults10                     splitOut
// DataManipulation10                 code
// SetItem                            set
// ForEachContent                     splitInBatches
// GetFiles                           googleDrive                [creds] [alwaysOutput] [retry]
// SkipExisting                       if
// SetUrl                             set
// ScrapeUrl                          executeWorkflow            [onError→regular]
// FilterScrapeErrors                 if
// ValidateContent                    chainLlm                   [AI] [onError→regular]
// GoogleGeminiChatModel              lmChatGoogleGemini         [creds] [ai_languageModel]
// ContentParser                      outputParserAutofixing     [AI] [ai_outputParser]
// GroqChatModel                      lmChatGroq                 [creds] [ai_languageModel]
// StructuredOutputParser             outputParserStructured     [ai_outputParser]
// FilterRelevant                     if
// FormatMarkdown                     set
// UploadFile                         googleDrive                [creds] [retry]
// CreateObjectInfo                   supabase                   [creds] [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Schedule1
//    → GetFeed1
//      → SplitResults1
//        → ReadFeed1
//          → FilterRecent1
//            → DataManipulation1
//              → SetItem
//                → ForEachContent
//                 .out(1) → GetFiles
//                    → SkipExisting
//                      → SetUrl
//                        → ScrapeUrl
//                          → FilterScrapeErrors
//                            → ValidateContent
//                              → FilterRelevant
//                                → FormatMarkdown
//                                  → UploadFile
//                                    → CreateObjectInfo
//                                      → ForEachContent (↩ loop)
//                               .out(1) → ForEachContent (↩ loop)
//                           .out(1) → ForEachContent (↩ loop)
//                     .out(1) → ForEachContent (↩ loop)
// Schedule2
//    → GetFeed2
//      → SplitResults2
//        → ReadFeed2
//          → FilterRecent2
//            → DataManipulation2
//              → SetItem (↩ loop)
// Schedule3
//    → GetFeed3
//      → SplitResults3
//        → ReadFeed3
//          → FilterRecent3
//            → DataManipulation3
//              → SetItem (↩ loop)
// Schedule4
//    → GetBlog1
//      → SplitResults4
//        → DataManipulation4
//          → SetItem (↩ loop)
// Schedule5
//    → GetBlog2
//      → SplitResults5
//        → DataManipulation5
//          → SetItem (↩ loop)
// Schedule6
//    → GetBlog3
//      → SplitResults6
//        → DataManipulation6
//          → SetItem (↩ loop)
// Schedule7
//    → GetBlog4
//      → SplitResults7
//        → DataManipulation7
//          → SetItem (↩ loop)
// Schedule8
//    → GetBlog5
//      → SplitResults8
//        → DataManipulation8
//          → SetItem (↩ loop)
// Schedule9
//    → GetBlog6
//      → SplitResults9
//        → DataManipulation9
//          → SetItem (↩ loop)
// Schedule10
//    → GetBlog7
//      → SplitResults10
//        → DataManipulation10
//          → SetItem (↩ loop)
//
// AI CONNECTIONS
// ValidateContent.uses({ ai_languageModel: GoogleGeminiChatModel, ai_outputParser: ContentParser })
// ContentParser.uses({ ai_languageModel: GroqChatModel, ai_outputParser: StructuredOutputParser })
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Research · Content aggregation engine',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class ResearchContentAggregationEngineWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '7eaaf3aa-2585-4da9-a2ba-b990a5adb283',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -220],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Research · Content aggregation engine
Ten sources are checked on their own schedules: forum feeds and industry blogs. Each new article is scraped in full, judged for relevance to the audience by Gemini, and the ones that pass are saved as Markdown in Google Drive and indexed in Supabase for the newsletter.

**Platforms:** RSS, Google Drive, Gemini, Groq, Supabase
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`production/newsletter-research\``,
    };

    @node({
        id: '16990ab2-ddfb-487c-ae80-c51dae80e2e5',
        name: 'Section: Scrape sources',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 0],
    })
    SectionScrapeSources = {
        width: 1940,
        height: 1950,
        color: 4,
        content: `## 1. Scrape sources
Three forum feeds and seven blogs, each on its own schedule, all put in one shape.`,
    };

    @node({
        id: 'ff0e0352-f07b-44aa-a59f-49769fe07031',
        name: 'Section: Scrape content',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 2030],
    })
    SectionScrapeContent = {
        width: 380,
        height: 1050,
        color: 5,
        content: `## 2. Scrape content
One article at a time. An article already in the store is skipped; a new one is fetched in full.`,
    };

    @node({
        id: '0b98b583-b407-440b-a468-b4c262bd948b',
        name: 'Section: Validation',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 3160],
    })
    SectionValidation = {
        width: 1100,
        height: 770,
        color: 6,
        content: `## 3. Validation
A page that did not load is dropped. A model decides whether the rest is relevant to the audience.`,
    };

    @node({
        id: 'eaf23f69-0364-42b3-af98-4731abb6356f',
        name: 'Section: Store data',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 4010],
    })
    SectionStoreData = {
        width: 900,
        height: 330,
        color: 3,
        content: `## 4. Store data
Markdown in Google Drive, an index row in Supabase.`,
    };

    @node({
        id: '8ab0e696-ba83-4a18-a241-222d20e9c04d',
        name: 'schedule_1',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 200],
    })
    Schedule1 = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '5 5 * * *',
                },
            ],
        },
    };

    @node({
        id: '4fb5ff34-6c97-4695-aace-d43ad12f9040',
        name: 'get_feed_1',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 200],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetFeed1 = {
        method: 'GET',
        url: "={{ 'https://feeds.acme.example/forum-1/index.json' }}",
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: 'bd2ee07b-f2d0-4485-addd-083f6b1ae320',
        name: 'split_results_1',
        type: 'n8n-nodes-base.splitOut',
        version: 1,
        position: [520, 200],
    })
    SplitResults1 = {
        fieldToSplitOut: 'feeds',
        options: {},
    };

    @node({
        id: 'a5468543-d598-4045-ac67-4e01eb122d83',
        name: 'read_feed_1',
        type: 'n8n-nodes-base.rssFeedRead',
        version: 1.2,
        position: [780, 200],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ReadFeed1 = {
        url: '={{ $json.url }}',
        options: {},
    };

    @node({
        id: '609b630e-3826-4fc8-a7db-58ac62c143f9',
        name: 'filter_recent_1',
        type: 'n8n-nodes-base.filter',
        version: 2.2,
        position: [1040, 830],
    })
    FilterRecent1 = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'c348d67f-fa45-4156-a1f6-c9563c1804bc',
                    leftValue:
                        '={{ !!$json.link && !!$json.isoDate && new Date($json.isoDate) >= new Date(Date.now() - 24 * 3600 * 1000) }}',
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
        id: '069ddbd2-d8be-4a10-a5b4-aaac7d406e8d',
        name: 'data_manipulation_1',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1300, 830],
    })
    DataManipulation1 = {
        jsCode: 'return $input.all().map((i) => i.json).filter((p) => p.link && p.title).map((p) => ({ json: { url: String(p.link), title: String(p.title).trim(), source: "forum-1", published: p.isoDate ?? p.published_at ?? p.date ?? null } }));',
    };

    @node({
        id: '6fef11d1-3c4a-4ce6-add0-d631fb12a76a',
        name: 'schedule_2',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 380],
    })
    Schedule2 = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '10 5 * * *',
                },
            ],
        },
    };

    @node({
        id: '13f223ca-1c3b-4ab4-ac67-985ea3ce22a7',
        name: 'get_feed_2',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 380],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetFeed2 = {
        method: 'GET',
        url: "={{ 'https://feeds.acme.example/forum-2/index.json' }}",
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: 'c16ea44b-bc6d-4241-a6cd-a3863982c92d',
        name: 'split_results_2',
        type: 'n8n-nodes-base.splitOut',
        version: 1,
        position: [520, 380],
    })
    SplitResults2 = {
        fieldToSplitOut: 'feeds',
        options: {},
    };

    @node({
        id: '9b49258d-f13e-4903-aefe-413c792593c7',
        name: 'read_feed_2',
        type: 'n8n-nodes-base.rssFeedRead',
        version: 1.2,
        position: [780, 380],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ReadFeed2 = {
        url: '={{ $json.url }}',
        options: {},
    };

    @node({
        id: '23853e08-995d-4f6c-ad3c-cea77ea86b7b',
        name: 'filter_recent_2',
        type: 'n8n-nodes-base.filter',
        version: 2.2,
        position: [1040, 1010],
    })
    FilterRecent2 = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'fb857228-53e1-4fcb-a244-3fa9ffc775a2',
                    leftValue:
                        '={{ !!$json.link && !!$json.isoDate && new Date($json.isoDate) >= new Date(Date.now() - 24 * 3600 * 1000) }}',
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
        id: '9748ce57-30c4-4f36-a493-6ab7f8664b3e',
        name: 'data_manipulation_2',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1300, 1010],
    })
    DataManipulation2 = {
        jsCode: 'return $input.all().map((i) => i.json).filter((p) => p.link && p.title).map((p) => ({ json: { url: String(p.link), title: String(p.title).trim(), source: "forum-2", published: p.isoDate ?? p.published_at ?? p.date ?? null } }));',
    };

    @node({
        id: 'ad02aa37-bef0-4e4d-a285-a84112220cc7',
        name: 'schedule_3',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 560],
    })
    Schedule3 = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '15 5 * * *',
                },
            ],
        },
    };

    @node({
        id: 'ee864c45-6c6b-48ca-a8c6-fdce733fb303',
        name: 'get_feed_3',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 560],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetFeed3 = {
        method: 'GET',
        url: "={{ 'https://feeds.acme.example/forum-3/index.json' }}",
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: '37503579-5526-4d91-af5a-54fa6fd2a95a',
        name: 'split_results_3',
        type: 'n8n-nodes-base.splitOut',
        version: 1,
        position: [520, 560],
    })
    SplitResults3 = {
        fieldToSplitOut: 'feeds',
        options: {},
    };

    @node({
        id: 'c36ecbea-22c3-44dc-ad42-6e600679385d',
        name: 'read_feed_3',
        type: 'n8n-nodes-base.rssFeedRead',
        version: 1.2,
        position: [780, 560],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ReadFeed3 = {
        url: '={{ $json.url }}',
        options: {},
    };

    @node({
        id: '0f748bdd-0cd2-497f-a5f9-a36869c57023',
        name: 'filter_recent_3',
        type: 'n8n-nodes-base.filter',
        version: 2.2,
        position: [1040, 1190],
    })
    FilterRecent3 = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '7de90572-049c-4e38-a78d-f863851acfd8',
                    leftValue:
                        '={{ !!$json.link && !!$json.isoDate && new Date($json.isoDate) >= new Date(Date.now() - 24 * 3600 * 1000) }}',
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
        id: '90840b63-9895-434c-a9b4-c8c15bf1b3f1',
        name: 'data_manipulation_3',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1300, 1190],
    })
    DataManipulation3 = {
        jsCode: 'return $input.all().map((i) => i.json).filter((p) => p.link && p.title).map((p) => ({ json: { url: String(p.link), title: String(p.title).trim(), source: "forum-3", published: p.isoDate ?? p.published_at ?? p.date ?? null } }));',
    };

    @node({
        id: 'c4811d1f-04f1-4e08-a430-1e1f4e73a2b9',
        name: 'schedule_4',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 740],
    })
    Schedule4 = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '20 5 * * *',
                },
            ],
        },
    };

    @node({
        id: '15ff2013-64e2-4366-a8ad-affb19808206',
        name: 'get_blog_1',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 740],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetBlog1 = {
        method: 'GET',
        url: "={{ 'https://feeds.acme.example/blog-1/posts.json' }}",
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: '8729a12d-1ac5-4f48-a5b6-6008ab223cd1',
        name: 'split_results_4',
        type: 'n8n-nodes-base.splitOut',
        version: 1,
        position: [520, 740],
    })
    SplitResults4 = {
        fieldToSplitOut: 'posts',
        options: {},
    };

    @node({
        id: '02cdd797-04b4-4fe6-a218-2b1e8146eb97',
        name: 'data_manipulation_4',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [780, 740],
    })
    DataManipulation4 = {
        jsCode: 'return $input.all().map((i) => i.json).filter((p) => p.url && p.title).map((p) => ({ json: { url: String(p.url), title: String(p.title).trim(), source: "blog-1", published: p.isoDate ?? p.published_at ?? p.date ?? null } }));',
    };

    @node({
        id: 'b47b6c2c-0629-4ee3-ae35-41ea049beea9',
        name: 'schedule_5',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 920],
    })
    Schedule5 = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '25 5 * * *',
                },
            ],
        },
    };

    @node({
        id: '87c782fc-6aba-433d-a6d3-24fccd0c3789',
        name: 'get_blog_2',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 920],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetBlog2 = {
        method: 'GET',
        url: "={{ 'https://feeds.acme.example/blog-2/posts.json' }}",
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: '4112067b-a133-4e2f-aa63-ada57eb80d46',
        name: 'split_results_5',
        type: 'n8n-nodes-base.splitOut',
        version: 1,
        position: [520, 920],
    })
    SplitResults5 = {
        fieldToSplitOut: 'posts',
        options: {},
    };

    @node({
        id: 'cc00fe85-41ea-42a7-a8c1-1a5edb8e57b1',
        name: 'data_manipulation_5',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [780, 920],
    })
    DataManipulation5 = {
        jsCode: 'return $input.all().map((i) => i.json).filter((p) => p.url && p.title).map((p) => ({ json: { url: String(p.url), title: String(p.title).trim(), source: "blog-2", published: p.isoDate ?? p.published_at ?? p.date ?? null } }));',
    };

    @node({
        id: 'f31bf5c0-1266-4a14-aa01-3f973fec4edc',
        name: 'schedule_6',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 1100],
    })
    Schedule6 = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '30 5 * * *',
                },
            ],
        },
    };

    @node({
        id: '8311f668-6908-4543-a3cc-7b83b52d00da',
        name: 'get_blog_3',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 1100],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetBlog3 = {
        method: 'GET',
        url: "={{ 'https://feeds.acme.example/blog-3/posts.json' }}",
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: 'e5085dc4-2059-43ec-a734-271b04988425',
        name: 'split_results_6',
        type: 'n8n-nodes-base.splitOut',
        version: 1,
        position: [520, 1100],
    })
    SplitResults6 = {
        fieldToSplitOut: 'posts',
        options: {},
    };

    @node({
        id: '2a3b9257-613b-4c1a-aeba-6eccaac6ff24',
        name: 'data_manipulation_6',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [780, 1100],
    })
    DataManipulation6 = {
        jsCode: 'return $input.all().map((i) => i.json).filter((p) => p.url && p.title).map((p) => ({ json: { url: String(p.url), title: String(p.title).trim(), source: "blog-3", published: p.isoDate ?? p.published_at ?? p.date ?? null } }));',
    };

    @node({
        id: '65ba74e8-b9e2-424d-aea5-4a715381795d',
        name: 'schedule_7',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 1280],
    })
    Schedule7 = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '35 5 * * *',
                },
            ],
        },
    };

    @node({
        id: '8f58b7b6-aa38-46a3-a30f-2a99b7cd22bc',
        name: 'get_blog_4',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 1280],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetBlog4 = {
        method: 'GET',
        url: "={{ 'https://feeds.acme.example/blog-4/posts.json' }}",
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: 'a5db3454-cab4-4ce8-a0a2-5dcf93e2cf9a',
        name: 'split_results_7',
        type: 'n8n-nodes-base.splitOut',
        version: 1,
        position: [520, 1280],
    })
    SplitResults7 = {
        fieldToSplitOut: 'posts',
        options: {},
    };

    @node({
        id: '36316ef2-7e83-4019-a226-253209d20fa1',
        name: 'data_manipulation_7',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [780, 1280],
    })
    DataManipulation7 = {
        jsCode: 'return $input.all().map((i) => i.json).filter((p) => p.url && p.title).map((p) => ({ json: { url: String(p.url), title: String(p.title).trim(), source: "blog-4", published: p.isoDate ?? p.published_at ?? p.date ?? null } }));',
    };

    @node({
        id: '237ab75d-ff75-486a-a259-cdf564fd212d',
        name: 'schedule_8',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 1460],
    })
    Schedule8 = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '40 5 * * *',
                },
            ],
        },
    };

    @node({
        id: '1623ef7a-dfe6-4242-a429-ff65c4866c30',
        name: 'get_blog_5',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 1460],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetBlog5 = {
        method: 'GET',
        url: "={{ 'https://feeds.acme.example/blog-5/posts.json' }}",
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: '7529820c-9930-4257-a1fe-ec40347172ac',
        name: 'split_results_8',
        type: 'n8n-nodes-base.splitOut',
        version: 1,
        position: [520, 1460],
    })
    SplitResults8 = {
        fieldToSplitOut: 'posts',
        options: {},
    };

    @node({
        id: '427894f4-89ab-4b70-a990-4e4ce562b8d9',
        name: 'data_manipulation_8',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [780, 1460],
    })
    DataManipulation8 = {
        jsCode: 'return $input.all().map((i) => i.json).filter((p) => p.url && p.title).map((p) => ({ json: { url: String(p.url), title: String(p.title).trim(), source: "blog-5", published: p.isoDate ?? p.published_at ?? p.date ?? null } }));',
    };

    @node({
        id: '6b604033-ceb4-4d88-a90b-a195f838854f',
        name: 'schedule_9',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 1640],
    })
    Schedule9 = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '45 5 * * *',
                },
            ],
        },
    };

    @node({
        id: 'c75d1adb-e62e-489f-a3be-ded250a33b54',
        name: 'get_blog_6',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 1640],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetBlog6 = {
        method: 'GET',
        url: "={{ 'https://feeds.acme.example/blog-6/posts.json' }}",
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: 'e1538e02-ca8e-48c8-a0d5-f160c395652b',
        name: 'split_results_9',
        type: 'n8n-nodes-base.splitOut',
        version: 1,
        position: [520, 1640],
    })
    SplitResults9 = {
        fieldToSplitOut: 'posts',
        options: {},
    };

    @node({
        id: '0f615f03-56e9-4f71-a573-3411d178547f',
        name: 'data_manipulation_9',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [780, 1640],
    })
    DataManipulation9 = {
        jsCode: 'return $input.all().map((i) => i.json).filter((p) => p.url && p.title).map((p) => ({ json: { url: String(p.url), title: String(p.title).trim(), source: "blog-6", published: p.isoDate ?? p.published_at ?? p.date ?? null } }));',
    };

    @node({
        id: 'c1d1c64e-e6a3-4e5e-aa12-734d9850af11',
        name: 'schedule_10',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 1820],
    })
    Schedule10 = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '50 5 * * *',
                },
            ],
        },
    };

    @node({
        id: '01c716aa-d21b-46c2-a08e-3c57b182b85a',
        name: 'get_blog_7',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 1820],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetBlog7 = {
        method: 'GET',
        url: "={{ 'https://feeds.acme.example/blog-7/posts.json' }}",
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: '123c636c-1183-4cf8-a858-3ba8956c7dc6',
        name: 'split_results_10',
        type: 'n8n-nodes-base.splitOut',
        version: 1,
        position: [520, 1820],
    })
    SplitResults10 = {
        fieldToSplitOut: 'posts',
        options: {},
    };

    @node({
        id: 'c8433e8c-a4d2-4991-a18e-e980cf7e12d7',
        name: 'data_manipulation_10',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [780, 1820],
    })
    DataManipulation10 = {
        jsCode: 'return $input.all().map((i) => i.json).filter((p) => p.url && p.title).map((p) => ({ json: { url: String(p.url), title: String(p.title).trim(), source: "blog-7", published: p.isoDate ?? p.published_at ?? p.date ?? null } }));',
    };

    @node({
        id: '1637fd95-e09e-4902-af25-ab5eba713e8b',
        name: 'set_item',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [1560, 1010],
    })
    SetItem = {
        assignments: {
            assignments: [
                {
                    id: '4158ae16-e267-427b-a51d-89e54f4e340c',
                    name: 'url',
                    value: '={{ $json.url }}',
                    type: 'string',
                },
                {
                    id: '85ef629f-1461-488d-ad26-434e9848cc0a',
                    name: 'title',
                    value: '={{ $json.title }}',
                    type: 'string',
                },
                {
                    id: '1c97d5cb-3515-4ab5-a777-7b05c154ee99',
                    name: 'source',
                    value: '={{ $json.source }}',
                    type: 'string',
                },
                {
                    id: '48dd3b17-207f-4026-a736-c173cbd688c8',
                    name: 'published',
                    value: "={{ $json.published ?? '' }}",
                    type: 'string',
                },
                {
                    id: 'f29cbf3a-8873-47de-a3ea-6f074e07a994',
                    name: 'date',
                    value: "={{ $now.toFormat('yyyy-MM-dd') }}",
                    type: 'string',
                },
                {
                    id: '9977b998-587e-4001-abb3-7583540fecad',
                    name: 'slug',
                    value: "={{ String($json.url).replace(/^https?:\\/\\//, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 80) }}",
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '3b24872d-0c61-42b5-a993-aef6df65d393',
        name: 'for_each_content',
        type: 'n8n-nodes-base.splitInBatches',
        version: 3,
        position: [0, 2230],
    })
    ForEachContent = {
        batchSize: 1,
        options: {},
    };

    @node({
        id: '5b160da5-8aa4-4ae7-a491-05552fd5f5eb',
        name: 'get_files',
        type: 'n8n-nodes-base.googleDrive',
        version: 3,
        position: [0, 2410],
        credentials: { googleDriveOAuth2Api: { id: '__CRED:googleDrive__', name: 'Google Drive' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetFiles = {
        resource: 'fileFolder',
        operation: 'search',
        searchMethod: 'name',
        queryString: '={{ $json.slug }}',
        returnAll: true,
        filter: {
            folderId: {
                __rl: true,
                mode: 'id',
                value: 'research-folder',
            },
        },
        options: {},
    };

    @node({
        id: '6f1a15d7-c549-4aee-a8f6-cda6419c158e',
        name: 'skip_existing',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [0, 2590],
    })
    SkipExisting = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '6612d379-00b8-482a-a415-7d4fa2fd868d',
                    leftValue: '={{ !$json.id }}',
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
        id: '0f1da4df-854d-4b83-ae38-d036575af396',
        name: 'set_url',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [0, 2770],
    })
    SetUrl = {
        assignments: {
            assignments: [
                {
                    id: 'a03c04be-e98d-414c-adca-7c6b29a94613',
                    name: 'url',
                    value: "={{ $('for_each_content').first().json.url }}",
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: 'e6c0ac2f-8a1c-410d-a6dd-11187ad425ad',
        name: 'scrape_url',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [0, 2950],
        onError: 'continueRegularOutput',
    })
    ScrapeUrl = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:scrape-page__',
        },
        options: {},
    };

    @node({
        id: 'e302e64c-df4b-4d6a-a5ce-5fb189b984a1',
        name: 'filter_scrape_errors',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [0, 3580],
    })
    FilterScrapeErrors = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'c42b3690-ccef-4e35-aba3-eff6090e6e05',
                    leftValue: "={{ $json.ok === true && String($json.text ?? '').length >= 200 }}",
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
        id: '58a57eaf-0957-4779-a25c-172a205b9595',
        name: 'validate_content',
        type: '@n8n/n8n-nodes-langchain.chainLlm',
        version: 1.7,
        position: [360, 3360],
        onError: 'continueRegularOutput',
    })
    ValidateContent = {
        promptType: 'define',
        text: "={{ 'Title: ' + $('for_each_content').first().json.title + '\\nSource: ' + $('for_each_content').first().json.source + '\\n\\n' + String($json.text).slice(0, 12000) }}",
        hasOutputParser: true,
        messages: {
            messageValues: [
                {
                    type: 'SystemMessagePromptTemplate',
                    message:
                        "[task:validate-content] You screen articles for a daily industry newsletter. Decide whether this article is relevant to the newsletter's readers: it must be news or analysis about the industry, published recently, and more than an advert or a listing. Give its topic in a few words, a two-sentence summary using only what the article says, and one sentence on why it is or is not relevant.",
                },
            ],
        },
        batching: {},
    };

    @node({
        id: '6f2b41dc-0ec7-458d-ad25-547d3e518aaa',
        name: 'Google Gemini Chat Model',
        type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
        version: 1,
        position: [260, 3580],
        credentials: { googlePalmApi: { id: '__CRED:gemini__', name: 'Gemini' } },
    })
    GoogleGeminiChatModel = {
        modelName: 'models/gemini-2.5-flash',
        options: {
            temperature: 0.4,
        },
    };

    @node({
        id: 'ee2bd1fd-65a1-404c-a392-84236afcc61b',
        name: 'content_parser',
        type: '@n8n/n8n-nodes-langchain.outputParserAutofixing',
        version: 1,
        position: [460, 3580],
    })
    ContentParser = {
        options: {},
    };

    @node({
        id: 'f41cc968-f10b-4d91-ae66-d003ac97392a',
        name: 'Groq Chat Model',
        type: '@n8n/n8n-nodes-langchain.lmChatGroq',
        version: 1,
        position: [360, 3800],
        credentials: { groqApi: { id: '__CRED:groq__', name: 'Groq' } },
    })
    GroqChatModel = {
        model: 'llama-3.3-70b-versatile',
        options: {
            temperature: 0,
        },
    };

    @node({
        id: 'e69193aa-5741-4585-a898-fb6ba9fc8708',
        name: 'Structured Output Parser',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [560, 3800],
    })
    StructuredOutputParser = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "relevant": true,
  "topic": "A few words",
  "summary": "Two sentences.",
  "reason": "One sentence."
}`,
    };

    @node({
        id: '6df11f05-46a4-4caa-a69b-a3ffc9f55ffb',
        name: 'filter_relevant',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [720, 3580],
    })
    FilterRelevant = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'fcd5ef50-0d83-42da-a173-6f7548f6c684',
                    leftValue: '={{ $json.output?.relevant === true }}',
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
        id: '9e490cef-1232-4fe7-a61f-e881327c0e15',
        name: 'format_markdown',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [0, 4210],
    })
    FormatMarkdown = {
        assignments: {
            assignments: [
                {
                    id: '9248fd29-2b5c-4c6a-aef3-584262254165',
                    name: 'file_name',
                    value: "={{ $('for_each_content').first().json.date + ' ' + $('for_each_content').first().json.slug + '.md' }}",
                    type: 'string',
                },
                {
                    id: 'fd04efcd-b1c6-4080-a261-b104a4fe7a1b',
                    name: 'markdown',
                    value: "={{ '# ' + $('for_each_content').first().json.title + '\\n\\nSource: ' + $('for_each_content').first().json.url + '\\nTopic: ' + $json.output.topic + '\\n\\n## Summary\\n' + $json.output.summary + '\\n\\n## Full text\\n' + $('scrape_url').first().json.text }}",
                    type: 'string',
                },
                {
                    id: '7b4bb6a2-01ed-4c17-acd0-f8837834871f',
                    name: 'topic',
                    value: '={{ $json.output.topic }}',
                    type: 'string',
                },
                {
                    id: 'fde02511-6e90-460c-a7b3-a5bbe0fedacc',
                    name: 'summary',
                    value: '={{ $json.output.summary }}',
                    type: 'string',
                },
                {
                    id: 'f4a311c7-a42a-41e0-a2ea-77d5b4afb752',
                    name: 'external_urls',
                    value: "={{ ($('scrape_url').first().json.links ?? []).slice(0, 5).join(',') }}",
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '03470d65-dd7c-4717-af51-867bb505f274',
        name: 'upload_file',
        type: 'n8n-nodes-base.googleDrive',
        version: 3,
        position: [260, 4210],
        credentials: { googleDriveOAuth2Api: { id: '__CRED:googleDrive__', name: 'Google Drive' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    UploadFile = {
        resource: 'file',
        operation: 'createFromText',
        content: '={{ $json.markdown }}',
        name: '={{ $json.file_name }}',
        driveId: {
            __rl: true,
            mode: 'list',
            value: 'My Drive',
        },
        folderId: {
            __rl: true,
            mode: 'id',
            value: 'research-folder',
        },
        options: {},
    };

    @node({
        id: 'ce33935d-52d6-477b-a490-e956100bc80b',
        name: 'create_object_info',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [520, 4210],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateObjectInfo = {
        resource: 'row',
        operation: 'create',
        tableId: 'content_objects',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'id',
                    fieldValue: "={{ $('for_each_content').first().json.slug }}",
                },
                {
                    fieldId: 'date',
                    fieldValue: "={{ $('for_each_content').first().json.date }}",
                },
                {
                    fieldId: 'type',
                    fieldValue: "={{ 'article' }}",
                },
                {
                    fieldId: 'title',
                    fieldValue: "={{ $('for_each_content').first().json.title }}",
                },
                {
                    fieldId: 'url',
                    fieldValue: "={{ $('for_each_content').first().json.url }}",
                },
                {
                    fieldId: 'source',
                    fieldValue: "={{ $('for_each_content').first().json.source }}",
                },
                {
                    fieldId: 'topic',
                    fieldValue: "={{ $('format_markdown').first().json.topic }}",
                },
                {
                    fieldId: 'summary',
                    fieldValue: "={{ $('format_markdown').first().json.summary }}",
                },
                {
                    fieldId: 'external_urls',
                    fieldValue: "={{ $('format_markdown').first().json.external_urls }}",
                },
                {
                    fieldId: 'drive_file_id',
                    fieldValue: '={{ $json.id }}',
                },
                {
                    fieldId: 'file_name',
                    fieldValue: "={{ $('format_markdown').first().json.file_name }}",
                },
            ],
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Schedule1.out(0).to(this.GetFeed1.in(0));
        this.GetFeed1.out(0).to(this.SplitResults1.in(0));
        this.SplitResults1.out(0).to(this.ReadFeed1.in(0));
        this.ReadFeed1.out(0).to(this.FilterRecent1.in(0));
        this.FilterRecent1.out(0).to(this.DataManipulation1.in(0));
        this.DataManipulation1.out(0).to(this.SetItem.in(0));
        this.Schedule2.out(0).to(this.GetFeed2.in(0));
        this.GetFeed2.out(0).to(this.SplitResults2.in(0));
        this.SplitResults2.out(0).to(this.ReadFeed2.in(0));
        this.ReadFeed2.out(0).to(this.FilterRecent2.in(0));
        this.FilterRecent2.out(0).to(this.DataManipulation2.in(0));
        this.DataManipulation2.out(0).to(this.SetItem.in(0));
        this.Schedule3.out(0).to(this.GetFeed3.in(0));
        this.GetFeed3.out(0).to(this.SplitResults3.in(0));
        this.SplitResults3.out(0).to(this.ReadFeed3.in(0));
        this.ReadFeed3.out(0).to(this.FilterRecent3.in(0));
        this.FilterRecent3.out(0).to(this.DataManipulation3.in(0));
        this.DataManipulation3.out(0).to(this.SetItem.in(0));
        this.Schedule4.out(0).to(this.GetBlog1.in(0));
        this.GetBlog1.out(0).to(this.SplitResults4.in(0));
        this.SplitResults4.out(0).to(this.DataManipulation4.in(0));
        this.DataManipulation4.out(0).to(this.SetItem.in(0));
        this.Schedule5.out(0).to(this.GetBlog2.in(0));
        this.GetBlog2.out(0).to(this.SplitResults5.in(0));
        this.SplitResults5.out(0).to(this.DataManipulation5.in(0));
        this.DataManipulation5.out(0).to(this.SetItem.in(0));
        this.Schedule6.out(0).to(this.GetBlog3.in(0));
        this.GetBlog3.out(0).to(this.SplitResults6.in(0));
        this.SplitResults6.out(0).to(this.DataManipulation6.in(0));
        this.DataManipulation6.out(0).to(this.SetItem.in(0));
        this.Schedule7.out(0).to(this.GetBlog4.in(0));
        this.GetBlog4.out(0).to(this.SplitResults7.in(0));
        this.SplitResults7.out(0).to(this.DataManipulation7.in(0));
        this.DataManipulation7.out(0).to(this.SetItem.in(0));
        this.Schedule8.out(0).to(this.GetBlog5.in(0));
        this.GetBlog5.out(0).to(this.SplitResults8.in(0));
        this.SplitResults8.out(0).to(this.DataManipulation8.in(0));
        this.DataManipulation8.out(0).to(this.SetItem.in(0));
        this.Schedule9.out(0).to(this.GetBlog6.in(0));
        this.GetBlog6.out(0).to(this.SplitResults9.in(0));
        this.SplitResults9.out(0).to(this.DataManipulation9.in(0));
        this.DataManipulation9.out(0).to(this.SetItem.in(0));
        this.Schedule10.out(0).to(this.GetBlog7.in(0));
        this.GetBlog7.out(0).to(this.SplitResults10.in(0));
        this.SplitResults10.out(0).to(this.DataManipulation10.in(0));
        this.DataManipulation10.out(0).to(this.SetItem.in(0));
        this.SetItem.out(0).to(this.ForEachContent.in(0));
        this.ForEachContent.out(1).to(this.GetFiles.in(0));
        this.GetFiles.out(0).to(this.SkipExisting.in(0));
        this.SkipExisting.out(0).to(this.SetUrl.in(0));
        this.SkipExisting.out(1).to(this.ForEachContent.in(0));
        this.SetUrl.out(0).to(this.ScrapeUrl.in(0));
        this.ScrapeUrl.out(0).to(this.FilterScrapeErrors.in(0));
        this.FilterScrapeErrors.out(0).to(this.ValidateContent.in(0));
        this.FilterScrapeErrors.out(1).to(this.ForEachContent.in(0));
        this.ValidateContent.out(0).to(this.FilterRelevant.in(0));
        this.FilterRelevant.out(0).to(this.FormatMarkdown.in(0));
        this.FilterRelevant.out(1).to(this.ForEachContent.in(0));
        this.FormatMarkdown.out(0).to(this.UploadFile.in(0));
        this.UploadFile.out(0).to(this.CreateObjectInfo.in(0));
        this.CreateObjectInfo.out(0).to(this.ForEachContent.in(0));

        this.ValidateContent.uses({
            ai_languageModel: this.GoogleGeminiChatModel.output,
            ai_outputParser: this.ContentParser.output,
        });
        this.ContentParser.uses({
            ai_languageModel: this.GroqChatModel.output,
            ai_outputParser: this.StructuredOutputParser.output,
        });
    }
}
