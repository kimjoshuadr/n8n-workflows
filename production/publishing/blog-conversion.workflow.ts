import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Publishing · Markdown to blog draft
// Nodes   : 12  |  Connections: 6
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// GetFile                            telegramTrigger            [creds]
// CheckFile                          filter
// DownloadMd                         telegram                   [creds] [retry]
// ExtractMd                          extractFromFile
// GetLatestYtVideos                  apify                      [creds] [alwaysOutput] [retry]
// GenerateContent                    chainLlm                   [AI] [executeOnce]
// GoogleGeminiChatModel              lmChatGoogleGemini         [creds] [ai_languageModel]
// BlogParser                         outputParserAutofixing     [AI] [ai_outputParser]
// GroqChatModel                      lmChatGroq                 [creds] [ai_languageModel]
// StructuredOutputParser             outputParserStructured     [ai_outputParser]
// DraftWix                           httpRequest                [creds] [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// GetFile
//    → CheckFile
//      → DownloadMd
//        → ExtractMd
//          → GetLatestYtVideos
//            → GenerateContent
//              → DraftWix
//
// AI CONNECTIONS
// GenerateContent.uses({ ai_languageModel: GoogleGeminiChatModel, ai_outputParser: BlogParser })
// BlogParser.uses({ ai_languageModel: GroqChatModel, ai_outputParser: StructuredOutputParser })
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Publishing · Markdown to blog draft',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class PublishingMarkdownToBlogDraftWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '384af4d2-007d-428e-a8d4-805826f168eb',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Publishing · Markdown to blog draft
A Markdown file sent to a Telegram bot is turned into a blog post. Gemini restructures the notes, picks a recent YouTube video fetched through Apify to embed, and works in the promotion of the week. The post is saved to Wix as a draft for an editor to review.

**Platforms:** Telegram, Apify, Gemini, Groq, Wix
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`production/publishing\``,
    };

    @node({
        id: '5380ff7b-3500-4541-a74f-4a5e9deabfeb',
        webhookId: '9ae5576c-409c-4dd9-ae27-12994a9a4bc6',
        name: 'get_file',
        type: 'n8n-nodes-base.telegramTrigger',
        version: 1.2,
        position: [0, 310],
        credentials: { telegramApi: { id: '__CRED:telegram__', name: 'Telegram' } },
    })
    GetFile = {
        updates: ['message'],
        additionalFields: {},
    };

    @node({
        id: 'e6dc9cb6-ecf5-499c-a2e3-162a63b9d88d',
        name: 'check_file',
        type: 'n8n-nodes-base.filter',
        version: 2.2,
        position: [260, 310],
    })
    CheckFile = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '72e576fd-a202-47b1-a1e7-9e9d3839fb87',
                    leftValue:
                        "={{ !!$json.message?.document && /\\.(md|markdown)$/i.test($json.message.document.file_name ?? '') }}",
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
        id: 'a75add87-1dc0-43ab-af4f-31cd659d6f15',
        name: 'download_md',
        type: 'n8n-nodes-base.telegram',
        version: 1.2,
        position: [520, 310],
        credentials: { telegramApi: { id: '__CRED:telegram__', name: 'Telegram' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    DownloadMd = {
        resource: 'file',
        operation: 'get',
        fileId: '={{ $json.message.document.file_id }}',
        download: true,
    };

    @node({
        id: '3be57caf-56c9-41cc-a66d-9064b01684f4',
        name: 'extract_md',
        type: 'n8n-nodes-base.extractFromFile',
        version: 1,
        position: [780, 310],
    })
    ExtractMd = {
        operation: 'text',
        binaryPropertyName: 'data',
        destinationKey: 'markdown',
        options: {},
    };

    @node({
        id: '27d643a8-1957-4d60-a540-17cc9ea830b5',
        name: 'get_latest_yt_videos',
        type: '@apify/n8n-nodes-apify.apify',
        version: 2,
        position: [1040, 310],
        credentials: { apifyApi: { id: '__CRED:apify__', name: 'Apify' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetLatestYtVideos = {
        resource: 'Actor tasks',
        operation: 'Run task and get dataset',
        actorTaskId: 'acme~youtube-latest-videos',
    };

    @node({
        id: '9c4dde09-f0b0-4163-a660-6ec343efffd6',
        name: 'generate_content',
        type: '@n8n/n8n-nodes-langchain.chainLlm',
        version: 1.7,
        position: [1400, 90],
        executeOnce: true,
    })
    GenerateContent = {
        promptType: 'define',
        text: "={{ 'Research notes:\\n' + $('extract_md').first().json.markdown + '\\n\\nRecent videos:\\n' + $('get_latest_yt_videos').all().map((i) => i.json).filter((v) => v.url).map((v) => '- ' + v.title + ' (' + v.url + ')').join('\\n') }}",
        hasOutputParser: true,
        messages: {
            messageValues: [
                {
                    type: 'SystemMessagePromptTemplate',
                    message:
                        "[task:blog-convert] You turn internal research notes into a blog post for the public site. Keep every fact and add none. Give it a clear title, a two-sentence excerpt and a body of short paragraphs separated by blank lines. From the list of recent videos choose the one most relevant to the post and return its URL as video_url, or an empty string if none fits. Work this promotion into one paragraph near the end, in the post's own tone: 'Join the weekly briefing: one email, every Friday.'",
                },
            ],
        },
        batching: {},
    };

    @node({
        id: '18f670bd-bea4-4be8-a71c-5bfbf44930db',
        name: 'Google Gemini Chat Model',
        type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
        version: 1,
        position: [1300, 310],
        credentials: { googlePalmApi: { id: '__CRED:gemini__', name: 'Gemini' } },
    })
    GoogleGeminiChatModel = {
        modelName: 'models/gemini-2.5-flash',
        options: {
            temperature: 0.4,
        },
    };

    @node({
        id: '20aeeb6a-6448-48bf-a5bc-45cc420534ed',
        name: 'blog_parser',
        type: '@n8n/n8n-nodes-langchain.outputParserAutofixing',
        version: 1,
        position: [1500, 310],
    })
    BlogParser = {
        options: {},
    };

    @node({
        id: 'dc612c0b-8060-4a0d-abc2-5ab47121dcef',
        name: 'Groq Chat Model',
        type: '@n8n/n8n-nodes-langchain.lmChatGroq',
        version: 1,
        position: [1400, 530],
        credentials: { groqApi: { id: '__CRED:groq__', name: 'Groq' } },
    })
    GroqChatModel = {
        model: 'llama-3.3-70b-versatile',
        options: {
            temperature: 0,
        },
    };

    @node({
        id: '8c55ed10-a398-43ba-a668-2e1521545c7a',
        name: 'Structured Output Parser',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [1600, 530],
    })
    StructuredOutputParser = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "title": "The post's title",
  "excerpt": "Two sentences.",
  "body": "Paragraph one.\\n\\nParagraph two.",
  "video_url": "https://www.youtube.com/watch?v=..."
}`,
    };

    @node({
        id: 'abe5abe4-8677-4879-af4f-bd724e935aa1',
        name: 'draft_wix',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1760, 310],
        credentials: { httpHeaderAuth: { id: '__CRED:wix__', name: 'Wix API key' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    DraftWix = {
        method: 'POST',
        url: "={{ 'https://www.wixapis.com/blog/v3/draft-posts' }}",
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ draftPost: { title: $json.output.title, excerpt: $json.output.excerpt, richContent: { nodes: String($json.output.body ?? '').split('\\n\\n').filter((text) => text.trim()).map((text) => ({ type: 'PARAGRAPH', nodes: [ { type: 'TEXT', textData: { text: text.trim() } } ] })).concat($json.output.video_url ? [ { type: 'VIDEO', videoData: { video: { src: { url: $json.output.video_url } } } } ] : []) } }, publish: false }) }}",
        options: {
            timeout: 15000,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.GetFile.out(0).to(this.CheckFile.in(0));
        this.CheckFile.out(0).to(this.DownloadMd.in(0));
        this.DownloadMd.out(0).to(this.ExtractMd.in(0));
        this.ExtractMd.out(0).to(this.GetLatestYtVideos.in(0));
        this.GetLatestYtVideos.out(0).to(this.GenerateContent.in(0));
        this.GenerateContent.out(0).to(this.DraftWix.in(0));

        this.GenerateContent.uses({
            ai_languageModel: this.GoogleGeminiChatModel.output,
            ai_outputParser: this.BlogParser.output,
        });
        this.BlogParser.uses({
            ai_languageModel: this.GroqChatModel.output,
            ai_outputParser: this.StructuredOutputParser.output,
        });
    }
}
