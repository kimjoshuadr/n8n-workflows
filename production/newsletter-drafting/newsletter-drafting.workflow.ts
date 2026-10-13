import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Newsletter · AI drafting engine
// Nodes   : 76  |  Connections: 60
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// SectionRetrieveMarkdownContent     stickyNote
// SectionPickTopStories              stickyNote
// SectionSubjectLine                 stickyNote
// SectionWriteEachStory              stickyNote
// SectionWriteIntroSection           stickyNote
// SectionFormatFullNewsletter        stickyNote
// SubmitForm                         formTrigger
// GetFiles                           googleDrive                [creds] [alwaysOutput] [retry]
// FilterOnlyMarkdown                 filter
// GetMarkdownObjectInfo              supabase                   [creds] [alwaysOutput] [executeOnce] [retry]
// ExcludeNewsletters                 filter
// DownloadMarkdownObject             googleDrive                [creds] [retry]
// GetMarkdownFileContent             extractFromFile
// PrepareMarkdownContent             set
// AggregateMarkdownContent           aggregate                  [alwaysOutput]
// CombineMarkdownContent             set
// StoriesPrompt                      set
// PickTopStories                     chainLlm                   [AI]
// EditTopStories                     chainLlm                   [AI]
// SetCurrentStories                  set
// ShareSelectedStories               telegram                   [creds] [retry]
// SplitIntoChunks                    code
// ShareStoriesReasoning              telegram                   [creds] [retry]
// ShareStoriesApprovalFeedback       telegram                   [creds] [executeOnce]
// ExtractStoriesApprovalFeedback     informationExtractor       [AI]
// CheckStoriesFeedback               if
// SubjectExamples                    set
// SetSubjectLinePrompt               set
// WriteSubjectLine                   chainLlm                   [AI]
// EditSubjectLine                    chainLlm                   [AI]
// SetCurrentSubjectLine              set
// ShareSubjectLine                   telegram                   [creds] [retry]
// ShareSubjectLineReasoning          telegram                   [creds] [retry]
// ShareSubjectLineApprovalFeedback   telegram                   [creds]
// ExtractSubjectLineApprovalFeedback informationExtractor       [AI]
// CheckSubjectLineFeedback           if
// SetSelectedStories                 set
// SplitStories                       splitOut
// IterateStories                     splitInBatches
// SetCurrentSegment                  set
// SplitContentIds                    splitOut
// GetSegmentContentInfo              supabase                   [creds] [alwaysOutput] [retry]
// GetSegmentContent                  googleDrive                [creds] [alwaysOutput] [retry]
// DownloadSegmentContent             googleDrive                [onError→regular] [creds] [retry]
// GetSegmentContentText              extractFromFile
// PrepareSegmentContentItem          set
// AggregateSegmentTextContent        aggregate                  [alwaysOutput]
// CheckExternalUrls                  if
// SetSegmentExternalSourceLinks      set
// SplitSegmentExternalSourceUrls     splitOut
// ScrapeSegmentExternalSourceUrl     executeWorkflow            [onError→regular]
// FilterSegmentExternalSourceErrors  filter                     [alwaysOutput]
// AggregateSegmentExternalSourceContent aggregate                  [alwaysOutput]
// WriteSegmentContent                chainLlm                   [AI]
// StorySegmentAutoParser             outputParserAutofixing     [AI] [ai_outputParser]
// StorySegmentOutputParser           outputParserStructured     [ai_outputParser]
// ExtractImageUrls                   chainLlm                   [AI]
// ImageUrlsAutoParser                outputParserAutofixing     [AI] [ai_outputParser]
// ExtractImageUrlsParser             outputParserStructured     [ai_outputParser]
// ShareSegmentMsg                    telegram                   [creds] [retry]
// SetStorySegment                    set
// WriteIntro                         chainLlm                   [AI] [executeOnce]
// IntroAutoParser                    outputParserAutofixing     [AI] [ai_outputParser]
// IntroParser                        outputParserStructured     [ai_outputParser]
// WriteOtherTopStories               chainLlm                   [AI]
// OtherTopStoriesAutoParser          outputParserAutofixing     [AI] [ai_outputParser]
// OtherTopStoriesParser              outputParserStructured     [ai_outputParser]
// SetFullNewsletter                  set
// CreateNewsletterFile               convertToFile
// UploadNewsletterFile               telegram                   [creds] [retry]
// ShareNewsletterMsg                 telegram                   [creds] [retry]
// GoogleGeminiChatModel              lmChatGoogleGemini         [creds] [ai_languageModel] [ai_languageModel] [ai_languageModel] [ai_languageModel] [ai_languageModel] [ai_languageModel] [ai_languageModel] [ai_languageModel] [ai_languageModel] [ai_languageModel]
// StoriesParser                      outputParserStructured     [ai_outputParser] [ai_outputParser]
// SubjectLineParser                  outputParserStructured     [ai_outputParser] [ai_outputParser]
// GroqChatModel                      lmChatGroq                 [creds] [ai_languageModel] [ai_languageModel] [ai_languageModel] [ai_languageModel]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// SubmitForm
//    → GetFiles
//      → FilterOnlyMarkdown
//        → GetMarkdownObjectInfo
//          → ExcludeNewsletters
//            → DownloadMarkdownObject
//              → GetMarkdownFileContent
//                → PrepareMarkdownContent
//                  → AggregateMarkdownContent
//                    → CombineMarkdownContent
//                      → StoriesPrompt
//                        → PickTopStories
//                          → SetCurrentStories
//                            → ShareSelectedStories
//                              → SplitIntoChunks
//                                → ShareStoriesReasoning
//                                  → ShareStoriesApprovalFeedback
//                                    → ExtractStoriesApprovalFeedback
//                                      → CheckStoriesFeedback
//                                        → SubjectExamples
//                                          → SetSubjectLinePrompt
//                                            → WriteSubjectLine
//                                              → SetCurrentSubjectLine
//                                                → ShareSubjectLine
//                                                  → ShareSubjectLineReasoning
//                                                    → ShareSubjectLineApprovalFeedback
//                                                      → ExtractSubjectLineApprovalFeedback
//                                                        → CheckSubjectLineFeedback
//                                                          → SetSelectedStories
//                                                            → SplitStories
//                                                              → IterateStories
//                                                                → WriteIntro
//                                                                  → WriteOtherTopStories
//                                                                    → SetFullNewsletter
//                                                                      → CreateNewsletterFile
//                                                                        → UploadNewsletterFile
//                                                                          → ShareNewsletterMsg
//                                                               .out(1) → SetCurrentSegment
//                                                                  → SplitContentIds
//                                                                    → GetSegmentContentInfo
//                                                                      → GetSegmentContent
//                                                                        → DownloadSegmentContent
//                                                                          → GetSegmentContentText
//                                                                            → PrepareSegmentContentItem
//                                                                              → AggregateSegmentTextContent
//                                                                                → CheckExternalUrls
//                                                                                  → SetSegmentExternalSourceLinks
//                                                                                    → SplitSegmentExternalSourceUrls
//                                                                                      → ScrapeSegmentExternalSourceUrl
//                                                                                        → FilterSegmentExternalSourceErrors
//                                                                                          → AggregateSegmentExternalSourceContent
//                                                                                            → WriteSegmentContent
//                                                                                              → ExtractImageUrls
//                                                                                                → ShareSegmentMsg
//                                                                                                  → SetStorySegment
//                                                                                                    → IterateStories (↩ loop)
//                                                                                 .out(1) → WriteSegmentContent (↩ loop)
//                                                         .out(1) → EditSubjectLine
//                                                            → SetCurrentSubjectLine (↩ loop)
//                                       .out(1) → EditTopStories
//                                          → SetCurrentStories (↩ loop)
//
// AI CONNECTIONS
// PickTopStories.uses({ ai_languageModel: GoogleGeminiChatModel, ai_outputParser: StoriesParser })
// EditTopStories.uses({ ai_languageModel: GoogleGeminiChatModel, ai_outputParser: StoriesParser })
// ExtractStoriesApprovalFeedback.uses({ ai_languageModel: GoogleGeminiChatModel })
// WriteSubjectLine.uses({ ai_languageModel: GoogleGeminiChatModel, ai_outputParser: SubjectLineParser })
// EditSubjectLine.uses({ ai_languageModel: GoogleGeminiChatModel, ai_outputParser: SubjectLineParser })
// ExtractSubjectLineApprovalFeedback.uses({ ai_languageModel: GoogleGeminiChatModel })
// WriteSegmentContent.uses({ ai_outputParser: StorySegmentAutoParser, ai_languageModel: GoogleGeminiChatModel })
// StorySegmentAutoParser.uses({ ai_outputParser: StorySegmentOutputParser, ai_languageModel: GroqChatModel })
// ExtractImageUrls.uses({ ai_outputParser: ImageUrlsAutoParser, ai_languageModel: GoogleGeminiChatModel })
// ImageUrlsAutoParser.uses({ ai_outputParser: ExtractImageUrlsParser, ai_languageModel: GroqChatModel })
// WriteIntro.uses({ ai_outputParser: IntroAutoParser, ai_languageModel: GoogleGeminiChatModel })
// IntroAutoParser.uses({ ai_outputParser: IntroParser, ai_languageModel: GroqChatModel })
// WriteOtherTopStories.uses({ ai_outputParser: OtherTopStoriesAutoParser, ai_languageModel: GoogleGeminiChatModel })
// OtherTopStoriesAutoParser.uses({ ai_outputParser: OtherTopStoriesParser, ai_languageModel: GroqChatModel })
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Newsletter · AI drafting engine',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class NewsletterAiDraftingEngineWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '4ecb61bc-861d-4152-a8d2-fb61fee871f2',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -220],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Newsletter · AI drafting engine
For a chosen date, gathers that day's stored research, proposes the top stories and a subject line, and takes the editor's written feedback on each over Telegram until they approve. It then writes each story from its research and outside sources, adds an intro and a round-up, and sends the editor a draft file with a summary.

**Platforms:** Google Drive, Supabase, Telegram, Gemini, Groq
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`production/newsletter-drafting\``,
    };

    @node({
        id: '2315703b-c30e-445c-a5bb-8fd4ebb27a90',
        name: 'Section: Retrieve Markdown content',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 0],
    })
    SectionRetrieveMarkdownContent = {
        width: 2720,
        height: 330,
        color: 4,
        content: `## 1. Retrieve Markdown content
The research stored for the chosen date, read from Google Drive and joined into one text.`,
    };

    @node({
        id: '7f76a956-bd58-4173-acec-63ac62373114',
        name: 'Section: Pick top stories',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 410],
    })
    SectionPickTopStories = {
        width: 3120,
        height: 590,
        color: 5,
        content: `## 2. Pick top stories
A proposal, the reasoning behind it, and the editor's reply. A reply that asks for changes goes round again.`,
    };

    @node({
        id: '834cbd13-0c89-44f8-a74d-53634d63ed3a',
        name: 'Section: Subject line',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 1080],
    })
    SectionSubjectLine = {
        width: 3120,
        height: 590,
        color: 6,
        content: `## 3. Subject line
The same loop for the subject line: propose, explain, wait for the editor.`,
    };

    @node({
        id: 'bd0d1cba-808c-40d1-aef4-d819585239fe',
        name: 'Section: Write each story',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 1750],
    })
    SectionWriteEachStory = {
        width: 5980,
        height: 770,
        color: 3,
        content: `## 4. Write each story
One story per pass: its research, any outside sources, the story, its images.`,
    };

    @node({
        id: '7a48328f-6d18-4f5b-aa7d-ff3c9a0f14d0',
        name: 'Section: Write intro section',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 2600],
    })
    SectionWriteIntroSection = {
        width: 580,
        height: 770,
        color: 7,
        content: '## 5. Write intro section',
    };

    @node({
        id: '7e6eec7f-489a-4666-a5e0-8712bea86ee9',
        name: 'Section: Format full newsletter',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 3450],
    })
    SectionFormatFullNewsletter = {
        width: 1620,
        height: 770,
        color: 2,
        content: `## 6. Format full newsletter
The round-up, the assembled draft, and delivery as a file with a summary.`,
    };

    @node({
        id: '0c4e2fc8-7ea7-4a09-acc2-25ef20a76a40',
        webhookId: '4ede89ad-5a9c-4e3b-a9de-cf9cabd02286',
        name: 'submit_form',
        type: 'n8n-nodes-base.formTrigger',
        version: 2.2,
        position: [0, 200],
    })
    SubmitForm = {
        formTitle: 'Draft a newsletter',
        formDescription: "Drafts the issue for one date from that day's research.",
        formFields: {
            values: [
                {
                    fieldLabel: 'Newsletter date',
                    fieldType: 'date',
                    requiredField: true,
                },
                {
                    fieldLabel: 'Focus for this issue',
                    fieldType: 'textarea',
                    requiredField: false,
                },
            ],
        },
        options: {},
    };

    @node({
        id: '8fe58273-2f6e-4ba8-a025-8701337c54cc',
        name: 'get_files',
        type: 'n8n-nodes-base.googleDrive',
        version: 3,
        position: [260, 200],
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
        queryString: "={{ $json['Newsletter date'] }}",
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
        id: '1da71a97-ee4d-494d-a7e8-75b795d6f27b',
        name: 'filter_only_markdown',
        type: 'n8n-nodes-base.filter',
        version: 2.2,
        position: [520, 200],
    })
    FilterOnlyMarkdown = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '5a59327c-e4d3-486d-ae55-461391cc7284',
                    leftValue: "={{ String($json.name ?? '').endsWith('.md') }}",
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
        id: '6063c60f-53df-4106-a3b8-d759475ded0d',
        name: 'get_markdown_object_info',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [780, 200],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        executeOnce: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetMarkdownObjectInfo = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'content_objects',
        returnAll: true,
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'date',
                    condition: 'eq',
                    keyValue: "={{ $('submit_form').first().json['Newsletter date'] }}",
                },
            ],
        },
    };

    @node({
        id: '18f5964e-a638-461f-a5e2-ff0da36f5bb4',
        name: 'exclude_newsletters',
        type: 'n8n-nodes-base.filter',
        version: 2.2,
        position: [1040, 200],
    })
    ExcludeNewsletters = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '9c132333-ac69-41c0-a18a-4083fe46d1d9',
                    leftValue:
                        "={{ $json.type !== 'newsletter' && !!$json.drive_file_id && $('filter_only_markdown').all().some((f) => f.json.id === $json.drive_file_id) }}",
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
        id: '25dfe4cb-2ce4-4175-a3a4-b2788edc62f0',
        name: 'download_markdown_object',
        type: 'n8n-nodes-base.googleDrive',
        version: 3,
        position: [1300, 200],
        credentials: { googleDriveOAuth2Api: { id: '__CRED:googleDrive__', name: 'Google Drive' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    DownloadMarkdownObject = {
        resource: 'file',
        operation: 'download',
        fileId: {
            __rl: true,
            mode: 'id',
            value: '={{ $json.drive_file_id }}',
        },
        options: {},
    };

    @node({
        id: '749692b0-6e9e-461d-a8a0-ec5b24cb50b6',
        name: 'get_markdown_file_content',
        type: 'n8n-nodes-base.extractFromFile',
        version: 1,
        position: [1560, 200],
    })
    GetMarkdownFileContent = {
        operation: 'text',
        binaryPropertyName: 'data',
        destinationKey: 'text',
        options: {},
    };

    @node({
        id: '9cf68038-b9fd-4fbe-ad51-eb893a1bb125',
        name: 'prepare_markdown_content',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [1820, 200],
    })
    PrepareMarkdownContent = {
        assignments: {
            assignments: [
                {
                    id: '5cd1fc84-e3bf-40bf-abf5-4a9e6e79f43e',
                    name: 'content_id',
                    value: "={{ $('exclude_newsletters').item.json.id }}",
                    type: 'string',
                },
                {
                    id: '4b542241-cd8f-403d-a103-9d38104b450c',
                    name: 'title',
                    value: "={{ $('exclude_newsletters').item.json.title }}",
                    type: 'string',
                },
                {
                    id: 'a4432d1b-095d-45e6-a437-df91bfe943ff',
                    name: 'url',
                    value: "={{ $('exclude_newsletters').item.json.url }}",
                    type: 'string',
                },
                {
                    id: 'b0819aa4-da90-4b4b-a6d1-9192638a8aef',
                    name: 'text',
                    value: '={{ $json.text }}',
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '58ddf118-659b-475d-ae64-181a3ca43b43',
        name: 'aggregate_markdown_content',
        type: 'n8n-nodes-base.aggregate',
        version: 1,
        position: [2080, 200],
        alwaysOutputData: true,
    })
    AggregateMarkdownContent = {
        aggregate: 'aggregateAllItemData',
        destinationFieldName: 'items',
        include: 'allFields',
        options: {},
    };

    @node({
        id: '1b02122b-52d9-4157-a981-cdf4de3fd9f8',
        name: 'combine_markdown_content',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [2340, 200],
    })
    CombineMarkdownContent = {
        assignments: {
            assignments: [
                {
                    id: 'c363f8a2-3651-4d10-a870-f18a9ebc7037',
                    name: 'date',
                    value: "={{ $('submit_form').first().json['Newsletter date'] }}",
                    type: 'string',
                },
                {
                    id: '14d5d3f3-19af-4456-a5c9-594635545fa6',
                    name: 'focus',
                    value: "={{ String($('submit_form').first().json['Focus for this issue'] ?? '').trim() }}",
                    type: 'string',
                },
                {
                    id: 'd77f0fc1-bb3b-4f12-a539-b9e45b70c844',
                    name: 'count',
                    value: '={{ $json.items.length }}',
                    type: 'number',
                },
                {
                    id: 'e057c53f-31a8-4994-a974-ef89607b6437',
                    name: 'sparse',
                    value: '={{ $json.items.length < 3 }}',
                    type: 'boolean',
                },
                {
                    id: 'b868aa77-e480-4954-a1ed-76a79882d257',
                    name: 'research',
                    value: "={{ $json.items.map((d) => '[' + d.content_id + '] ' + d.title + ' (' + d.url + ')\\n' + String(d.text).slice(0, 6000)).join('\\n\\n---\\n\\n') }}",
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '3bfee53d-d0bb-4ff4-a314-9e265bbc3482',
        name: 'stories_prompt',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [0, 740],
    })
    StoriesPrompt = {
        assignments: {
            assignments: [
                {
                    id: 'ea52b8e7-1202-4945-a5f4-ac6fdbfff723',
                    name: 'prompt',
                    value: "={{ 'Date: ' + $json.date + '\\nEditor focus: ' + ($json.focus || 'none given') + '\\n' + ($json.sparse ? 'Only ' + $json.count + ' research documents exist for this date. Choose fewer stories instead of padding: one strong story is enough.' : 'Choose the three or four strongest stories.') + '\\n\\nResearch:\\n' + $json.research }}",
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '72c51cae-f1b3-40be-a50e-653175c700cd',
        name: 'pick_top_stories',
        type: '@n8n/n8n-nodes-langchain.chainLlm',
        version: 1.7,
        position: [360, 610],
    })
    PickTopStories = {
        promptType: 'define',
        text: '={{ $json.prompt }}',
        hasOutputParser: true,
        messages: {
            messageValues: [
                {
                    type: 'SystemMessagePromptTemplate',
                    message:
                        "[task:pick-stories] You are the editor of a daily industry newsletter. Use only what is in the research you are given: never add a fact, a number or a quote that is not there. Choose the top stories for today's issue. For each, give a headline, the ids of the research documents it draws on (the ids in square brackets), any outside links in those documents worth reading in full, and why it leads. Then give your overall reasoning for the selection.",
                },
            ],
        },
        batching: {},
    };

    @node({
        id: '03f5505d-6d16-4ab9-a528-3d9ef009a4bd',
        name: 'edit_top_stories',
        type: '@n8n/n8n-nodes-langchain.chainLlm',
        version: 1.7,
        position: [2640, 610],
    })
    EditTopStories = {
        promptType: 'define',
        text: "={{ 'Current selection:\\n' + JSON.stringify($('set_current_stories').first().json.stories) + '\\n\\nEditor feedback: ' + $json.output.feedback + '\\n\\nResearch:\\n' + $('combine_markdown_content').first().json.research }}",
        hasOutputParser: true,
        messages: {
            messageValues: [
                {
                    type: 'SystemMessagePromptTemplate',
                    message:
                        '[task:edit-stories] You are the editor of a daily industry newsletter. Use only what is in the research you are given: never add a fact, a number or a quote that is not there. The editor has asked for changes to the story selection. Apply exactly what they asked and keep everything else. Answer in the same shape, with your reasoning for the revised selection.',
                },
            ],
        },
        batching: {},
    };

    @node({
        id: '118150eb-f829-48bf-a16f-c632fcd1ae67',
        name: 'set_current_stories',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [720, 740],
    })
    SetCurrentStories = {
        assignments: {
            assignments: [
                {
                    id: '1ec48c44-3839-4c66-aaf6-5baa7e84ccc5',
                    name: 'stories',
                    value: '={{ $json.output.stories }}',
                    type: 'array',
                },
                {
                    id: 'a52eb901-d6ce-4646-ae4d-1e0415680123',
                    name: 'reasoning',
                    value: "={{ $json.output.reasoning ?? '' }}",
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '2f50ab3b-5925-479e-a64f-e240ff25a478',
        name: 'share_selected_stories',
        type: 'n8n-nodes-base.telegram',
        version: 1.2,
        position: [980, 740],
        credentials: { telegramApi: { id: '__CRED:telegram__', name: 'Telegram' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ShareSelectedStories = {
        resource: 'message',
        operation: 'sendMessage',
        chatId: "={{ '-1000000000001' }}",
        text: "={{ 'Top stories for ' + $('submit_form').first().json['Newsletter date'] + ':\\n' + $json.stories.map((s, i) => (i + 1) + '. ' + s.title).join('\\n') }}",
        additionalFields: {
            appendAttribution: false,
        },
    };

    @node({
        id: '47ce1cd0-ea49-47a7-ad9e-9bb491cdb019',
        name: 'split_into_chunks',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1240, 740],
    })
    SplitIntoChunks = {
        jsCode: `// Telegram refuses a message over 4096 characters, so long reasoning is sent in parts.
const text = String($("set_current_stories").first().json.reasoning || "No reasoning was given.");
const chunks = [];
for (let i = 0; i < text.length; i += 3500) chunks.push(text.slice(i, i + 3500));
return chunks.map((chunk) => ({ json: { chunk } }));`,
    };

    @node({
        id: '533d4582-56fa-4db3-afda-7d25ea017fad',
        name: 'share_stories_reasoning',
        type: 'n8n-nodes-base.telegram',
        version: 1.2,
        position: [1500, 740],
        credentials: { telegramApi: { id: '__CRED:telegram__', name: 'Telegram' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ShareStoriesReasoning = {
        resource: 'message',
        operation: 'sendMessage',
        chatId: "={{ '-1000000000001' }}",
        text: '={{ $json.chunk }}',
        additionalFields: {
            appendAttribution: false,
        },
    };

    @node({
        id: 'c70b82e8-42a7-4fd0-a87e-70d4c530bec8',
        webhookId: 'c61b3560-8dcd-4eb3-a174-a7a6c1248669',
        name: 'share_stories_approval_feedback',
        type: 'n8n-nodes-base.telegram',
        version: 1.2,
        position: [1760, 740],
        credentials: { telegramApi: { id: '__CRED:telegram__', name: 'Telegram' } },
        executeOnce: true,
    })
    ShareStoriesApprovalFeedback = {
        resource: 'message',
        operation: 'sendAndWait',
        chatId: "={{ '-1000000000001' }}",
        message: "={{ 'Reply Approve to go on with these stories, or say what to change.' }}",
        responseType: 'freeText',
        options: {
            appendAttribution: false,
        },
    };

    @node({
        id: '8bd5b9d9-bad6-479f-a4bd-10de8fa2ce34',
        name: 'extract_stories_approval_feedback',
        type: '@n8n/n8n-nodes-langchain.informationExtractor',
        version: 1.2,
        position: [2020, 610],
    })
    ExtractStoriesApprovalFeedback = {
        text: '={{ $json.data.text }}',
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "approved": true,
  "feedback": ""
}`,
        options: {
            systemPromptTemplate:
                "[task:read-feedback] Read the editor's reply to a proposal. approved is true only when they accept it as it is, with nothing they want changed. Otherwise approved is false and feedback is what they want changed, in their words.",
        },
    };

    @node({
        id: '77db8913-d33d-4e03-af0d-639bea51e94b',
        name: 'check_stories_feedback',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [2280, 740],
    })
    CheckStoriesFeedback = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '9dad8771-8151-4ec5-a205-f561882eac16',
                    leftValue: '={{ $json.output?.approved === true }}',
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
        id: 'f4f5d563-d566-4e7e-a624-e658d945d9c6',
        name: 'subject_examples',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [0, 1410],
    })
    SubjectExamples = {
        assignments: {
            assignments: [
                {
                    id: '23440fa6-8a53-44e8-a12a-653c18a6d1ca',
                    name: 'examples',
                    value: "={{ '- Rates hold, markets shrug\\n- The chip that changes the maths\\n- Three deals you missed this week' }}",
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '8946326b-891a-4dfe-ab77-0270143218fc',
        name: 'set_subject_line_prompt',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [260, 1410],
    })
    SetSubjectLinePrompt = {
        assignments: {
            assignments: [
                {
                    id: 'd659093c-734c-4dcc-afd8-4a45cd36c5e1',
                    name: 'prompt',
                    value: "={{ 'Stories in this issue:\\n' + $('set_current_stories').first().json.stories.map((s) => '- ' + s.title + ': ' + s.why).join('\\n') + '\\n\\nSubject lines in the house style:\\n' + $json.examples }}",
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: 'd8d5cbe3-bf8e-4dbe-af25-28169b701dd5',
        name: 'write_subject_line',
        type: '@n8n/n8n-nodes-langchain.chainLlm',
        version: 1.7,
        position: [620, 1280],
    })
    WriteSubjectLine = {
        promptType: 'define',
        text: '={{ $json.prompt }}',
        hasOutputParser: true,
        messages: {
            messageValues: [
                {
                    type: 'SystemMessagePromptTemplate',
                    message:
                        '[task:subject-line] You are the editor of a daily industry newsletter. Use only what is in the research you are given: never add a fact, a number or a quote that is not there. Write the subject line for this issue in the house style shown: under 50 characters, concrete, no clickbait and no emoji. Add a preheader of under 90 characters and one sentence of reasoning.',
                },
            ],
        },
        batching: {},
    };

    @node({
        id: 'b74a7ca4-a7df-4aa9-aeb8-6b2ccada07cc',
        name: 'edit_subject_line',
        type: '@n8n/n8n-nodes-langchain.chainLlm',
        version: 1.7,
        position: [2640, 1280],
    })
    EditSubjectLine = {
        promptType: 'define',
        text: "={{ 'Current subject line: ' + $('set_current_subject_line').first().json.subject_line + '\\nCurrent preheader: ' + $('set_current_subject_line').first().json.preheader + '\\n\\nEditor feedback: ' + $json.output.feedback }}",
        hasOutputParser: true,
        messages: {
            messageValues: [
                {
                    type: 'SystemMessagePromptTemplate',
                    message:
                        '[task:edit-subject] You are the editor of a daily industry newsletter. Use only what is in the research you are given: never add a fact, a number or a quote that is not there. The editor has asked for changes to the subject line. Apply exactly what they asked. Answer in the same shape.',
                },
            ],
        },
        batching: {},
    };

    @node({
        id: 'aed89160-a092-45a9-a5d4-1b9e63f23ed4',
        name: 'set_current_subject_line',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [980, 1410],
    })
    SetCurrentSubjectLine = {
        assignments: {
            assignments: [
                {
                    id: '3da39713-92a3-4d42-a963-690171587922',
                    name: 'subject_line',
                    value: '={{ $json.output.subject_line }}',
                    type: 'string',
                },
                {
                    id: '360ac628-a2e4-4947-a16d-806869929e62',
                    name: 'preheader',
                    value: "={{ $json.output.preheader ?? '' }}",
                    type: 'string',
                },
                {
                    id: 'b1bb5b4d-a4ab-47c5-ad3f-3c5b74863acd',
                    name: 'reasoning',
                    value: "={{ $json.output.reasoning ?? '' }}",
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '8ddc9185-fbe6-4085-acea-fa47002e8022',
        name: 'share_subject_line',
        type: 'n8n-nodes-base.telegram',
        version: 1.2,
        position: [1240, 1410],
        credentials: { telegramApi: { id: '__CRED:telegram__', name: 'Telegram' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ShareSubjectLine = {
        resource: 'message',
        operation: 'sendMessage',
        chatId: "={{ '-1000000000001' }}",
        text: "={{ 'Subject line: ' + $json.subject_line + '\\nPreheader: ' + $json.preheader }}",
        additionalFields: {
            appendAttribution: false,
        },
    };

    @node({
        id: 'b97e4d38-e983-4769-a299-9aae94dacfca',
        name: 'share_subject_line_reasoning',
        type: 'n8n-nodes-base.telegram',
        version: 1.2,
        position: [1500, 1410],
        credentials: { telegramApi: { id: '__CRED:telegram__', name: 'Telegram' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ShareSubjectLineReasoning = {
        resource: 'message',
        operation: 'sendMessage',
        chatId: "={{ '-1000000000001' }}",
        text: "={{ $('set_current_subject_line').first().json.reasoning || 'No reasoning was given.' }}",
        additionalFields: {
            appendAttribution: false,
        },
    };

    @node({
        id: '6d025a62-8276-444b-a95d-c8a4748fd590',
        webhookId: '1ff189c1-3b30-46f5-a306-5b97afcc69c7',
        name: 'share_subject_line_approval_feedback',
        type: 'n8n-nodes-base.telegram',
        version: 1.2,
        position: [1760, 1410],
        credentials: { telegramApi: { id: '__CRED:telegram__', name: 'Telegram' } },
    })
    ShareSubjectLineApprovalFeedback = {
        resource: 'message',
        operation: 'sendAndWait',
        chatId: "={{ '-1000000000001' }}",
        message: "={{ 'Reply Approve to use this subject line, or say what to change.' }}",
        responseType: 'freeText',
        options: {
            appendAttribution: false,
        },
    };

    @node({
        id: 'e68b2ddf-258a-4151-a659-2cf0a45a24fb',
        name: 'extract_subject_line_approval_feedback',
        type: '@n8n/n8n-nodes-langchain.informationExtractor',
        version: 1.2,
        position: [2020, 1280],
    })
    ExtractSubjectLineApprovalFeedback = {
        text: '={{ $json.data.text }}',
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "approved": true,
  "feedback": ""
}`,
        options: {
            systemPromptTemplate:
                "[task:read-feedback] Read the editor's reply to a proposal. approved is true only when they accept it as it is, with nothing they want changed. Otherwise approved is false and feedback is what they want changed, in their words.",
        },
    };

    @node({
        id: '8a0448bd-3e56-472f-aada-aa9a3d84e3a3',
        name: 'check_subject_line_feedback',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [2280, 1410],
    })
    CheckSubjectLineFeedback = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '70f1c885-306a-4af8-a042-95d62fb6b173',
                    leftValue: '={{ $json.output?.approved === true }}',
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
        id: 'd7fd9afe-8901-4ffb-a265-8f59783fd47e',
        name: 'set_selected_stories',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [0, 2170],
    })
    SetSelectedStories = {
        assignments: {
            assignments: [
                {
                    id: '883a1736-ae29-4f2e-a9c1-a99b119ceb9b',
                    name: 'stories',
                    value: "={{ $('set_current_stories').first().json.stories }}",
                    type: 'array',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '1f0685c8-2acc-44ea-ad8b-1a8a7c68c332',
        name: 'split_stories',
        type: 'n8n-nodes-base.splitOut',
        version: 1,
        position: [260, 2170],
    })
    SplitStories = {
        fieldToSplitOut: 'stories',
        options: {},
    };

    @node({
        id: 'f1d14418-bb20-4847-a94f-130a5d2757e0',
        name: 'iterate_stories',
        type: 'n8n-nodes-base.splitInBatches',
        version: 3,
        position: [520, 2170],
    })
    IterateStories = {
        batchSize: 1,
        options: {},
    };

    @node({
        id: 'ddf16df3-f14b-4a84-a240-c2fa7ffbb342',
        name: 'set_current_segment',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [780, 2170],
    })
    SetCurrentSegment = {
        assignments: {
            assignments: [
                {
                    id: '0d459a8a-9a54-4f2b-ac3e-11a815d49784',
                    name: 'title',
                    value: '={{ $json.title }}',
                    type: 'string',
                },
                {
                    id: '3195f148-5bdf-43aa-a2db-a19a133938fc',
                    name: 'why',
                    value: "={{ $json.why ?? '' }}",
                    type: 'string',
                },
                {
                    id: '6b2c69d2-94cf-4f72-ada4-e12356656dda',
                    name: 'content_ids',
                    value: '={{ $json.content_ids ?? [] }}',
                    type: 'array',
                },
                {
                    id: 'bedf83ef-ba6a-4f01-a22d-0548995bd4f7',
                    name: 'external_urls',
                    value: '={{ $json.external_urls ?? [] }}',
                    type: 'array',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: 'd7b2edfc-8e99-46d4-a513-c11a274c5525',
        name: 'split_content_ids',
        type: 'n8n-nodes-base.splitOut',
        version: 1,
        position: [1040, 2170],
    })
    SplitContentIds = {
        fieldToSplitOut: 'content_ids',
        options: {},
    };

    @node({
        id: 'd3542efa-61c5-444d-aeb0-c41caf13dcde',
        name: 'get_segment_content_info',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1300, 2170],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetSegmentContentInfo = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'content_objects',
        returnAll: false,
        limit: 1,
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'id',
                    condition: 'eq',
                    keyValue: '={{ $json.content_ids }}',
                },
            ],
        },
    };

    @node({
        id: '2836add8-72f5-4f6a-a549-4dd355eb1d26',
        name: 'get_segment_content',
        type: 'n8n-nodes-base.googleDrive',
        version: 3,
        position: [1560, 2170],
        credentials: { googleDriveOAuth2Api: { id: '__CRED:googleDrive__', name: 'Google Drive' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetSegmentContent = {
        resource: 'fileFolder',
        operation: 'search',
        searchMethod: 'name',
        queryString: "={{ $json.file_name ?? 'no-such-file' }}",
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
        id: '4527cb20-79b4-487a-ae08-807bdba39b36',
        name: 'download_segment_content',
        type: 'n8n-nodes-base.googleDrive',
        version: 3,
        position: [1820, 2170],
        credentials: { googleDriveOAuth2Api: { id: '__CRED:googleDrive__', name: 'Google Drive' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    DownloadSegmentContent = {
        resource: 'file',
        operation: 'download',
        fileId: {
            __rl: true,
            mode: 'id',
            value: "={{ $json.id ?? 'missing' }}",
        },
        options: {},
    };

    @node({
        id: 'e2455dc2-670a-4088-a77f-19f3611be642',
        name: 'get_segment_content_text',
        type: 'n8n-nodes-base.extractFromFile',
        version: 1,
        position: [2080, 2170],
    })
    GetSegmentContentText = {
        operation: 'text',
        binaryPropertyName: 'data',
        destinationKey: 'text',
        options: {},
    };

    @node({
        id: '3abaa13a-cc85-4a7a-a56c-4c3f89f50e47',
        name: 'prepare_segment_content_item',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [2340, 2170],
    })
    PrepareSegmentContentItem = {
        assignments: {
            assignments: [
                {
                    id: '1db5e9a9-0320-470f-a49f-8f491204b1df',
                    name: 'text',
                    value: "={{ String($json.text ?? '').slice(0, 8000) }}",
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '37fac113-ad80-43b7-affb-93af6799d282',
        name: 'aggregate_segment_text_content',
        type: 'n8n-nodes-base.aggregate',
        version: 1,
        position: [2600, 2170],
        alwaysOutputData: true,
    })
    AggregateSegmentTextContent = {
        aggregate: 'aggregateIndividualFields',
        fieldsToAggregate: {
            fieldToAggregate: [
                {
                    fieldToAggregate: 'text',
                    renameField: true,
                    outputFieldName: 'texts',
                },
            ],
        },
        options: {},
    };

    @node({
        id: '3c715256-70db-43d3-a0fc-b82143948b0e',
        name: 'check_external_urls',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [2860, 2170],
    })
    CheckExternalUrls = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'e1f42ccd-8c5d-4014-a4d0-5b0778c22a99',
                    leftValue: "={{ $('set_current_segment').first().json.external_urls.length > 0 }}",
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
        id: 'fbc741bf-bbc2-4f1f-aafe-740c209a330e',
        name: 'set_segment_external_source_links',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [3120, 2170],
    })
    SetSegmentExternalSourceLinks = {
        assignments: {
            assignments: [
                {
                    id: '99b2c48c-8dba-418a-ae6d-fc57c5d2ab82',
                    name: 'url',
                    value: "={{ $('set_current_segment').first().json.external_urls.slice(0, 3) }}",
                    type: 'array',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '6514e1a2-0b2f-4832-a21a-189c819ea4b0',
        name: 'split_segment_external_source_urls',
        type: 'n8n-nodes-base.splitOut',
        version: 1,
        position: [3380, 2170],
    })
    SplitSegmentExternalSourceUrls = {
        fieldToSplitOut: 'url',
        options: {},
    };

    @node({
        id: '4f3d97bb-1c61-47df-ad18-eb4bfaf2ff00',
        name: 'scrape_segment_external_source_url',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [3640, 2170],
        onError: 'continueRegularOutput',
    })
    ScrapeSegmentExternalSourceUrl = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:scrape-page__',
        },
        options: {},
    };

    @node({
        id: 'e9f1c319-2c4b-459c-a668-832235b3cd02',
        name: 'filter_segment_external_source_errors',
        type: 'n8n-nodes-base.filter',
        version: 2.2,
        position: [3900, 2170],
        alwaysOutputData: true,
    })
    FilterSegmentExternalSourceErrors = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '7b3c172e-bb8e-43b7-aea8-84552bd814ae',
                    leftValue: '={{ $json.ok === true }}',
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
        id: '4d8ec3de-cf92-472f-a025-ead5ff0b3956',
        name: 'aggregate_segment_external_source_content',
        type: 'n8n-nodes-base.aggregate',
        version: 1,
        position: [4160, 2170],
        alwaysOutputData: true,
    })
    AggregateSegmentExternalSourceContent = {
        aggregate: 'aggregateIndividualFields',
        fieldsToAggregate: {
            fieldToAggregate: [
                {
                    fieldToAggregate: 'text',
                    renameField: true,
                    outputFieldName: 'sources',
                },
            ],
        },
        options: {},
    };

    @node({
        id: '52c9b9b5-d74f-4841-acad-fd1b9c84fc28',
        name: 'write_segment_content',
        type: '@n8n/n8n-nodes-langchain.chainLlm',
        version: 1.7,
        position: [4520, 1950],
    })
    WriteSegmentContent = {
        promptType: 'define',
        text: "={{ 'Story: ' + $('set_current_segment').first().json.title + '\\nWhy it leads: ' + $('set_current_segment').first().json.why + '\\n\\nResearch:\\n' + $('aggregate_segment_text_content').first().json.texts.join('\\n\\n') + '\\n\\nOutside sources:\\n' + (($json.sources ?? []).filter((t) => t).map((t) => String(t).slice(0, 4000)).join('\\n\\n') || 'none') }}",
        hasOutputParser: true,
        messages: {
            messageValues: [
                {
                    type: 'SystemMessagePromptTemplate',
                    message:
                        '[task:write-segment] You are the editor of a daily industry newsletter. Use only what is in the research you are given: never add a fact, a number or a quote that is not there. Write one story for the issue: a headline and a body of 120 to 200 words in plain, direct prose. List the addresses of the sources you used.',
                },
            ],
        },
        batching: {},
    };

    @node({
        id: 'c5a17587-9a0a-4644-a3bc-a16a4f0755ed',
        name: 'story_segment_auto_parser',
        type: '@n8n/n8n-nodes-langchain.outputParserAutofixing',
        version: 1,
        position: [4420, 2170],
    })
    StorySegmentAutoParser = {
        options: {},
    };

    @node({
        id: 'af1d248a-6a3b-443c-ab7b-cad4b43875e7',
        name: 'story_segment_output_parser',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [4320, 2390],
    })
    StorySegmentOutputParser = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "headline": "The story's headline",
  "body": "The story.",
  "sources": [
    "https://a-source-used"
  ]
}`,
    };

    @node({
        id: 'd78f5226-1a06-4d53-afd8-7dfd3331d6ec',
        name: 'extract_image_urls',
        type: '@n8n/n8n-nodes-langchain.chainLlm',
        version: 1.7,
        position: [4980, 1950],
    })
    ExtractImageUrls = {
        promptType: 'define',
        text: "={{ 'Story: ' + $('set_current_segment').first().json.title + '\\n\\nResearch:\\n' + $('aggregate_segment_text_content').first().json.texts.join('\\n\\n') }}",
        hasOutputParser: true,
        messages: {
            messageValues: [
                {
                    type: 'SystemMessagePromptTemplate',
                    message:
                        '[task:image-urls] List the addresses of images that appear in this research and belong with the story: charts, product photos, screenshots. Only addresses that are in the text. An empty list is a fine answer.',
                },
            ],
        },
        batching: {},
    };

    @node({
        id: 'a096afd6-ad09-4b03-aa7a-d16d25f11959',
        name: 'image_urls_auto_parser',
        type: '@n8n/n8n-nodes-langchain.outputParserAutofixing',
        version: 1,
        position: [4880, 2170],
    })
    ImageUrlsAutoParser = {
        options: {},
    };

    @node({
        id: '1950b09d-eee9-433d-a2b5-8e68987e36e5',
        name: 'extract_image_urls_parser',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [4780, 2390],
    })
    ExtractImageUrlsParser = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "image_urls": [
    "https://an-image-in-the-research"
  ]
}`,
    };

    @node({
        id: '304e3971-7ee3-4ba9-a5db-20bf2430627f',
        name: 'share_segment_msg',
        type: 'n8n-nodes-base.telegram',
        version: 1.2,
        position: [5340, 2170],
        credentials: { telegramApi: { id: '__CRED:telegram__', name: 'Telegram' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ShareSegmentMsg = {
        resource: 'message',
        operation: 'sendMessage',
        chatId: "={{ '-1000000000001' }}",
        text: "={{ $('write_segment_content').first().json.output.headline + '\\n\\n' + $('write_segment_content').first().json.output.body }}",
        additionalFields: {
            appendAttribution: false,
        },
    };

    @node({
        id: '7a9f59b2-24b3-4842-a73b-171fef52e4a7',
        name: 'set_story_segment',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [5600, 2170],
    })
    SetStorySegment = {
        assignments: {
            assignments: [
                {
                    id: '0c5ce8bb-86e9-4846-aac5-f62221c0f7a8',
                    name: 'headline',
                    value: "={{ $('write_segment_content').first().json.output.headline }}",
                    type: 'string',
                },
                {
                    id: 'd8bf7ed8-d630-4a5c-a799-28f24fcb19c3',
                    name: 'body',
                    value: "={{ $('write_segment_content').first().json.output.body }}",
                    type: 'string',
                },
                {
                    id: '1d779b57-4565-4a7c-a768-ab3b619ae38b',
                    name: 'sources',
                    value: "={{ $('write_segment_content').first().json.output.sources ?? [] }}",
                    type: 'array',
                },
                {
                    id: '211e282b-6cd8-4236-a878-ee5536afea24',
                    name: 'image_urls',
                    value: "={{ $('extract_image_urls').first().json.output.image_urls ?? [] }}",
                    type: 'array',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: 'b99d58a9-f43b-4ad5-a6ff-375544f66c22',
        name: 'write_intro',
        type: '@n8n/n8n-nodes-langchain.chainLlm',
        version: 1.7,
        position: [100, 2800],
        executeOnce: true,
    })
    WriteIntro = {
        promptType: 'define',
        text: "={{ 'Subject line: ' + $('set_current_subject_line').first().json.subject_line + '\\n\\nStories:\\n' + $input.all().map((i) => '## ' + i.json.headline + '\\n' + i.json.body).join('\\n\\n') }}",
        hasOutputParser: true,
        messages: {
            messageValues: [
                {
                    type: 'SystemMessagePromptTemplate',
                    message:
                        '[task:write-intro] You are the editor of a daily industry newsletter. Use only what is in the research you are given: never add a fact, a number or a quote that is not there. Write the opening of the issue: two or three sentences that greet the reader and say what is in it, in the order the stories appear.',
                },
            ],
        },
        batching: {},
    };

    @node({
        id: '04253ed0-5247-4545-a57f-0ce1e97815e9',
        name: 'intro_auto_parser',
        type: '@n8n/n8n-nodes-langchain.outputParserAutofixing',
        version: 1,
        position: [0, 3020],
    })
    IntroAutoParser = {
        options: {},
    };

    @node({
        id: '98488457-a783-4e3c-a5f8-f314a34ad480',
        name: 'intro_parser',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [-100, 3240],
    })
    IntroParser = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "intro": "The opening of the issue."
}`,
    };

    @node({
        id: '77817319-6e86-4437-aa77-7bc3b6879182',
        name: 'write_other_top_stories',
        type: '@n8n/n8n-nodes-langchain.chainLlm',
        version: 1.7,
        position: [100, 3650],
    })
    WriteOtherTopStories = {
        promptType: 'define',
        text: "={{ 'Already covered: ' + $('set_current_stories').first().json.stories.map((s) => s.title).join('; ') + '\\n\\nResearch not yet used:\\n' + ($('aggregate_markdown_content').first().json.items.filter((d) => !$('set_current_stories').first().json.stories.some((s) => (s.content_ids ?? []).includes(d.content_id))).map((d) => '- ' + d.title + ' (' + d.url + '): ' + String(d.text).slice(0, 600)).join('\\n') || 'none') }}",
        hasOutputParser: true,
        messages: {
            messageValues: [
                {
                    type: 'SystemMessagePromptTemplate',
                    message:
                        '[task:other-stories] You are the editor of a daily industry newsletter. Use only what is in the research you are given: never add a fact, a number or a quote that is not there. From the research that was not chosen as a top story, list up to five items worth a line each: the title, its address and one sentence. If nothing is left, answer with an empty list.',
                },
            ],
        },
        batching: {},
    };

    @node({
        id: '7b5590e6-1d6f-4cfb-a07a-c8d7b0fa4bb3',
        name: 'other_top_stories_auto_parser',
        type: '@n8n/n8n-nodes-langchain.outputParserAutofixing',
        version: 1,
        position: [0, 3870],
    })
    OtherTopStoriesAutoParser = {
        options: {},
    };

    @node({
        id: 'df51176d-cc05-4bf5-ad56-b8f48b7f2a77',
        name: 'other_top_stories_parser',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [-100, 4090],
    })
    OtherTopStoriesParser = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "items": [
    {
      "title": "A title",
      "url": "https://its-address",
      "line": "One sentence."
    }
  ]
}`,
    };

    @node({
        id: 'fbfacb32-651d-4778-a638-e0d2af6e6013',
        name: 'set_full_newsletter',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [460, 3870],
    })
    SetFullNewsletter = {
        assignments: {
            assignments: [
                {
                    id: '2b129b1a-3920-411b-ac56-b4c246acba0a',
                    name: 'file_name',
                    value: "={{ 'newsletter-' + $('submit_form').first().json['Newsletter date'] + '.md' }}",
                    type: 'string',
                },
                {
                    id: '8d0f1cc9-98d1-426c-a452-437e3f2261ea',
                    name: 'subject_line',
                    value: "={{ $('set_current_subject_line').first().json.subject_line }}",
                    type: 'string',
                },
                {
                    id: '2111c9a5-657d-4ed3-a430-712989156584',
                    name: 'markdown',
                    value: "={{ '# ' + $('set_current_subject_line').first().json.subject_line + '\\n\\n' + $('set_current_subject_line').first().json.preheader + '\\n\\n' + $('write_intro').first().json.output.intro + '\\n\\n' + $('iterate_stories').all().map((i) => i.json).map((s) => '## ' + s.headline + '\\n\\n' + s.body + (s.image_urls.length ? '\\n\\n![](' + s.image_urls[0] + ')' : '') + (s.sources.length ? '\\n\\nSources: ' + s.sources.join(', ') : '')).join('\\n\\n') + (($json.output.items ?? []).length ? '\\n\\n## Also worth reading\\n\\n' + $json.output.items.map((o) => '- [' + o.title + '](' + o.url + '): ' + o.line).join('\\n') : '') }}",
                    type: 'string',
                },
                {
                    id: '4810320f-3343-4dbb-ae05-f45bff7b1c3d',
                    name: 'summary',
                    value: "={{ 'Draft for ' + $('submit_form').first().json['Newsletter date'] + ' is attached. Subject line: ' + $('set_current_subject_line').first().json.subject_line + '. ' + $('iterate_stories').all().length + ' stories: ' + $('iterate_stories').all().map((i) => i.json.headline).join('; ') + '. Also worth reading: ' + ($json.output.items ?? []).length + ' items.' }}",
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '916f6ec0-473e-4d9f-a19f-23d761576715',
        name: 'create_newsletter_file',
        type: 'n8n-nodes-base.convertToFile',
        version: 1.1,
        position: [720, 3870],
    })
    CreateNewsletterFile = {
        operation: 'toText',
        sourceProperty: 'markdown',
        binaryPropertyName: 'data',
        options: {
            fileName: '={{ $json.file_name }}',
        },
    };

    @node({
        id: '220594a1-f86e-4f90-a3db-8617d5cde0c2',
        name: 'upload_newsletter_file',
        type: 'n8n-nodes-base.telegram',
        version: 1.2,
        position: [980, 3870],
        credentials: { telegramApi: { id: '__CRED:telegram__', name: 'Telegram' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    UploadNewsletterFile = {
        resource: 'message',
        operation: 'sendDocument',
        chatId: "={{ '-1000000000001' }}",
        binaryData: true,
        binaryPropertyName: 'data',
        additionalFields: {},
    };

    @node({
        id: '1217efe7-a644-41a5-aab2-c137034dd032',
        name: 'share_newsletter_msg',
        type: 'n8n-nodes-base.telegram',
        version: 1.2,
        position: [1240, 3870],
        credentials: { telegramApi: { id: '__CRED:telegram__', name: 'Telegram' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ShareNewsletterMsg = {
        resource: 'message',
        operation: 'sendMessage',
        chatId: "={{ '-1000000000001' }}",
        text: "={{ $('set_full_newsletter').first().json.summary }}",
        additionalFields: {
            appendAttribution: false,
        },
    };

    @node({
        id: '85f1a58d-39d5-4cad-a367-d8c4050486c7',
        name: 'Google Gemini Chat Model',
        type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
        version: 1,
        position: [260, 830],
        credentials: { googlePalmApi: { id: '__CRED:gemini__', name: 'Gemini' } },
    })
    GoogleGeminiChatModel = {
        modelName: 'models/gemini-2.5-flash',
        options: {
            temperature: 0.4,
        },
    };

    @node({
        id: '40a1746d-7615-48aa-af4c-9e96e4f11ffe',
        name: 'stories_parser',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [460, 830],
    })
    StoriesParser = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "stories": [
    {
      "title": "The story's headline",
      "content_ids": [
        "id-of-a-research-document"
      ],
      "external_urls": [
        "https://a-source-worth-reading"
      ],
      "why": "One sentence on why it leads."
    }
  ],
  "reasoning": "Why these stories."
}`,
    };

    @node({
        id: '9d0a8ff6-dce0-40a8-a395-65fcfce6912a',
        name: 'subject_line_parser',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [720, 1500],
    })
    SubjectLineParser = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "subject_line": "The subject line",
  "preheader": "The preheader",
  "reasoning": "One sentence."
}`,
    };

    @node({
        id: '13a4bcf2-2c53-4a86-a55e-e1504a2d863a',
        name: 'Groq Chat Model',
        type: '@n8n/n8n-nodes-langchain.lmChatGroq',
        version: 1,
        position: [4520, 2390],
        credentials: { groqApi: { id: '__CRED:groq__', name: 'Groq' } },
    })
    GroqChatModel = {
        model: 'llama-3.3-70b-versatile',
        options: {
            temperature: 0,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.SubmitForm.out(0).to(this.GetFiles.in(0));
        this.GetFiles.out(0).to(this.FilterOnlyMarkdown.in(0));
        this.FilterOnlyMarkdown.out(0).to(this.GetMarkdownObjectInfo.in(0));
        this.GetMarkdownObjectInfo.out(0).to(this.ExcludeNewsletters.in(0));
        this.ExcludeNewsletters.out(0).to(this.DownloadMarkdownObject.in(0));
        this.DownloadMarkdownObject.out(0).to(this.GetMarkdownFileContent.in(0));
        this.GetMarkdownFileContent.out(0).to(this.PrepareMarkdownContent.in(0));
        this.PrepareMarkdownContent.out(0).to(this.AggregateMarkdownContent.in(0));
        this.AggregateMarkdownContent.out(0).to(this.CombineMarkdownContent.in(0));
        this.CombineMarkdownContent.out(0).to(this.StoriesPrompt.in(0));
        this.StoriesPrompt.out(0).to(this.PickTopStories.in(0));
        this.PickTopStories.out(0).to(this.SetCurrentStories.in(0));
        this.SetCurrentStories.out(0).to(this.ShareSelectedStories.in(0));
        this.ShareSelectedStories.out(0).to(this.SplitIntoChunks.in(0));
        this.SplitIntoChunks.out(0).to(this.ShareStoriesReasoning.in(0));
        this.ShareStoriesReasoning.out(0).to(this.ShareStoriesApprovalFeedback.in(0));
        this.ShareStoriesApprovalFeedback.out(0).to(this.ExtractStoriesApprovalFeedback.in(0));
        this.ExtractStoriesApprovalFeedback.out(0).to(this.CheckStoriesFeedback.in(0));
        this.CheckStoriesFeedback.out(0).to(this.SubjectExamples.in(0));
        this.CheckStoriesFeedback.out(1).to(this.EditTopStories.in(0));
        this.EditTopStories.out(0).to(this.SetCurrentStories.in(0));
        this.SubjectExamples.out(0).to(this.SetSubjectLinePrompt.in(0));
        this.SetSubjectLinePrompt.out(0).to(this.WriteSubjectLine.in(0));
        this.WriteSubjectLine.out(0).to(this.SetCurrentSubjectLine.in(0));
        this.SetCurrentSubjectLine.out(0).to(this.ShareSubjectLine.in(0));
        this.ShareSubjectLine.out(0).to(this.ShareSubjectLineReasoning.in(0));
        this.ShareSubjectLineReasoning.out(0).to(this.ShareSubjectLineApprovalFeedback.in(0));
        this.ShareSubjectLineApprovalFeedback.out(0).to(this.ExtractSubjectLineApprovalFeedback.in(0));
        this.ExtractSubjectLineApprovalFeedback.out(0).to(this.CheckSubjectLineFeedback.in(0));
        this.CheckSubjectLineFeedback.out(0).to(this.SetSelectedStories.in(0));
        this.CheckSubjectLineFeedback.out(1).to(this.EditSubjectLine.in(0));
        this.EditSubjectLine.out(0).to(this.SetCurrentSubjectLine.in(0));
        this.SetSelectedStories.out(0).to(this.SplitStories.in(0));
        this.SplitStories.out(0).to(this.IterateStories.in(0));
        this.IterateStories.out(0).to(this.WriteIntro.in(0));
        this.IterateStories.out(1).to(this.SetCurrentSegment.in(0));
        this.SetCurrentSegment.out(0).to(this.SplitContentIds.in(0));
        this.SplitContentIds.out(0).to(this.GetSegmentContentInfo.in(0));
        this.GetSegmentContentInfo.out(0).to(this.GetSegmentContent.in(0));
        this.GetSegmentContent.out(0).to(this.DownloadSegmentContent.in(0));
        this.DownloadSegmentContent.out(0).to(this.GetSegmentContentText.in(0));
        this.GetSegmentContentText.out(0).to(this.PrepareSegmentContentItem.in(0));
        this.PrepareSegmentContentItem.out(0).to(this.AggregateSegmentTextContent.in(0));
        this.AggregateSegmentTextContent.out(0).to(this.CheckExternalUrls.in(0));
        this.CheckExternalUrls.out(0).to(this.SetSegmentExternalSourceLinks.in(0));
        this.CheckExternalUrls.out(1).to(this.WriteSegmentContent.in(0));
        this.SetSegmentExternalSourceLinks.out(0).to(this.SplitSegmentExternalSourceUrls.in(0));
        this.SplitSegmentExternalSourceUrls.out(0).to(this.ScrapeSegmentExternalSourceUrl.in(0));
        this.ScrapeSegmentExternalSourceUrl.out(0).to(this.FilterSegmentExternalSourceErrors.in(0));
        this.FilterSegmentExternalSourceErrors.out(0).to(this.AggregateSegmentExternalSourceContent.in(0));
        this.AggregateSegmentExternalSourceContent.out(0).to(this.WriteSegmentContent.in(0));
        this.WriteSegmentContent.out(0).to(this.ExtractImageUrls.in(0));
        this.ExtractImageUrls.out(0).to(this.ShareSegmentMsg.in(0));
        this.ShareSegmentMsg.out(0).to(this.SetStorySegment.in(0));
        this.SetStorySegment.out(0).to(this.IterateStories.in(0));
        this.WriteIntro.out(0).to(this.WriteOtherTopStories.in(0));
        this.WriteOtherTopStories.out(0).to(this.SetFullNewsletter.in(0));
        this.SetFullNewsletter.out(0).to(this.CreateNewsletterFile.in(0));
        this.CreateNewsletterFile.out(0).to(this.UploadNewsletterFile.in(0));
        this.UploadNewsletterFile.out(0).to(this.ShareNewsletterMsg.in(0));

        this.PickTopStories.uses({
            ai_languageModel: this.GoogleGeminiChatModel.output,
            ai_outputParser: this.StoriesParser.output,
        });
        this.EditTopStories.uses({
            ai_languageModel: this.GoogleGeminiChatModel.output,
            ai_outputParser: this.StoriesParser.output,
        });
        this.ExtractStoriesApprovalFeedback.uses({
            ai_languageModel: this.GoogleGeminiChatModel.output,
        });
        this.WriteSubjectLine.uses({
            ai_languageModel: this.GoogleGeminiChatModel.output,
            ai_outputParser: this.SubjectLineParser.output,
        });
        this.EditSubjectLine.uses({
            ai_languageModel: this.GoogleGeminiChatModel.output,
            ai_outputParser: this.SubjectLineParser.output,
        });
        this.ExtractSubjectLineApprovalFeedback.uses({
            ai_languageModel: this.GoogleGeminiChatModel.output,
        });
        this.WriteSegmentContent.uses({
            ai_languageModel: this.GoogleGeminiChatModel.output,
            ai_outputParser: this.StorySegmentAutoParser.output,
        });
        this.StorySegmentAutoParser.uses({
            ai_languageModel: this.GroqChatModel.output,
            ai_outputParser: this.StorySegmentOutputParser.output,
        });
        this.ExtractImageUrls.uses({
            ai_languageModel: this.GoogleGeminiChatModel.output,
            ai_outputParser: this.ImageUrlsAutoParser.output,
        });
        this.ImageUrlsAutoParser.uses({
            ai_languageModel: this.GroqChatModel.output,
            ai_outputParser: this.ExtractImageUrlsParser.output,
        });
        this.WriteIntro.uses({
            ai_languageModel: this.GoogleGeminiChatModel.output,
            ai_outputParser: this.IntroAutoParser.output,
        });
        this.IntroAutoParser.uses({
            ai_languageModel: this.GroqChatModel.output,
            ai_outputParser: this.IntroParser.output,
        });
        this.WriteOtherTopStories.uses({
            ai_languageModel: this.GoogleGeminiChatModel.output,
            ai_outputParser: this.OtherTopStoriesAutoParser.output,
        });
        this.OtherTopStoriesAutoParser.uses({
            ai_languageModel: this.GroqChatModel.output,
            ai_outputParser: this.OtherTopStoriesParser.output,
        });
    }
}
