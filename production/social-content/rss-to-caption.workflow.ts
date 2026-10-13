import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Social · RSS to caption
// Nodes   : 9  |  Connections: 6
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// SectionRss                         stickyNote
// SectionGenerateContent             stickyNote
// GetRecentNews                      rssFeedReadTrigger
// DoesExist                          filter
// ForEachNews                        splitInBatches
// GenerateCaption                    googleGemini               [creds] [retry]
// SendCaption                        telegram                   [creds] [retry]
// SendSource                         telegram                   [creds] [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// GetRecentNews
//    → DoesExist
//      → ForEachNews
//       .out(1) → GenerateCaption
//          → SendCaption
//            → SendSource
//              → ForEachNews (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Social · RSS to caption',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class SocialRssToCaptionWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '885d023b-fe31-4e4e-a9af-31ecc4819225',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -220],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Social · RSS to caption
Watches an RSS feed. Each new article is turned into a summary-style caption by Gemini and sent to the social manager's Telegram, followed by the source link, ready to copy and post.

**Platforms:** RSS, Gemini, Telegram
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`production/social-content\``,
    };

    @node({
        id: '675e3bd5-64ab-4b8e-a67b-e2c13b6f4d69',
        name: 'Section: RSS',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 0],
    })
    SectionRss = {
        width: 640,
        height: 330,
        color: 4,
        content: '## 1. RSS',
    };

    @node({
        id: '9915c47f-f755-4b21-a1ae-bfcced3c33b6',
        name: 'Section: Generate content',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 410],
    })
    SectionGenerateContent = {
        width: 380,
        height: 870,
        color: 5,
        content: '## 2. Generate content',
    };

    @node({
        id: '57c94bfd-373d-4e07-a1e8-2988aa7e2774',
        name: 'get_recent_news',
        type: 'n8n-nodes-base.rssFeedReadTrigger',
        version: 1,
        position: [0, 200],
    })
    GetRecentNews = {
        pollTimes: {
            item: [
                {
                    mode: 'everyMinute',
                },
            ],
        },
        feedUrl: 'https://feeds.acme.example/news.xml',
    };

    @node({
        id: '73fcf8d4-885c-4e89-a1fc-fcdc3927b517',
        name: 'does_exist',
        type: 'n8n-nodes-base.filter',
        version: 2.2,
        position: [260, 200],
    })
    DoesExist = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '6f209445-3b1a-4193-a65a-f91ba910aedd',
                    leftValue: '={{ !!$json.link && !!($json.title || $json.contentSnippet) }}',
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
        id: '29226c92-5b46-4d52-aed3-df2a5b4e4d7d',
        name: 'for_each_news',
        type: 'n8n-nodes-base.splitInBatches',
        version: 3,
        position: [0, 610],
    })
    ForEachNews = {
        batchSize: 1,
        options: {},
    };

    @node({
        id: 'b87bdebd-fc17-45b9-a9da-3b2cd4a7c2a0',
        name: 'generate_caption',
        type: '@n8n/n8n-nodes-langchain.googleGemini',
        version: 1.2,
        position: [0, 790],
        credentials: { googlePalmApi: { id: '__CRED:gemini__', name: 'Gemini' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GenerateCaption = {
        resource: 'text',
        operation: 'message',
        modelId: {
            __rl: true,
            mode: 'id',
            value: 'models/gemini-2.5-flash',
        },
        messages: {
            values: [
                {
                    content:
                        "={{ 'Headline: ' + $('for_each_news').first().json.title + '\\n\\n' + String($('for_each_news').first().json.contentSnippet ?? $('for_each_news').first().json.content ?? '').slice(0, 3000) }}",
                    role: 'user',
                },
            ],
        },
        simplify: true,
        options: {
            systemMessage:
                '[task:social-caption] You turn a news article into one summary-style social media caption. Under 500 characters, the main fact first, no invented details, no link. Reply with the caption only.',
        },
    };

    @node({
        id: '0a2c696b-6db3-4d4d-a1b1-089ab27d5811',
        name: 'send_caption',
        type: 'n8n-nodes-base.telegram',
        version: 1.2,
        position: [0, 970],
        credentials: { telegramApi: { id: '__CRED:telegram__', name: 'Telegram' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendCaption = {
        resource: 'message',
        operation: 'sendMessage',
        chatId: "={{ '-1000000000001' }}",
        text: "={{ String($json.content?.parts?.[0]?.text ?? '').trim() || $('for_each_news').first().json.title }}",
        additionalFields: {
            appendAttribution: false,
        },
    };

    @node({
        id: 'ec619bdd-fab4-43b4-aa52-5e55f9775c82',
        name: 'send_source',
        type: 'n8n-nodes-base.telegram',
        version: 1.2,
        position: [0, 1150],
        credentials: { telegramApi: { id: '__CRED:telegram__', name: 'Telegram' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendSource = {
        resource: 'message',
        operation: 'sendMessage',
        chatId: "={{ '-1000000000001' }}",
        text: "={{ $('for_each_news').first().json.link }}",
        additionalFields: {
            appendAttribution: false,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.GetRecentNews.out(0).to(this.DoesExist.in(0));
        this.DoesExist.out(0).to(this.ForEachNews.in(0));
        this.ForEachNews.out(1).to(this.GenerateCaption.in(0));
        this.GenerateCaption.out(0).to(this.SendCaption.in(0));
        this.SendCaption.out(0).to(this.SendSource.in(0));
        this.SendSource.out(0).to(this.ForEachNews.in(0));
    }
}
